"""
Executa o decode visual: escolhe papers, extrai o texto, manda em lote,
confere e grava.

Cada paper vira uma requisição com o system em cache e saída estruturada.
O resultado fica em decoded_contents como a seção "visual" (prompt_version
"v1", a mesma que a API já filtra), mais um "one_sentence" com o hook
quando o paper ainda não tem um — o feed e o filtro decoded_only dependem
dele.

O estado de cada lote (custom_id → paper) fica fora do Git, em
~/.cache/decoded/visual/.
"""

from __future__ import annotations

import asyncio
import json
import re
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import httpx
import structlog
from anthropic import APIConnectionError, APITimeoutError, AsyncAnthropic
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
from anthropic.types.messages.batch_create_params import Request
from pydantic import ValidationError
from sqlalchemy import exists, select
from sqlalchemy.dialects.postgresql import array as pg_array

from decoded.db.base import async_session_factory
from decoded.db.models import DecodedContent, IngestionStatus, Paper, ParsedContent
from decoded.db.repositories.decoded_contents import DecodedContentsRepository
from decoded.db.repositories.parsed_contents import ParsedContentsRepository
from decoded.decoding.prompts import VERSION as PROMPT_VERSION
from decoded.visual import source
from decoded.visual.prompt import PROMPT_ID, SYSTEM, user_message
from decoded.visual.schemas import SCHEMA_ID, VisualDecode, from_wire, output_schema
from decoded.visual.verify import verify

logger = structlog.get_logger()

SECTION = "visual"
# O Decoded é sobre IA: papers do HN de outras áreas (sistemas, matemática) ficam fora
AI_CATEGORIES = ["cs.AI", "cs.CL", "cs.LG", "cs.CV", "stat.ML", "cs.MA", "cs.NE", "cs.IR", "cs.RO"]
STATE_DIR = Path.home() / ".cache" / "decoded" / "visual"
MAX_TOKENS = 16_000
ARXIV_DELAY_S = 3.0  # o arXiv pede no máximo uma requisição a cada 3 s

# Preço por milhão de tokens (entrada, saída), tabela padrão. Lote = metade.
PRICES = {
    "claude-opus-5-5": (4.00, 20.00),
    "claude-sonnet-5-5": (2.00, 10.00),
    "claude-haiku-5-5": (0.10, 0.50),
}
BATCH_DISCOUNT = 0.5
CACHE_WRITE = 1.25
CACHE_READ = 0.10


def cost_usd(model: str, usage: dict, batch: bool) -> float:
    price_in, price_out = PRICES[model]
    fresh = usage.get("input_tokens", 0)
    written = usage.get("cache_creation_input_tokens", 0) or 0
    read = usage.get("cache_read_input_tokens", 0) or 0
    out = usage.get("output_tokens", 0)
    total = (
        fresh * price_in
        + written * price_in * CACHE_WRITE
        + read * price_in * CACHE_READ
        + out * price_out
    ) / 1_000_000
    return total * (BATCH_DISCOUNT if batch else 1.0)


def custom_id_for(arxiv_id: str) -> str:
    return "v-" + re.sub(r"[^a-zA-Z0-9_-]", "_", arxiv_id)[:60]


# ------------------------------------------------------------------ escolha


async def candidates(limit: int, prepared_only: bool) -> list[tuple[Paper, ParsedContent | None]]:
    """Papers sem decode visual, por prioridade; com o texto, se já extraído."""
    has_visual = exists().where(
        DecodedContent.paper_id == Paper.id,
        DecodedContent.section == SECTION,
        DecodedContent.prompt_version == PROMPT_VERSION,
    )
    stmt = (
        select(Paper, ParsedContent)
        .outerjoin(ParsedContent, ParsedContent.paper_id == Paper.id)
        .where(
            ~has_visual,
            Paper.status != IngestionStatus.FAILED,
            Paper.categories.op("&&")(pg_array(AI_CATEGORIES)),
        )
        .order_by(Paper.priority_score.desc().nulls_last(), Paper.published_at.desc())
        .limit(limit)
    )
    if prepared_only:
        stmt = stmt.where(ParsedContent.parser == source.PARSER_NAME)
    async with async_session_factory() as session:
        rows = (await session.execute(stmt)).all()
    return [(paper, parsed) for paper, parsed in rows]


async def prepare(limit: int) -> dict:
    """Baixa e extrai o texto dos próximos papers, guardando em parsed_contents."""
    picked = [p for p, parsed in await candidates(limit, prepared_only=False)
              if parsed is None or parsed.parser != source.PARSER_NAME]
    done, failed = 0, []
    async with httpx.AsyncClient(headers={"User-Agent": "decoded-visual/1 (+https://decoded.ink)"}) as client:
        for i, paper in enumerate(picked):
            if i:
                await asyncio.sleep(ARXIV_DELAY_S)
            try:
                pdf = await source.fetch_pdf(client, paper.arxiv_id)
                text = await asyncio.to_thread(source.extract, pdf)
            except Exception as e:  # um PDF quebrado não para o lote
                failed.append(paper.arxiv_id)
                logger.warning("visual.prepare.failed", arxiv_id=paper.arxiv_id, error=str(e)[:200])
                continue
            try:
                async with async_session_factory() as session:
                    await ParsedContentsRepository(session).upsert(paper.id, {
                        "parser": source.PARSER_NAME,
                        "markdown": text.text,
                        "figures": [{"caption": c} for c in text.captions],
                        "equations": [],
                        "parse_ms": text.parse_ms,
                    })
                    await session.commit()
            except Exception as e:
                failed.append(paper.arxiv_id)
                logger.warning("visual.prepare.store_failed", arxiv_id=paper.arxiv_id, error=str(e)[:200])
                continue
            done += 1
            logger.info("visual.prepared", arxiv_id=paper.arxiv_id, chars=len(text.text),
                        pages=text.pages, truncated=text.truncated)
    return {"prepared": done, "failed": failed}


# ---------------------------------------------------------------- requisição


def _params(paper: Paper, parsed: ParsedContent, model: str, effort: str) -> dict:
    text = parsed.markdown or ""
    return {
        "model": model,
        "max_tokens": MAX_TOKENS,
        "system": [{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}],
        "messages": [{
            "role": "user",
            "content": user_message(
                title=paper.title,
                abstract=paper.abstract or "",
                categories=list(paper.categories or []),
                text=text,
                truncated=len(text) >= source.MAX_CHARS,
            ),
        }],
        "output_config": {
            "effort": effort,
            "format": {"type": "json_schema", "schema": output_schema()},
        },
    }


# Texto de PDF rende ~2,7 caracteres por token (medido nos primeiros decodes)
CHARS_PER_TOKEN = 2.7


def estimate(pairs: list[tuple[Paper, ParsedContent]], model: str, output_tokens: int) -> dict:
    """Custo previsto do lote, com a taxa de tokens medida em papers reais."""
    system_tokens = int((len(SYSTEM) + len(json.dumps(output_schema()))) / CHARS_PER_TOKEN)
    inputs = [
        int((len(parsed.markdown or "") + len(p.abstract or "")) / CHARS_PER_TOKEN) + 300
        for p, parsed in pairs
    ]
    usage = {
        "input_tokens": sum(inputs),
        "cache_read_input_tokens": system_tokens * max(len(pairs) - 1, 0),
        "cache_creation_input_tokens": system_tokens,
        "output_tokens": output_tokens * len(pairs),
    }
    total = cost_usd(model, usage, batch=True)
    return {
        "papers": len(pairs),
        "avg_input_tokens": int(sum(inputs) / max(len(pairs), 1)),
        "assumed_output_tokens": output_tokens,
        "usd_total": round(total, 2),
        "usd_per_paper": round(total / max(len(pairs), 1), 3),
    }


# ----------------------------------------------------------------- gravação


@dataclass
class Outcome:
    arxiv_id: str
    status: str  # stored | refused | invalid | errored | expired | truncated
    cost_usd: float = 0.0
    warnings: list[str] | None = None
    detail: str | None = None


def _text_of(message) -> str:
    return "".join(b.text for b in message.content if getattr(b, "type", "") == "text")


async def store(paper_id: int, arxiv_id: str, message, model: str, batch: bool, source_text: str,
                latency_ms: int = 0) -> Outcome:
    usage = message.usage.model_dump() if message.usage else {}
    cost = cost_usd(model, usage, batch=batch)

    if message.stop_reason == "refusal":
        return Outcome(arxiv_id, "refused", cost)
    if message.stop_reason == "max_tokens":
        return Outcome(arxiv_id, "truncated", cost)
    try:
        decode = VisualDecode.model_validate(from_wire(json.loads(_text_of(message))))
    except (ValidationError, ValueError) as e:
        return Outcome(arxiv_id, "invalid", cost, detail=str(e)[:400])

    clean, report = verify(decode, source_text)
    if not report.ok:
        return Outcome(arxiv_id, "invalid", cost, report.warnings, "; ".join(report.dropped))

    content = {"schema": SCHEMA_ID, "prompt": PROMPT_ID, **clean.model_dump(), "warnings": report.warnings}
    async with async_session_factory() as session:
        repo = DecodedContentsRepository(session)
        await repo.upsert_section(
            paper_id=paper_id, section=SECTION, content=content, model=model,
            prompt_version=PROMPT_VERSION,
            input_tokens=usage.get("input_tokens", 0) + (usage.get("cache_read_input_tokens") or 0)
            + (usage.get("cache_creation_input_tokens") or 0),
            output_tokens=usage.get("output_tokens", 0),
            cost_usd=cost, latency_ms=latency_ms,
        )
        existing = await repo.get_all_sections(paper_id, PROMPT_VERSION)
        if "one_sentence" not in existing:
            await repo.upsert_section(
                paper_id=paper_id, section="one_sentence", content={"text": clean.hook},
                model=model, prompt_version=PROMPT_VERSION,
                input_tokens=0, output_tokens=0, cost_usd=0.0, latency_ms=0,
            )
        paper = await session.get(Paper, paper_id)
        if paper is not None:
            paper.status = IngestionStatus.DECODED
        await session.commit()
    return Outcome(arxiv_id, "stored", cost, report.warnings)


# --------------------------------------------------------------------- uma só


async def trial(arxiv_id: str, model: str, effort: str, api_key: str, save: bool) -> tuple[Outcome, dict | None]:
    """Uma chamada direta (sem lote) para olhar a qualidade antes de gastar."""
    async with async_session_factory() as session:
        row = (await session.execute(
            select(Paper, ParsedContent)
            .join(ParsedContent, ParsedContent.paper_id == Paper.id)
            .where(Paper.arxiv_id == arxiv_id)
        )).first()
    if row is None:
        raise SystemExit(f"{arxiv_id}: sem texto extraído — rode prepare antes")
    paper, parsed = row

    client = AsyncAnthropic(api_key=api_key)
    started = time.perf_counter()
    async with client.messages.stream(**_params(paper, parsed, model, effort)) as stream:
        message = await stream.get_final_message()
    latency = int((time.perf_counter() - started) * 1000)
    await client.close()

    raw = _text_of(message)
    preview = json.loads(raw) if message.stop_reason not in ("refusal", "max_tokens") else None
    if not save:
        usage = message.usage.model_dump()
        try:
            decode = VisualDecode.model_validate(from_wire(json.loads(raw)))
            _, report = verify(decode, parsed.markdown or "")
            warnings = report.warnings + report.dropped
        except (ValidationError, ValueError) as e:
            warnings = [str(e)[:400]]
        return Outcome(arxiv_id, "previewed", cost_usd(model, usage, batch=False), warnings), preview
    outcome = await store(paper.id, arxiv_id, message, model, False, parsed.markdown or "", latency)
    return outcome, preview


# ---------------------------------------------------------------------- lote


def _state_path(batch_id: str) -> Path:
    return STATE_DIR / f"{batch_id}.json"


async def submit(limit: int, model: str, effort: str, api_key: str,
                 only: list[str] | None = None) -> dict:
    pairs = [(p, parsed) for p, parsed in await candidates(max(limit, len(only or [])) * 3, prepared_only=True)]
    if only:
        pairs = [pp for pp in pairs if pp[0].arxiv_id in set(only)]
    pairs = pairs[:limit]
    if not pairs:
        raise SystemExit("nenhum paper preparado sem decode visual")

    requests = [
        Request(custom_id=custom_id_for(p.arxiv_id),
                params=MessageCreateParamsNonStreaming(**_params(p, parsed, model, effort)))
        for p, parsed in pairs
    ]
    client = AsyncAnthropic(api_key=api_key)
    batch = await client.messages.batches.create(requests=requests)
    await client.close()

    STATE_DIR.mkdir(parents=True, exist_ok=True)
    state = {
        "batch_id": batch.id,
        "model": model,
        "effort": effort,
        "prompt": PROMPT_ID,
        "papers": {custom_id_for(p.arxiv_id): {"paper_id": p.id, "arxiv_id": p.arxiv_id} for p, _ in pairs},
    }
    _state_path(batch.id).write_text(json.dumps(state, indent=2))
    return {"batch_id": batch.id, "requests": len(requests), "status": batch.processing_status}


async def collect(batch_id: str, api_key: str, wait: bool) -> dict:
    state = json.loads(_state_path(batch_id).read_text())
    model = state["model"]
    client = AsyncAnthropic(api_key=api_key)

    async def status():
        # A espera pode durar horas: queda de rede não derruba a coleta
        for attempt in range(20):
            try:
                return await client.messages.batches.retrieve(batch_id)
            except (APIConnectionError, APITimeoutError) as e:
                logger.warning("visual.batch.retry", attempt=attempt, error=str(e)[:120])
                await asyncio.sleep(min(30 * (attempt + 1), 300))
        raise SystemExit("sem conexão com a API da Anthropic depois de 20 tentativas")

    batch = await status()
    while wait and batch.processing_status != "ended":
        counts = batch.request_counts
        logger.info("visual.batch.waiting", processing=counts.processing, succeeded=counts.succeeded)
        await asyncio.sleep(60)
        batch = await status()
    if batch.processing_status != "ended":
        await client.close()
        return {"batch_id": batch_id, "status": batch.processing_status,
                "counts": batch.request_counts.model_dump()}

    paper_ids = [v["paper_id"] for v in state["papers"].values()]
    async with async_session_factory() as session:
        texts = dict((await session.execute(
            select(ParsedContent.paper_id, ParsedContent.markdown).where(ParsedContent.paper_id.in_(paper_ids))
        )).all())

    outcomes: list[Outcome] = []
    async for item in await client.messages.batches.results(batch_id):
        meta = state["papers"].get(item.custom_id)
        if meta is None:
            continue
        kind = item.result.type
        if kind == "succeeded":
            outcomes.append(await store(meta["paper_id"], meta["arxiv_id"], item.result.message,
                                        model, True, texts.get(meta["paper_id"]) or ""))
        else:
            detail = getattr(getattr(item.result, "error", None), "error", None)
            outcomes.append(Outcome(meta["arxiv_id"], kind, detail=str(detail)[:300] if detail else None))
    await client.close()

    summary = {
        "batch_id": batch_id,
        "stored": sum(o.status == "stored" for o in outcomes),
        "usd": round(sum(o.cost_usd for o in outcomes), 3),
        "retry": [o.arxiv_id for o in outcomes if o.status != "stored"],
        "outcomes": [asdict(o) for o in outcomes],
    }
    state["collected"] = summary
    _state_path(batch_id).write_text(json.dumps(state, indent=2))
    return summary
