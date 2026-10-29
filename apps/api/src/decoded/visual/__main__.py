"""
Linha de comando do decode visual. Rode de apps/api (lê o .env de lá):

    python -m decoded.visual seed-hn --days 90         # arXiv citado no Hacker News (grátis)
    python -m decoded.visual ingest --days 7          # arXiv + enriquecimento (grátis)
    python -m decoded.visual prepare --limit 120      # baixa e extrai PDFs (grátis)
    python -m decoded.visual estimate --limit 100 --model claude-opus-5-5
    python -m decoded.visual trial 2610.01234         # uma chamada direta, sem gravar
    python -m decoded.visual submit --limit 100       # lote, 50% mais barato
    python -m decoded.visual collect <batch_id> --wait

    Passo a passo do método (depois do decode visual):
    python -m decoded.visual wt-prepare --limit 130   # PDFs para o apêndice (grátis)
    python -m decoded.visual wt-estimate --limit 130
    python -m decoded.visual wt-trial 2610.01234 --save
    python -m decoded.visual wt-submit --limit 130    # coletado pelo mesmo collect
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys

from decoded.config import settings
from decoded.visual import run

MODELS = sorted(run.PRICES)


def _key() -> str:
    if not settings.anthropic_api_key:
        sys.exit("ANTHROPIC_API_KEY ausente em apps/api/.env")
    return settings.anthropic_api_key


def _print(data) -> None:
    print(json.dumps(data, indent=2, ensure_ascii=False, default=str))


async def _ingest(days: int, max_results: int, enrich: int) -> dict:
    from decoded.ingestion.arxiv_poller import run_arxiv_poll
    from decoded.ingestion.enricher import enrich_pending_papers

    polled = await run_arxiv_poll(lookback_hours=24 * days, max_results=max_results)
    enriched = await enrich_pending_papers(
        limit=enrich,
        openalex_email=settings.openalex_email,
        s2_api_key=settings.semantic_scholar_api_key,
    )
    return {"poll": polled, "enrich": enriched}


async def _estimate(limit: int, model: str, output_tokens: int) -> dict:
    pairs = [(p, parsed) for p, parsed in await run.candidates(limit, prepared_only=True)]
    return run.estimate(pairs, model, output_tokens)


async def _pick(limit: int) -> list[dict]:
    rows = await run.candidates(limit, prepared_only=False)
    return [{
        "arxiv_id": p.arxiv_id,
        "priority": round(p.priority_score or 0, 3),
        "prepared": bool(parsed and parsed.parser == "pymupdf"),
        "title": p.title[:90],
    } for p, parsed in rows]


def main() -> None:
    ap = argparse.ArgumentParser(prog="python -m decoded.visual")
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("ingest"); s.add_argument("--days", type=int, default=7)
    s.add_argument("--max-results", type=int, default=400); s.add_argument("--enrich", type=int, default=400)

    s = sub.add_parser("seed-hn"); s.add_argument("--days", type=int, default=90)
    s.add_argument("--min-yymm", type=int, default=2607, help="ids do arXiv a partir deste mês (aamm)")
    s.add_argument("--min-points", type=int, default=5)

    s = sub.add_parser("pick"); s.add_argument("--limit", type=int, default=40)
    s = sub.add_parser("prepare"); s.add_argument("--limit", type=int, default=40)

    s = sub.add_parser("estimate"); s.add_argument("--limit", type=int, default=100)
    s.add_argument("--model", choices=MODELS, default="claude-opus-5-5")
    s.add_argument("--output-tokens", type=int, default=3000,
                   help="saída média prevista por paper, incluindo o raciocínio")

    s = sub.add_parser("trial"); s.add_argument("arxiv_id")
    s.add_argument("--model", choices=MODELS, default="claude-opus-5-5")
    s.add_argument("--effort", default="medium", choices=["low", "medium", "high"])
    s.add_argument("--save", action="store_true", help="grava no banco se passar no verify")

    s = sub.add_parser("submit"); s.add_argument("--limit", type=int, default=20)
    s.add_argument("--model", choices=MODELS, default="claude-opus-5-5")
    s.add_argument("--effort", default="medium", choices=["low", "medium", "high"])
    s.add_argument("--only", nargs="*", help="arxiv ids específicos")

    s = sub.add_parser("collect"); s.add_argument("batch_id"); s.add_argument("--wait", action="store_true")

    from decoded.visual import walkthrough as wt
    s = sub.add_parser("wt-prepare"); s.add_argument("--limit", type=int, default=130)
    s = sub.add_parser("wt-estimate"); s.add_argument("--limit", type=int, default=130)
    s.add_argument("--model", choices=MODELS, default=wt.DEFAULT_MODEL)
    s.add_argument("--output-tokens", type=int, default=3000)

    s = sub.add_parser("wt-trial"); s.add_argument("arxiv_id")
    s.add_argument("--model", choices=MODELS, default=wt.DEFAULT_MODEL)
    s.add_argument("--effort", default="medium", choices=["low", "medium", "high"])
    s.add_argument("--save", action="store_true", help="grava no banco se passar na conferência")

    s = sub.add_parser("wt-submit"); s.add_argument("--limit", type=int, default=130)
    s.add_argument("--model", choices=MODELS, default=wt.DEFAULT_MODEL)
    s.add_argument("--effort", default="medium", choices=["low", "medium", "high"])
    s.add_argument("--only", nargs="*", help="arxiv ids específicos")

    a = ap.parse_args()
    if a.cmd == "ingest":
        _print(asyncio.run(_ingest(a.days, a.max_results, a.enrich)))
    elif a.cmd == "seed-hn":
        from decoded.visual.seed import seed_from_hn
        _print(asyncio.run(seed_from_hn(a.days, a.min_yymm, a.min_points)))
    elif a.cmd == "pick":
        _print(asyncio.run(_pick(a.limit)))
    elif a.cmd == "prepare":
        _print(asyncio.run(run.prepare(a.limit)))
    elif a.cmd == "estimate":
        _print(asyncio.run(_estimate(a.limit, a.model, a.output_tokens)))
    elif a.cmd == "trial":
        outcome, preview = asyncio.run(run.trial(a.arxiv_id, a.model, a.effort, _key(), a.save))
        _print({"outcome": outcome.__dict__, "decode": preview})
    elif a.cmd == "submit":
        _print(asyncio.run(run.submit(a.limit, a.model, a.effort, _key(), a.only)))
    elif a.cmd == "collect":
        _print(asyncio.run(run.collect(a.batch_id, _key(), a.wait)))
    elif a.cmd == "wt-prepare":
        rows = asyncio.run(wt.candidates(a.limit))
        _print(asyncio.run(wt.fetch_pdfs([p.arxiv_id for p, _, _ in rows])))
    elif a.cmd == "wt-estimate":
        _print(wt.estimate(asyncio.run(wt.candidates(a.limit)), a.model, a.output_tokens))
    elif a.cmd == "wt-trial":
        outcome, preview = asyncio.run(wt.trial(a.arxiv_id, a.model, a.effort, _key(), a.save))
        _print({"outcome": outcome.__dict__, "walkthrough": preview})
    elif a.cmd == "wt-submit":
        _print(asyncio.run(wt.submit(a.limit, a.model, a.effort, _key(), a.only)))


if __name__ == "__main__":
    main()
