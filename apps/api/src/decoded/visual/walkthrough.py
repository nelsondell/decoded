"""
O passo a passo do método: o diagrama do paper aceso por etapas, com um
exemplo real do paper atravessando cada bloco.

É uma seção à parte ("walkthrough"), gerada depois do decode visual e a
partir dele — o hook e os passos entram no pedido para o passo a passo
contar a mesma história. Fica na parte aberta da página.

A regra de honestidade é determinística: um número do exemplo que não
aparece no texto do paper faz o exemplo inteiro virar "ilustrativo", e a
página diz isso.
"""

from __future__ import annotations

import asyncio
import json
import re
import time
from typing import Any, Literal

import httpx
import structlog
from anthropic import AsyncAnthropic
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
from anthropic.types.messages.batch_create_params import Request
from pydantic import Field, ValidationError
from sqlalchemy import and_, exists, select
from sqlalchemy.orm import aliased

from decoded.db.base import async_session_factory
from decoded.db.models import DecodedContent, Paper, ParsedContent
from decoded.db.repositories.decoded_contents import DecodedContentsRepository
from decoded.decoding.prompts import VERSION as PROMPT_VERSION
from decoded.visual import run, source
from decoded.visual.schemas import _drop_nulls, _drop_titles, _inline, _open_enums, _Strict
from decoded.visual.verify import _forms, _numbers_in

logger = structlog.get_logger()

SECTION = "walkthrough"
SCHEMA_ID = "walkthrough/1"
PROMPT_ID = "walkthrough-p2"
DEFAULT_MODEL = "claude-sonnet-5-5"
MAX_TOKENS = 12_000
# PDFs guardados fora do Git: o apêndice sai deles na hora de montar o pedido
PDF_DIR = run.STATE_DIR / "pdfs"

Kind = Literal["input", "data", "model", "process", "output"]
Format = Literal["text", "code", "numbers"]


# ------------------------------------------------------------------ schema


class WtNode(_Strict):
    id: str = Field(description="n1 to n7, unique.")
    label: str = Field(description="2 to 4 words: the paper's own name for this block.")
    kind: Kind


class WtEdge(_Strict):
    source: str
    target: str
    label: str = Field(description="1 or 2 words on the arrow, or empty.")


class WtStage(_Strict):
    title: str = Field(description="At most 4 words.")
    says: str = Field(description="At most 24 words: what this stage does and why it matters.")
    nodes: list[str] = Field(description="Ids of the 1 to 3 blocks this stage lights up.")
    example: str = Field(description="At most 35 words: what happens to the running example at this stage, with its concrete content.")
    example_format: Format


class Walkthrough(_Strict):
    example_title: str = Field(description="At most 8 words naming the running example.")
    example_source: str = Field(description="Where the example comes from in the paper (e.g. 'Figure 2', 'Table 4', 'Appendix C'), or 'constructed'.")
    illustrative: bool = Field(description="True when the paper shows no concrete example and this one was constructed.")
    input: str = Field(description="At most 40 words: the example's concrete input.")
    output: str = Field(description="At most 40 words: what the method produces for it.")
    nodes: list[WtNode]
    edges: list[WtEdge]
    stages: list[WtStage]


def output_schema() -> dict:
    schema = _drop_nulls(_drop_titles(Walkthrough.model_json_schema()))
    return _open_enums(_inline(schema, schema.get("$defs", {})))


def _choice(value: Any, allowed: tuple[str, ...], fallback: str) -> str:
    v = str(value or "").strip().lower()
    return v if v in allowed else fallback


def from_wire(data: dict) -> dict:
    """Valores de enum abertos no fio voltam para a lista; o resto passa."""
    out = dict(data)
    out["nodes"] = [{**n, "kind": _choice(n.get("kind"), Kind.__args__, "process")} for n in data.get("nodes", [])]
    out["stages"] = [
        {**s, "example_format": _choice(s.get("example_format"), Format.__args__, "text")}
        for s in data.get("stages", [])
    ]
    return out


# ------------------------------------------------------------------ prompt

SYSTEM = """You build the step-by-step walkthrough of one AI paper's method for Decoded. A technical reader who has not read the paper clicks through it: each stage lights up part of a diagram of the method, and one concrete example from the paper travels through the blocks. The goal is that after the last stage the reader could explain the mechanism to a colleague.

THE DIAGRAM
- 3 to 7 blocks (n1..n7), named with the paper's own terms (2 to 4 words). Data flows left to right in reading order.
- kind: input (what goes in), data (a store, memory or dataset), model (a network or LLM), process (a step or algorithm), output (what comes out).
- Edges follow the real flow. At most one edge may point backwards (a loop). Edge labels are 1 or 2 words, or empty. No edge from a block to itself.

THE RUNNING EXAMPLE
- Use the most concrete example the paper itself gives. Look in the appendix first: qualitative examples, transcripts, prompts, case studies and worked problems usually live there. Then figures, tables and the main text.
- Keep its specifics: the actual question text, the actual values, the actual tool call or retrieved passage, shortened to fit. Name where it comes from in example_source ("Appendix C.2", "Figure 3", "Table 2").
- Only if the paper shows no concrete instance: construct one, set illustrative to true and example_source to "constructed". Even then it is an instance, never a description: write an actual question, an actual call, actual inputs ("Find all real x with x^2 - 5x + 6 = 0", not "a MATH-style problem").
- Never present a constructed value as a result. Numbers you write must be copied from the paper.

THE STAGES
- 3 to 6 stages in the order the method runs. Each lights the 1 to 3 blocks doing the work at that moment (never zero); together the stages cover every block, and the last stage lights the output block.
- title: at most 4 words. says: at most 24 words on what happens and why it matters (the mechanism, not a restatement of the title). example: at most 35 words on what happens to the running example at exactly this point, with its intermediate content (the hidden step, the call, the score, the retrieved passage).
- example_format: code for tool calls, tokens, code or structured data; numbers when the stage computes values; text otherwise.
- The first stage starts from the input; the last stage ends at the output.

HOW TO WRITE
- Plain, specific, present tense. No marketing words (novel, powerful, groundbreaking, seamless), no "this paper", no "we".
- Do not repeat the hook. Define nothing in parentheses; say it plainly.

Before answering, check: every stage's nodes exist in the diagram; edges connect existing blocks; every number in input, output and the examples appears in the paper; the walkthrough agrees with the steps you were given."""


def user_message(paper: Paper, visual: dict, text: str, appendix: str) -> str:
    steps = "\n".join(f"- {s.get('title')}: {s.get('text')}" for s in visual.get("steps", []))
    return (
        f"<title>{paper.title}</title>\n"
        f"<abstract>{paper.abstract or ''}</abstract>\n"
        f"<hook>{visual.get('hook', '')}</hook>\n"
        f"<steps>\n{steps}\n</steps>\n"
        f"<paper>\n{text}\n</paper>"
        + (f"\n<appendix>\n{appendix}\n</appendix>" if appendix else "")
    )


# ----------------------------------------------------------------- conferência

WORD_LIMITS = {"example_title": 8, "input": 40, "output": 40, "stage.title": 4, "stage.says": 24, "stage.example": 35}


def _words(text: str) -> int:
    return len(text.split())


def verify(w: Walkthrough, source_text: str) -> tuple[Walkthrough, list[str], list[str]]:
    """Devolve (limpo, avisos, motivos para descartar)."""
    w = w.model_copy(deep=True)
    warnings: list[str] = []
    dropped: list[str] = []

    seen: set[str] = set()
    w.nodes = [n for n in w.nodes[:7] if not (n.id in seen or seen.add(n.id))]
    ids = {n.id for n in w.nodes}
    before = len(w.edges)
    w.edges = [e for e in w.edges if e.source in ids and e.target in ids and e.source != e.target]
    if len(w.edges) < before:
        warnings.append(f"{before - len(w.edges)} arestas soltas removidas")

    for s in w.stages:
        s.nodes = [n for n in s.nodes if n in ids][:3]
    # Última etapa sem bloco: é a da resposta, acende a saída
    outputs = [n.id for n in w.nodes if n.kind == "output"]
    if w.stages and not w.stages[-1].nodes and outputs:
        w.stages[-1].nodes = outputs[:1]
    w.stages = [s for s in w.stages if s.nodes][:6]
    if len(w.nodes) < 3 or len(w.stages) < 3 or not w.edges:
        dropped.append(f"diagrama ou etapas insuficientes ({len(w.nodes)} blocos, {len(w.stages)} etapas)")

    unlit = ids - {n for s in w.stages for n in s.nodes}
    if unlit:
        warnings.append(f"blocos sem etapa: {sorted(unlit)}")

    for label, text, key in [("example_title", w.example_title, "example_title"),
                             ("input", w.input, "input"), ("output", w.output, "output")]:
        if _words(text) > WORD_LIMITS[key]:
            warnings.append(f"{label}: {_words(text)} palavras")
    for i, s in enumerate(w.stages):
        for field, key in [("title", "stage.title"), ("says", "stage.says"), ("example", "stage.example")]:
            n = _words(getattr(s, field))
            if n > WORD_LIMITS[key]:
                warnings.append(f"stage {i + 1}.{field}: {n} palavras")

    # Exemplo "do paper" só se todo número dele estiver no paper
    if not w.illustrative:
        printed = _numbers_in(source_text)
        texts = [w.input, w.output, *(s.example for s in w.stages)]
        missing = sorted({
            m.group(0) for t in texts for m in re.finditer(r"-?\d+(?:[.,]\d+)?", t)
            if not (_forms(float(m.group(0).replace(",", ""))) & printed)
        })
        if missing:
            w.illustrative = True
            warnings.append(f"exemplo marcado como ilustrativo: {missing[:5]} não estão no paper")
    return w, warnings, dropped


# ---------------------------------------------------------------------- run


def custom_id_for(arxiv_id: str) -> str:
    return "w-" + re.sub(r"[^a-zA-Z0-9_-]", "_", arxiv_id)[:60]


async def candidates(limit: int, only: list[str] | None = None) -> list[tuple[Paper, ParsedContent, dict]]:
    """Papers com decode visual e texto extraído, ainda sem passo a passo."""
    visual = aliased(DecodedContent)
    has_walkthrough = exists().where(
        DecodedContent.paper_id == Paper.id,
        DecodedContent.section == SECTION,
        DecodedContent.prompt_version == PROMPT_VERSION,
    )
    stmt = (
        select(Paper, ParsedContent, visual.content)
        .join(ParsedContent, ParsedContent.paper_id == Paper.id)
        .join(visual, and_(visual.paper_id == Paper.id, visual.section == run.SECTION,
                           visual.prompt_version == PROMPT_VERSION))
        .where(~has_walkthrough)
        .order_by(Paper.priority_score.desc().nulls_last(), Paper.published_at.desc())
    )
    if only:
        stmt = stmt.where(Paper.arxiv_id.in_(only))
    async with async_session_factory() as session:
        rows = (await session.execute(stmt.limit(limit))).all()
    return [(p, parsed, content) for p, parsed, content in rows]


def _pdf_path(arxiv_id: str):
    return PDF_DIR / (re.sub(r"[^a-zA-Z0-9._-]", "_", arxiv_id) + ".pdf")


async def fetch_pdfs(arxiv_ids: list[str]) -> dict:
    """Baixa do arXiv os PDFs que faltam no cache (grátis, um a cada 3 s)."""
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    missing = [i for i in arxiv_ids if not _pdf_path(i).exists()]
    failed: list[str] = []
    async with httpx.AsyncClient(headers={"User-Agent": "decoded-visual/1 (+https://readdecoded.com)"}) as client:
        for n, arxiv_id in enumerate(missing):
            if n:
                await asyncio.sleep(run.ARXIV_DELAY_S)
            try:
                _pdf_path(arxiv_id).write_bytes(await source.fetch_pdf(client, arxiv_id))
            except Exception as e:  # um PDF fora do ar não para o resto
                failed.append(arxiv_id)
                logger.warning("walkthrough.pdf_failed", arxiv_id=arxiv_id, error=str(e)[:160])
    return {"cached": len(arxiv_ids) - len(missing), "downloaded": len(missing) - len(failed), "failed": failed}


def _appendix(arxiv_id: str) -> str:
    path = _pdf_path(arxiv_id)
    return source.appendix(path.read_bytes()) if path.exists() else ""


def _params(paper: Paper, parsed: ParsedContent, visual: dict, model: str, effort: str) -> dict:
    content = user_message(paper, visual, parsed.markdown or "", _appendix(paper.arxiv_id))
    return {
        "model": model,
        "max_tokens": MAX_TOKENS,
        "system": [{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}],
        "messages": [{"role": "user", "content": content}],
        "output_config": {"effort": effort, "format": {"type": "json_schema", "schema": output_schema()}},
    }


def estimate(rows: list[tuple[Paper, ParsedContent, dict]], model: str, output_tokens: int) -> dict:
    system_tokens = int((len(SYSTEM) + len(json.dumps(output_schema()))) / run.CHARS_PER_TOKEN)
    inputs = [int((len(parsed.markdown or "") + len(p.abstract or "") + len(_appendix(p.arxiv_id)))
                  / run.CHARS_PER_TOKEN) + 500
              for p, parsed, _ in rows]
    usage = {
        "input_tokens": sum(inputs),
        "cache_read_input_tokens": system_tokens * max(len(rows) - 1, 0),
        "cache_creation_input_tokens": system_tokens,
        "output_tokens": output_tokens * len(rows),
    }
    total = run.cost_usd(model, usage, batch=True)
    return {"papers": len(rows), "model": model, "usd_total": round(total, 2),
            "usd_per_paper": round(total / max(len(rows), 1), 3)}


async def store(paper_id: int, arxiv_id: str, message, model: str, batch: bool, source_text: str,
                latency_ms: int = 0) -> run.Outcome:
    usage = message.usage.model_dump() if message.usage else {}
    cost = run.cost_usd(model, usage, batch=batch)
    if message.stop_reason == "refusal":
        return run.Outcome(arxiv_id, "refused", cost)
    if message.stop_reason == "max_tokens":
        return run.Outcome(arxiv_id, "truncated", cost)
    try:
        w = Walkthrough.model_validate(from_wire(json.loads(run._text_of(message))))
    except (ValidationError, ValueError) as e:
        return run.Outcome(arxiv_id, "invalid", cost, detail=str(e)[:400])

    clean, warnings, dropped = verify(w, source_text)
    if dropped:
        return run.Outcome(arxiv_id, "invalid", cost, warnings, "; ".join(dropped))

    content = {"schema": SCHEMA_ID, "prompt": PROMPT_ID, **clean.model_dump(), "warnings": warnings}
    async with async_session_factory() as session:
        await DecodedContentsRepository(session).upsert_section(
            paper_id=paper_id, section=SECTION, content=content, model=model,
            prompt_version=PROMPT_VERSION,
            input_tokens=usage.get("input_tokens", 0) + (usage.get("cache_read_input_tokens") or 0)
            + (usage.get("cache_creation_input_tokens") or 0),
            output_tokens=usage.get("output_tokens", 0), cost_usd=cost, latency_ms=latency_ms,
        )
        await session.commit()
    return run.Outcome(arxiv_id, "stored", cost, warnings)


async def trial(arxiv_id: str, model: str, effort: str, api_key: str, save: bool) -> tuple[run.Outcome, dict | None]:
    rows = await candidates(1, only=[arxiv_id])
    if not rows:
        raise SystemExit(f"{arxiv_id}: sem decode visual, sem texto ou já com passo a passo")
    paper, parsed, visual = rows[0]
    await fetch_pdfs([arxiv_id])

    client = AsyncAnthropic(api_key=api_key)
    started = time.perf_counter()
    async with client.messages.stream(**_params(paper, parsed, visual, model, effort)) as stream:
        message = await stream.get_final_message()
    latency = int((time.perf_counter() - started) * 1000)
    await client.close()

    preview = json.loads(run._text_of(message)) if message.stop_reason not in ("refusal", "max_tokens") else None
    if save:
        return await store(paper.id, arxiv_id, message, model, False, parsed.markdown or "", latency), preview
    usage = message.usage.model_dump()
    try:
        _, warnings, dropped = verify(Walkthrough.model_validate(from_wire(preview or {})), parsed.markdown or "")
    except (ValidationError, ValueError) as e:
        warnings, dropped = [str(e)[:400]], []
    return run.Outcome(arxiv_id, "previewed", run.cost_usd(model, usage, batch=False), warnings + dropped), preview


async def submit(limit: int, model: str, effort: str, api_key: str, only: list[str] | None = None) -> dict:
    rows = await candidates(limit, only)
    if not rows:
        raise SystemExit("nenhum paper com decode visual sem passo a passo")
    fetched = await fetch_pdfs([p.arxiv_id for p, _, _ in rows])
    logger.info("walkthrough.pdfs", **{k: v for k, v in fetched.items() if k != "failed"}, failed=len(fetched["failed"]))
    requests = [
        Request(custom_id=custom_id_for(p.arxiv_id),
                params=MessageCreateParamsNonStreaming(**_params(p, parsed, visual, model, effort)))
        for p, parsed, visual in rows
    ]
    client = AsyncAnthropic(api_key=api_key)
    batch = await client.messages.batches.create(requests=requests)
    await client.close()

    run.STATE_DIR.mkdir(parents=True, exist_ok=True)
    state = {
        "batch_id": batch.id, "kind": SECTION, "model": model, "effort": effort, "prompt": PROMPT_ID,
        "papers": {custom_id_for(p.arxiv_id): {"paper_id": p.id, "arxiv_id": p.arxiv_id} for p, _, _ in rows},
    }
    run._state_path(batch.id).write_text(json.dumps(state, indent=2))
    return {"batch_id": batch.id, "requests": len(requests), "status": batch.processing_status}
