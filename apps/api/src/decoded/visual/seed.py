"""
Semente de papers pelo que as pessoas discutem: arXiv no Hacker News.

O poll diário pega tudo que sai; para abrir o site com papers que alguém
já quer ler, a busca pública do HN (Algolia, sem chave) lista as histórias
com link para o arXiv. Os ids recentes viram papers FETCHED, e o
enriquecimento de sempre calcula a prioridade.
"""

from __future__ import annotations

import asyncio
import re
import time
from collections import defaultdict

import arxiv
import httpx
import structlog

from decoded.db.base import async_session_factory
from decoded.db.repositories.papers import PapersRepository
from decoded.ingestion.arxiv_poller import _result_to_dict

logger = structlog.get_logger()

ALGOLIA = "https://hn.algolia.com/api/v1/search_by_date"
_ARXIV_ID = re.compile(r"arxiv\.org/(?:abs|pdf|html)/(\d{4}\.\d{4,5})")
WINDOW_DAYS = 10  # a Algolia devolve no máximo 1000 resultados por busca


def _wanted(categories: list[str]) -> bool:
    return any(c.startswith("cs.") or c == "stat.ML" for c in categories)


async def _hn_arxiv_points(days: int, min_yymm: int) -> dict[str, int]:
    """Pontos somados por id do arXiv, em janelas para não bater o teto da busca."""
    now = int(time.time())
    points: dict[str, int] = defaultdict(int)
    async with httpx.AsyncClient(timeout=30) as client:
        for start in range(now - days * 86400, now, WINDOW_DAYS * 86400):
            end = min(start + WINDOW_DAYS * 86400, now)
            res = await client.get(ALGOLIA, params={
                "query": "arxiv.org",
                "restrictSearchableAttributes": "url",
                "tags": "story",
                "numericFilters": f"created_at_i>{start},created_at_i<={end}",
                "hitsPerPage": 1000,
            })
            res.raise_for_status()
            for hit in res.json().get("hits", []):
                m = _ARXIV_ID.search(hit.get("url") or "")
                if m and int(m.group(1)[:4]) >= min_yymm:
                    points[m.group(1)] += int(hit.get("points") or 0)
    return dict(points)


def _fetch(ids: list[str]) -> list[arxiv.Result]:
    client = arxiv.Client(page_size=100, delay_seconds=3.0, num_retries=3)
    out: list[arxiv.Result] = []
    for i in range(0, len(ids), 100):
        out += list(client.results(arxiv.Search(id_list=ids[i : i + 100], max_results=100)))
    return out


async def seed_from_hn(days: int, min_yymm: int, min_points: int) -> dict:
    points = await _hn_arxiv_points(days, min_yymm)
    ids = sorted((i for i, p in points.items() if p >= min_points), key=lambda i: -points[i])
    results = await asyncio.to_thread(_fetch, ids)

    added = skipped = 0
    async with async_session_factory() as session:
        repo = PapersRepository(session)
        for result in results:
            data = _result_to_dict(result)
            if not _wanted(data["categories"]):
                skipped += 1
                continue
            _, created = await repo.upsert(data)
            added += int(created)
        await session.commit()

    logger.info("visual.seed_hn", found=len(points), kept=len(ids), added=added, off_topic=skipped)
    return {"hn_arxiv_ids": len(points), f"with_{min_points}+_points": len(ids),
            "added": added, "off_topic": skipped}
