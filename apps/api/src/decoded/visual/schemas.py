"""
O decode visual: uma chamada por paper, um JSON que a página desenha.

Substitui as seis seções em prosa por pouco texto e muita forma: uma frase,
o número que importa, três passos, o fluxo do método, os resultados do
próprio paper e um mini simulador escolhido de um catálogo fixo. O
simulador não é código gerado — o modelo só escolhe o modelo de simulação
e preenche rótulos e faixas; o código é nosso, no frontend.

Os limites de tamanho (palavras, itens) não entram no schema enviado à API,
que não aceita restrições de tamanho em saídas estruturadas. Eles vivem no
prompt e são aplicados depois, em verify.py.

O schema enviado à API não tem campos anuláveis: cada `X | None` dobra a
gramática compilada, e com muitos deles a API recusa o pedido. No fio, o
ausente é vazio ("" ou []); from_wire() devolve os nulls antes de validar.
"""

from __future__ import annotations

from typing import Any, Literal, get_args

from pydantic import BaseModel, ConfigDict, Field

SCHEMA_ID = "visual/1"

Glyph = Literal[
    "question", "data", "model", "gear", "chart", "check",
    "warning", "search", "text", "image", "robot", "scale", "clock", "compare",
]

SimTemplate = Literal[
    "sampling_temperature",
    "gradient_descent",
    "threshold_tradeoff",
    "scaling_law",
    "topk_retrieval",
    "quantization",
    "majority_vote",
    "tradeoff_curve",
    "none",
]

CurveShape = Literal["rise_then_fall", "saturating", "decaying", "power_law", "s_curve"]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Stat(_Strict):
    value: str = Field(description="The number exactly as printed in the paper, e.g. '71.5' or '3.2x'.")
    unit: str = Field(description="Unit or scale, e.g. '/ 100', '%', 'x faster'. Empty string if none.")
    label: str = Field(description="What the number measures, at most 6 words.")
    context: str = Field(description="Why it matters, at most 12 words.")
    baseline_value: str | None = Field(description="The comparison number as printed, or empty.")
    baseline_label: str | None = Field(description="What the baseline is, at most 4 words, or empty.")
    higher_is_better: bool
    source_quote: str = Field(
        description="Verbatim sentence fragment from the paper (at most 30 words) that contains the value."
    )


class Step(_Strict):
    kind: Literal["problem", "approach", "result"]
    title: str = Field(description="At most 4 words.")
    text: str = Field(description="At most 22 words, plain language.")
    glyph: Glyph


class FlowNode(_Strict):
    id: str
    label: str = Field(description="At most 3 words.")
    kind: Literal["input", "data", "model", "process", "output"]


class FlowEdge(_Strict):
    source: str
    target: str
    label: str | None = Field(description="At most 2 words, or empty.")


class Flow(_Strict):
    nodes: list[FlowNode] = Field(description="3 to 6 nodes, in reading order.")
    edges: list[FlowEdge]


class ResultRow(_Strict):
    label: str = Field(description="Method or condition, at most 4 words.")
    value: float
    ours: bool = Field(description="True for the paper's own method.")


class Results(_Strict):
    metric: str = Field(description="Metric name, at most 4 words.")
    unit: str
    higher_is_better: bool
    caption: str = Field(description="What the comparison shows, at most 10 words.")
    rows: list[ResultRow] = Field(description="2 to 8 rows taken from one table or figure of the paper.")
    source_quote: str = Field(
        description="Verbatim fragment (at most 40 words) from the paper's text or table containing these numbers."
    )


class Sim(_Strict):
    template: SimTemplate
    title: str = Field(description="At most 6 words.")
    question: str = Field(description="What the reader should try, at most 14 words.")
    takeaway: str = Field(description="What they should notice, at most 16 words.")
    x_label: str = Field(description="The knob the reader moves, at most 3 words.")
    x_unit: str
    x_min: float
    x_max: float
    x_default: float
    y_label: str = Field(description="What changes, at most 3 words.")
    y_unit: str
    shape: CurveShape | None = Field(description="How the outcome responds; only read for tradeoff_curve.")
    labels: list[str] = Field(description="Template-specific short labels (at most 3 words each, at most 6).")
    values: list[float] = Field(description="Template-specific numbers, see the catalog. Empty list if none.")
    paper_x: float | None = Field(description="The setting the paper uses on the x axis; 0 if none.")
    paper_note: str | None = Field(description="Label for that marker, at most 5 words; empty if none.")


class Predict(_Strict):
    question: str = Field(description="A guess the reader makes before seeing the results, at most 14 words.")
    options: list[str] = Field(description="2 to 4 short options, at most 5 words each.")
    answer: int = Field(description="Index of the correct option in options.")
    reveal: str = Field(description="Why that is the answer, at most 16 words.")


class Term(_Strict):
    term: str
    plain: str = Field(description="At most 14 words, specific to this paper.")


class Analogy(_Strict):
    text: str = Field(description="At most 30 words.")
    breaks: str = Field(description="Where the analogy stops working, at most 14 words.")


class DeepPart(_Strict):
    heading: str = Field(description="At most 6 words.")
    body: str = Field(description="At most 45 words.")


class VisualDecode(_Strict):
    hook: str = Field(description="The paper in one line, at most 16 words, no jargon.")
    stat: Stat | None = Field(description="Headline number; value empty if the paper has none.")
    steps: list[Step] = Field(description="Exactly 3: problem, approach, result.")
    flow: Flow | None = Field(description="Method diagram; nodes empty if there is no pipeline.")
    results: Results | None = Field(description="The paper's own comparison; rows empty if none.")
    predict: Predict | None = Field(description="Guess before the results; options empty if none.")
    sim: Sim
    terms: list[Term] = Field(description="At most 6 terms a newcomer would trip on.")
    analogy: Analogy | None = Field(description="Text empty if every analogy would mislead.")
    limits: list[str] = Field(description="At most 3 limitations, at most 14 words each.")
    deep: list[DeepPart] = Field(description="The long version: at most 5 parts.")


def _drop_titles(node: Any) -> Any:
    """
    O Pydantic põe 'title' em todo schema; a API não precisa e o schema fica
    menor. Dentro de 'properties' as chaves são nomes de campo — um campo
    chamado title fica.
    """
    if isinstance(node, dict):
        out = {}
        for k, v in node.items():
            if k == "title" and not isinstance(v, dict):
                continue
            if k in ("properties", "$defs"):
                out[k] = {name: _drop_titles(sub) for name, sub in v.items()}
            else:
                out[k] = _drop_titles(v)
        return out
    if isinstance(node, list):
        return [_drop_titles(v) for v in node]
    return node


def _drop_nulls(node: Any) -> Any:
    """anyOf [X, null] → X: no fio nada é anulável."""
    if isinstance(node, dict):
        variants = node.get("anyOf")
        if isinstance(variants, list):
            kept = [v for v in variants if v != {"type": "null"}]
            if len(kept) == 1:
                rest = {k: v for k, v in node.items() if k != "anyOf"}
                return _drop_nulls({**kept[0], **rest})
        return {k: _drop_nulls(v) for k, v in node.items()}
    if isinstance(node, list):
        return [_drop_nulls(v) for v in node]
    return node


def _inline(node: Any, defs: dict) -> Any:
    """
    Troca cada $ref pela definição. Com $defs no schema a gramática
    compilada passa do limite da API mesmo quando o resto é pequeno.
    """
    if isinstance(node, dict):
        ref = node.get("$ref")
        if isinstance(ref, str) and ref.startswith("#/$defs/"):
            rest = {k: v for k, v in node.items() if k != "$ref"}
            return _inline({**defs[ref.split("/")[-1]], **rest}, defs)
        return {k: _inline(v, defs) for k, v in node.items() if k != "$defs"}
    if isinstance(node, list):
        return [_inline(v, defs) for v in node]
    return node


def _open_enums(node: Any) -> Any:
    """
    Enum vira string com as opções na descrição. A gramática tem um teto
    cumulativo e cada enum pesa; o from_wire corrige valores fora da lista.
    """
    if isinstance(node, dict):
        out = {k: _open_enums(v) for k, v in node.items()}
        values = out.pop("enum", None)
        if values is not None:
            hint = "One of: " + ", ".join(values) + "."
            out["description"] = f"{out['description']} {hint}" if out.get("description") else hint
            out["type"] = "string"
        return out
    if isinstance(node, list):
        return [_open_enums(v) for v in node]
    return node


# Fora do fio: o palpite sai dos próprios resultados (página), a versão longa
# saiu do produto e o tipo do passo é a posição. Sem eles a gramática cabe.
WIRE_OMIT = {"predict", "deep"}
STEP_OMIT = {"kind"}


def output_schema() -> dict:
    """Schema JSON para output_config.format: sem nulls, sem $defs, sem enums, tudo obrigatório."""
    schema = _drop_nulls(_drop_titles(VisualDecode.model_json_schema()))
    schema = _open_enums(_inline(schema, schema.get("$defs", {})))
    for name in WIRE_OMIT:
        schema["properties"].pop(name)
        schema["required"].remove(name)
    step = schema["properties"]["steps"]["items"]
    for name in STEP_OMIT:
        step["properties"].pop(name)
        step["required"].remove(name)
    return schema


def _choice(value: Any, allowed: tuple[str, ...], fallback: str) -> str:
    v = str(value or "").strip().lower()
    return v if v in allowed else fallback


def _blank(v: Any) -> bool:
    return v is None or (isinstance(v, str) and not v.strip())


def from_wire(data: dict) -> dict:
    """Vazios do fio viram null e opções fora da lista voltam ao padrão."""
    d = {"predict": None, "deep": [], **data}
    glyphs = get_args(Glyph)
    d["steps"] = [
        # A ordem é o tipo: problema, abordagem, resultado
        {**step, "kind": kind, "glyph": _choice(step.get("glyph"), glyphs, "question")}
        for step, kind in zip(d.get("steps", []), ("problem", "approach", "result"))
    ]
    stat = d.get("stat")
    if not stat or _blank(stat.get("value")):
        d["stat"] = None
    else:
        d["stat"] = {
            **stat,
            "baseline_value": None if _blank(stat.get("baseline_value")) else stat["baseline_value"],
            "baseline_label": None if _blank(stat.get("baseline_label")) else stat["baseline_label"],
        }
    flow = d.get("flow")
    if not flow or not flow.get("nodes"):
        d["flow"] = None
    else:
        kinds = get_args(FlowNode.model_fields["kind"].annotation)
        d["flow"] = {**flow, "nodes": [
            {**n, "kind": _choice(n.get("kind"), kinds, "process")} for n in flow["nodes"]
        ], "edges": [
            {**e, "label": None if _blank(e.get("label")) else e["label"]} for e in flow.get("edges", [])
        ]}
    results = d.get("results")
    d["results"] = results if results and results.get("rows") else None
    predict = d.get("predict")
    d["predict"] = predict if predict and predict.get("options") else None
    analogy = d.get("analogy")
    d["analogy"] = analogy if analogy and not _blank(analogy.get("text")) else None
    sim = {**d["sim"], "template": _choice(d["sim"].get("template"), get_args(SimTemplate), "none")}
    if _blank(sim.get("paper_note")):
        sim["paper_x"], sim["paper_note"] = None, None
    if sim["template"] != "tradeoff_curve":
        sim["shape"] = None
    else:
        sim["shape"] = _choice(sim.get("shape"), get_args(CurveShape), "saturating")
    d["sim"] = sim
    return d
