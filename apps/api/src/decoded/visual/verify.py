"""
Conferência determinística do decode visual — nenhuma chamada a modelo.

A saída estruturada garante o formato; aqui entram as regras que o schema
da API não aceita: limites de palavras e itens, ids do fluxo que existem,
faixas do simulador que fazem sentido e, principalmente, números que
aparecem no texto do paper. O que não confere sai do decode (stat ou
results viram null) em vez de ir para a página.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from decoded.visual.schemas import VisualDecode

_WS = re.compile(r"\s+")
_NUM = re.compile(r"-?\d+(?:[.,]\d+)?")

STEP_ORDER = ("problem", "approach", "result")

# (caminho, limite de palavras) — o mesmo que o prompt pede
WORD_LIMITS = {
    "hook": 16,
    "stat.label": 6,
    "stat.context": 12,
    "step.title": 4,
    "step.text": 22,
    "results.caption": 10,
    "sim.question": 14,
    "sim.takeaway": 16,
    "term.plain": 14,
    "analogy.text": 30,
    "limit": 14,
    "deep.body": 45,
}


@dataclass
class Report:
    warnings: list[str] = field(default_factory=list)
    dropped: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.dropped


def _norm(text: str) -> str:
    # O PDF imprime o menos tipográfico (−16); o modelo devolve -16
    return _WS.sub(" ", text.replace("\u2212", "-")).strip().lower()


def _words(text: str | None) -> int:
    return len(text.split()) if text else 0


def _numbers_in(text: str) -> set[str]:
    # 1,045 pode ser milhar ou decimal: guarda as duas leituras
    found = [m.group(0) for m in _NUM.finditer(text.replace("\u2212", "-"))]
    return {n.replace(",", ".") for n in found} | {n.replace(",", "") for n in found}


def _forms(value: float) -> set[str]:
    """Os jeitos como um valor pode estar impresso: 71.5, 71.50, 0.715 → 71.5."""
    out = {f"{value:g}", f"{value:.1f}", f"{value:.2f}", f"{value:.3f}"}
    if float(value).is_integer():
        out |= {str(int(value)), f"{int(value):,}"}
    if 0 < abs(value) < 1:
        pct = value * 100
        out |= {f"{pct:g}", f"{pct:.1f}"}
    return out


def _printed(value: str | float, numbers: set[str]) -> bool:
    if isinstance(value, str):
        found = _NUM.search(value)
        if not found:
            return False
        try:
            value = float(found.group(0).replace(",", "."))
        except ValueError:
            return False
    return bool(_forms(float(value)) & numbers)


def _positions(value: float, source_norm: str) -> list[int]:
    out: list[int] = []
    for form in _forms(value):
        out += [m.start() for m in re.finditer(rf"(?<![\d.]){re.escape(form)}(?![\d])", source_norm)]
    return out


def _same_table(values: list[float], source_norm: str, window: int = 2400) -> list[bool]:
    """
    As linhas de um gráfico de resultados vêm de uma tabela só, então os
    valores têm que aparecer juntos num trecho curto do texto. Acha o trecho
    que contém mais deles e marca quais estão lá — um número solto que
    aparece em outro canto do paper não conta.
    """
    spots = [_positions(v, source_norm) for v in values]
    best: list[bool] = [False] * len(values)
    for anchor in sorted({p for ps in spots for p in ps}):
        inside = [any(anchor <= p <= anchor + window for p in ps) for ps in spots]
        if sum(inside) > sum(best):
            best = inside
    return best


def _quote_found(quote: str, source_norm: str) -> bool:
    """Citação literal, tolerando espaços e quebras do PDF; aceita metade inicial."""
    q = _norm(quote)
    if not q:
        return False
    if q in source_norm:
        return True
    head = q[: max(24, len(q) // 2)]
    return head in source_norm


def verify(decode: VisualDecode, source_text: str) -> tuple[VisualDecode, Report]:
    """Devolve uma cópia limpa do decode e o que foi ajustado ou removido."""
    d = decode.model_copy(deep=True)
    r = Report()
    numbers = _numbers_in(source_text)
    source_norm = _norm(source_text)

    def over(label: str, text: str | None, limit_key: str) -> None:
        limit = WORD_LIMITS[limit_key]
        n = _words(text)
        if n > limit:
            r.warnings.append(f"{label}: {n} palavras (limite {limit})")

    if not d.hook.strip():
        r.dropped.append("hook vazio")
    over("hook", d.hook, "hook")

    # --- número principal
    if d.stat is not None:
        over("stat.label", d.stat.label, "stat.label")
        over("stat.context", d.stat.context, "stat.context")
        if not _printed(d.stat.value, numbers):
            r.warnings.append(f"stat removido: {d.stat.value!r} não aparece no texto")
            d.stat = None
        elif d.stat.baseline_value and not _printed(d.stat.baseline_value, numbers):
            r.warnings.append(f"baseline do stat removido: {d.stat.baseline_value!r}")
            d.stat.baseline_value = None
            d.stat.baseline_label = None
        if d.stat is not None and not _quote_found(d.stat.source_quote, source_norm):
            r.warnings.append("stat.source_quote não é literal")

    # --- três passos, na ordem
    by_kind = {s.kind: s for s in d.steps}
    if all(k in by_kind for k in STEP_ORDER):
        d.steps = [by_kind[k] for k in STEP_ORDER]
    else:
        r.dropped.append(f"steps incompletos: {[s.kind for s in d.steps]}")
    for s in d.steps:
        over(f"step.{s.kind}.title", s.title, "step.title")
        over(f"step.{s.kind}.text", s.text, "step.text")

    # --- fluxo: arestas só entre nós que existem
    if d.flow is not None:
        d.flow.nodes = d.flow.nodes[:6]
        ids = {n.id for n in d.flow.nodes}
        before = len(d.flow.edges)
        d.flow.edges = [e for e in d.flow.edges if e.source in ids and e.target in ids and e.source != e.target]
        if len(d.flow.edges) < before:
            r.warnings.append(f"flow: {before - len(d.flow.edges)} arestas soltas removidas")
        if len(d.flow.nodes) < 3 or not d.flow.edges:
            r.warnings.append("flow removido: menos de 3 nós ou sem arestas")
            d.flow = None

    # --- resultados: os valores têm que estar impressos no paper
    if d.results is not None:
        rows = d.results.rows[:8]
        inside = _same_table([row.value for row in rows], source_norm)
        found = [row for row, ok in zip(rows, inside) if ok]
        missing = len(rows) - len(found)
        if missing:
            r.warnings.append(f"results: {missing} de {len(rows)} valores fora da tabela de origem")
        # Benchmark ou levantamento não tem "o nosso"; quando o modelo marca um, ele precisa conferir
        claims_ours = any(row.ours for row in rows)
        if len(found) < 2 or missing > len(rows) // 3 or (claims_ours and not any(row.ours for row in found)):
            r.warnings.append("results removido: valores não conferem")
            d.results = None
        else:
            d.results.rows = found
            over("results.caption", d.results.caption, "results.caption")
            if not _quote_found(d.results.source_quote, source_norm):
                r.warnings.append("results.source_quote não é literal")

    # --- palpite: só com resultados para conferir e resposta que existe
    if d.predict is not None:
        p = d.predict
        p.options = p.options[:4]
        if (d.results is None and d.stat is None) or len(p.options) < 2 or not 0 <= p.answer < len(p.options):
            r.warnings.append("predict removido")
            d.predict = None

    # --- simulador: faixas coerentes, sem formas fora do lugar
    sim = d.sim
    if sim.template != "none":
        if sim.x_min >= sim.x_max:
            r.warnings.append("sim: x_min >= x_max, trocado por none")
            sim.template = "none"
        else:
            sim.x_default = min(max(sim.x_default, sim.x_min), sim.x_max)
            if sim.paper_x is not None and not (sim.x_min <= sim.paper_x <= sim.x_max):
                sim.paper_x = None
                sim.paper_note = None
    if sim.template != "tradeoff_curve":
        sim.shape = None
    elif sim.shape is None:
        sim.shape = "saturating"
    if sim.template == "sampling_temperature" and len(sim.values) != len(sim.labels):
        n = min(len(sim.values), len(sim.labels))
        if n < 2:
            r.warnings.append("sim: sampling_temperature sem rótulos/valores, trocado por none")
            sim.template = "none"
        sim.labels, sim.values = sim.labels[:n], sim.values[:n]
    sim.labels = sim.labels[:6]
    over("sim.question", sim.question, "sim.question")
    over("sim.takeaway", sim.takeaway, "sim.takeaway")

    # --- o resto, cortado no tamanho
    d.terms = d.terms[:6]
    for t in d.terms:
        over(f"term {t.term}", t.plain, "term.plain")
    if d.analogy is not None:
        over("analogy", d.analogy.text, "analogy.text")
    d.limits = d.limits[:3]
    for i, lim in enumerate(d.limits):
        over(f"limit {i + 1}", lim, "limit")
    d.deep = d.deep[:5]
    for part in d.deep:
        over(f"deep {part.heading}", part.body, "deep.body")

    return d, r
