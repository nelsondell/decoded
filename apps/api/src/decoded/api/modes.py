from __future__ import annotations

from datetime import datetime
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import BackgroundTasks

from decoded.api.deps import rate_limited
from decoded.auth.clerk import get_optional_user
from decoded.config import settings
from decoded.db.base import get_session
from decoded.db.models import ExplanationMode, ModeStatus, Paper, User
from decoded.db.repositories.explanation_modes import ExplanationModesRepository, is_stale
from decoded.modes.schemas import ALL_MODES
from decoded.db.repositories.credits import CreditsRepository, InsufficientCredits, available
from decoded.modes.pipeline import generate_mode
from decoded.auth.clerk import get_current_user
from decoded.db.base import async_session_factory
from decoded.observability.product import track

logger = structlog.get_logger()

router = APIRouter(prefix="/v1/papers/{arxiv_id}/modes", tags=["modes"])


class ModeInfo(BaseModel):
    mode: str
    status: str
    cached: bool
    content: Optional[dict] = None
    generated_at: Optional[datetime] = None


class ModesListResponse(BaseModel):
    arxiv_id: str
    modes: list[ModeInfo]
    credits_remaining: Optional[int] = None
    credits_reset_at: Optional[datetime] = None
    plan: Optional[str] = None


def _mode_info(mode: str, row: Optional[ExplanationMode]) -> ModeInfo:
    """
    O estado que o cliente vê. Uma geração parada (a máquina caiu no meio)
    aparece como falha: o cliente para de esperar e pode pedir de novo.
    """
    if row is None:
        return ModeInfo(mode=mode, status="pending", cached=False)
    ready = row.status == ModeStatus.READY
    return ModeInfo(
        mode=mode,
        status="failed" if is_stale(row) else row.status.value,
        cached=ready,
        content=row.content if ready else None,
        generated_at=row.updated_at if ready else None,
    )


async def _load_paper(session: AsyncSession, arxiv_id: str) -> Paper:
    stmt = select(Paper).where(Paper.arxiv_id == arxiv_id)
    paper = (await session.execute(stmt)).scalar_one_or_none()
    if paper is None:
        raise HTTPException(status_code=404, detail=f"Paper {arxiv_id} não encontrado")
    return paper


@router.get("", response_model=ModesListResponse)
async def list_modes(
    arxiv_id: str,
    user: Optional[User] = Depends(get_optional_user),
    session: AsyncSession = Depends(get_session),
) -> ModesListResponse:
    """
    Lista todos os modos com status. Conteúdo incluído apenas para os prontos.
    Funciona sem autenticação — modos em cache são públicos.
    """
    paper = await _load_paper(session, arxiv_id)

    repo = ExplanationModesRepository(session)
    existing = await repo.list_for_paper(paper.id, settings.mode_prompt_version)

    credits, reset_at = available(user) if user else (None, None)

    return ModesListResponse(
        arxiv_id=arxiv_id,
        modes=[_mode_info(m, existing.get(m)) for m in ALL_MODES],
        credits_remaining=credits,
        credits_reset_at=reset_at,
        plan=user.plan if user else None,
    )


@router.get("/{mode}", response_model=ModeInfo)
async def get_mode(
    arxiv_id: str,
    mode: str,
    session: AsyncSession = Depends(get_session),
    _rl: None = Depends(rate_limited("mode_poll")),
) -> ModeInfo:
    """Busca um modo específico. Só retorna se estiver em cache."""
    if mode not in ALL_MODES:
        raise HTTPException(status_code=400, detail=f"Modo desconhecido: {mode}")

    paper = await _load_paper(session, arxiv_id)
    repo = ExplanationModesRepository(session)
    row = await repo.get(paper.id, mode, settings.mode_prompt_version)
    return _mode_info(mode, row)

class GenerateModeResponse(BaseModel):
    mode: str
    status: str
    cached: bool
    content: Optional[dict] = None
    error: Optional[str] = None
    credits_remaining: Optional[int] = None
    cost_usd: Optional[float] = None
    poll_after_ms: Optional[int] = Field(
        default=None,
        description="Se status=generating, esperar isto antes do próximo GET",
    )


async def _generate_in_background(
    arxiv_id: str,
    mode: str,
    user_id: int,
    paper_id: int,
    charged: bool = True,
) -> None:
    """
    Roda depois da resposta HTTP.

    Sessão própria — a do request já fechou. Estorno em caso de falha
    acontece aqui, não no handler.
    """
    from decoded.db.repositories.credits import CreditsRepository

    log = logger.bind(arxiv_id=arxiv_id, mode=mode, user_id=user_id)

    try:
        result = await generate_mode(
            arxiv_id=arxiv_id,
            mode=mode,
            anthropic_api_key=settings.anthropic_api_key,
            fast_model=settings.decoder_model_fast,
            deep_model=settings.decoder_model_deep,
            user_id=user_id,
        )

        # O crédito só fica se esta chamada gerou o conteúdo. Falha, modo que
        # não cabe, ou outra requisição que já estava gerando: devolve.
        if charged and (result.get("status") != "ready" or result.get("cached")):
            async with async_session_factory() as session:
                user = (
                    await session.execute(select(User).where(User.id == user_id))
                ).scalar_one_or_none()
                if user is not None:
                    credits = CreditsRepository(session)
                    await credits.refund(user, paper_id, mode)
                    await session.commit()
                    log.info("mode.refunded", reason=result.get("status"))
        async with async_session_factory() as session:
            clerk_id = (
                await session.execute(
                    select(User.clerk_user_id).where(User.id == user_id)
                )
            ).scalar_one_or_none()

        if clerk_id:
            track(
                clerk_id,
                "mode_generation_completed",
                {
                    "mode": mode,
                    "arxiv_id": arxiv_id,
                    "status": result.get("status"),
                    "cost_usd": result.get("cost_usd", 0),
                    "latency_ms": result.get("latency_ms", 0),
                },
            )

        log.info("mode.background_done", status=result.get("status"))

    except Exception as e:
        log.error("mode.background_failed", error=str(e))
        async with async_session_factory() as session:
            user = (
                await session.execute(select(User).where(User.id == user_id))
            ).scalar_one_or_none()
            if user is not None and charged:
                credits = CreditsRepository(session)
                await credits.refund(user, paper_id, mode, reason="background_error")
                await session.commit()


@router.post("/{mode}/generate", response_model=GenerateModeResponse)
async def generate(
    arxiv_id: str,
    mode: str,
    background: BackgroundTasks,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    _rl: None = Depends(rate_limited("mode_generate")),
) -> GenerateModeResponse:
    """
    Dispara a geração de um modo. Retorna imediatamente.

    Cache hit devolve o conteúdo na hora, de graça.
    Caso contrário gasta o crédito, agenda a geração, e devolve
    status=generating. O cliente faz polling no GET.
    """
    if mode not in ALL_MODES:
        raise HTTPException(status_code=400, detail=f"Modo desconhecido: {mode}")

    paper = await _load_paper(session, arxiv_id)
    modes_repo = ExplanationModesRepository(session)
    credits_repo = CreditsRepository(session)

    existing = await modes_repo.get(paper.id, mode, settings.mode_prompt_version)

    # Cache hit — grátis
    if existing is not None and existing.status == ModeStatus.READY:
        return GenerateModeResponse(
            mode=mode,
            status="ready",
            cached=True,
            content=existing.content,
            credits_remaining=available(user)[0],
            cost_usd=0.0,
        )

    # Já está gerando — não cobra de novo. Parada há muito, gera outra vez.
    if (
        existing is not None
        and existing.status == ModeStatus.GENERATING
        and not is_stale(existing)
    ):
        return GenerateModeResponse(
            mode=mode,
            status="generating",
            cached=False,
            credits_remaining=available(user)[0],
            poll_after_ms=3000,
        )

    # O modo não cabe neste paper — não há o que cobrar
    if existing is not None and existing.status == ModeStatus.NOT_APPLICABLE:
        return GenerateModeResponse(
            mode=mode,
            status="not_applicable",
            cached=False,
            error=existing.error,
            credits_remaining=available(user)[0],
        )

    if not settings.anthropic_api_key:
        raise HTTPException(status_code=503, detail="Geração indisponível")

    # Quem pediu uma geração que parou no meio (a máquina caiu) já pagou
    # por ela: a nova tentativa sai de graça
    charged = not (
        existing is not None
        and is_stale(existing)
        and existing.requested_by_user_id == user.id
    )

    # Cobra antes de agendar
    if charged:
        try:
            remaining = await credits_repo.spend(user, paper.id, mode)
            await session.commit()
        except InsufficientCredits as e:
            raise HTTPException(status_code=402, detail=str(e))
    else:
        remaining = available(user)[0]

    background.add_task(
        _generate_in_background,
        arxiv_id=arxiv_id,
        mode=mode,
        user_id=user.id,
        paper_id=paper.id,
        charged=charged,
    )

    logger.info("mode.queued", arxiv_id=arxiv_id, mode=mode, user_id=user.id)

    return GenerateModeResponse(
        mode=mode,
        status="generating",
        cached=False,
        credits_remaining=remaining,
        poll_after_ms=3000,
    )