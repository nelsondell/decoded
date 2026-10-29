"""
O texto do paper que vai para o modelo, extraído localmente com PyMuPDF.

O LlamaParse custa por página e devolve mais do que o decode visual usa.
Aqui o PDF vem do arXiv, o texto sai página a página, as referências caem
fora e o resultado é cortado num teto de caracteres — o custo de entrada
de cada paper fica previsível.
"""

from __future__ import annotations

import re
import time
from dataclasses import dataclass

import pymupdf
import httpx

PARSER_NAME = "pymupdf"

# ~4 caracteres por token: 96k caracteres ficam perto de 24k tokens
MAX_CHARS = 96_000

_REFS = re.compile(r"^\s*(references|bibliography|works cited)\s*$", re.IGNORECASE | re.MULTILINE)
_APPENDIX = re.compile(r"^\s*(appendix|appendices|supplementary material)\b", re.IGNORECASE | re.MULTILINE)
_CAPTION = re.compile(r"^\s*((?:figure|fig\.|table)\s*\d+\s*[.:|])", re.IGNORECASE)
_HYPHEN_BREAK = re.compile(r"(\w)-\n(\w)")
# Primeira seção de apêndice sem cabeçalho "Appendix": "A Implementation details"
_SECTION_A = re.compile(r"^\s*A\.?\s+[A-Z][^\n]{3,80}$", re.MULTILINE)

# O começo do apêndice: é onde os papers põem os exemplos concretos
APPENDIX_CHARS = 24_000
# NUL e outros controles que vêm de fontes embutidas; o Postgres recusa NUL
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


@dataclass
class SourceText:
    text: str
    pages: int
    captions: list[str]
    truncated: bool
    parse_ms: int


def pdf_url_for(arxiv_id: str) -> str:
    return f"https://arxiv.org/pdf/{arxiv_id}"


async def fetch_pdf(client: httpx.AsyncClient, arxiv_id: str) -> bytes:
    res = await client.get(pdf_url_for(arxiv_id), follow_redirects=True, timeout=60)
    res.raise_for_status()
    if not res.content.startswith(b"%PDF"):
        raise ValueError(f"{arxiv_id}: resposta não é um PDF")
    return res.content


def _cut_tail(text: str) -> str:
    """
    Corta no primeiro cabeçalho de referências ou apêndice depois de 30% do
    texto — antes disso é provável que seja o sumário ou uma menção solta.
    """
    floor = int(len(text) * 0.3)
    starts = [
        m.start()
        for pattern in (_REFS, _APPENDIX)
        for m in pattern.finditer(text)
        if m.start() > floor
    ]
    return text[: min(starts)] if starts else text


def _pages(pdf_bytes: bytes) -> list[str]:
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    try:
        # Sem sort: a ordem do PDF respeita as colunas; sort=True mistura as duas
        return [page.get_text("text") for page in doc]
    finally:
        doc.close()


def _tidy(text: str) -> str:
    text = re.sub(r"[ \t]+", " ", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def appendix(pdf_bytes: bytes) -> str:
    """
    O começo do apêndice, sem as referências: exemplos qualitativos,
    transcrições, prompts e estudos de caso costumam morar ali. Vazio
    quando o paper não tem apêndice reconhecível.
    """
    raw = _HYPHEN_BREAK.sub(r"\1\2", _CONTROL.sub("", "\n".join(_pages(pdf_bytes))))
    floor = int(len(raw) * 0.3)
    start = next((m.start() for m in _APPENDIX.finditer(raw) if m.start() > floor), None)
    if start is None:
        refs = next((m for m in _REFS.finditer(raw) if m.start() > floor), None)
        section_a = _SECTION_A.search(raw, refs.end()) if refs else None
        start = section_a.start() if section_a else None
    return _tidy(raw[start:])[:APPENDIX_CHARS] if start is not None else ""


def extract(pdf_bytes: bytes) -> SourceText:
    started = time.perf_counter()
    pages = _pages(pdf_bytes)

    raw = _CONTROL.sub("", "\n".join(pages))
    raw = _HYPHEN_BREAK.sub(r"\1\2", raw)
    body = _tidy(_cut_tail(raw))

    captions = [
        line.strip()[:240]
        for line in body.splitlines()
        if _CAPTION.match(line)
    ]

    truncated = len(body) > MAX_CHARS
    if truncated:
        body = body[:MAX_CHARS]

    return SourceText(
        text=body,
        pages=len(pages),
        captions=captions[:24],
        truncated=truncated,
        parse_ms=int((time.perf_counter() - started) * 1000),
    )
