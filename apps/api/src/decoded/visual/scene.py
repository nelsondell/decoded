"""
A cena "antes × depois" de cada paper e a reescrita dos textos num tom de
leitor.

A cena é desenhada pela página com peças fixas (carro, pessoa, robô,
documento, chat...) numa grade de 12 × 6; o modelo só escolhe as peças,
onde ficam e o que acontece com elas no tempo, nos dois quadros. Nada de
código gerado: é dado, e a página desenha.

Na mesma chamada, os textos do decode e do passo a passo voltam reescritos
como um leitor contaria a um colega. Números não mudam: um texto novo com
número que não está no paper nem no texto antigo é descartado.
"""

from __future__ import annotations

import json
import re
import time
from typing import Any, Literal

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
from decoded.visual import run
from decoded.visual import walkthrough as wt
from decoded.visual.schemas import _drop_nulls, _drop_titles, _inline, _open_enums, _Strict
from decoded.visual.verify import _forms, _numbers_in

SECTION = "scene"
SCHEMA_ID = "scene/1"
PROMPT_ID = "scene-p2"
DEFAULT_MODEL = "claude-sonnet-5-5"
MAX_TOKENS = 16_000
PAPER_CHARS = 28_000  # introdução e resultados bastam para a cena

COLS, ROWS = 24, 12
ICONS = (
    "car", "person", "people", "robot", "arm", "drone", "document", "chat", "code", "database",
    "search", "model", "chip", "server", "image", "camera", "chart", "clock", "coin", "lock",
    "shield", "warning", "check", "cross", "flag", "target", "eye", "pencil", "book", "globe",
    "wrench", "bolt", "cube", "pin", "bug", "key", "stop", "light",
)
Setting = Literal["road", "desk", "grid", "plain"]
BeatKind = Literal["move", "say", "path", "mark", "dim", "fill"]
Mark = Literal["ok", "fail", "wait", "fast", ""]
Tone = Literal["good", "bad", "neutral"]
Shape = Literal["straight", "smooth"]


# ------------------------------------------------------------------ schema


class Actor(_Strict):
    id: str = Field(description="a1 to a6, unique.")
    icon: str = Field(description="One of: " + ", ".join(ICONS) + ".")
    label: str = Field(description="At most 3 words.")
    col: int = Field(description="0 to 23, left to right.")
    row: int = Field(description="0 to 11, top to bottom.")


class WireBeat(_Strict):
    t: float = Field(description="When it happens, 0.0 to 1.0 of the panel's timeline.")
    kind: BeatKind
    actor: str = Field(description="Actor id for move, say, mark, dim, fill; empty for path.")
    col: int = Field(description="move: target column. Otherwise -1.")
    row: int = Field(description="move: target row. Otherwise -1.")
    text: str = Field(description="say: at most 6 words. fill: the meter's name, 1 or 2 words. mark: ok, fail, wait or fast. path: smooth or straight.")
    points: str = Field(description="path: grid waypoints 'col,row col,row ...' (2 to 10). Otherwise empty.")
    amount: float = Field(description="fill: how full the meter ends, 0.0 to 1.0. Otherwise 0.")
    tone: Tone


class Beat(WireBeat):
    mark: Mark = ""
    shape: Shape = "straight"


class WirePanel(_Strict):
    label: str = Field(description="At most 4 words naming this side.")
    beats: list[WireBeat]
    outcome: str = Field(description="At most 8 words: what the reader should notice at the end.")


class Panel(_Strict):
    label: str
    beats: list[Beat]
    outcome: str = Field(description="At most 8 words: what the reader should notice at the end.")


class WireScene(_Strict):
    setting: Setting
    actors: list[Actor]
    before: WirePanel
    after: WirePanel


class Scene(_Strict):
    setting: Setting
    actors: list[Actor]
    before: Panel
    after: Panel


class StepCopy(_Strict):
    title: str
    text: str


class TermCopy(_Strict):
    term: str
    plain: str


class StageCopy(_Strict):
    title: str
    says: str
    example: str


class Copy(_Strict):
    hook: str
    stat_label: str
    stat_context: str
    steps: list[StepCopy]
    results_caption: str
    sim_title: str
    sim_question: str
    sim_takeaway: str
    terms: list[TermCopy]
    analogy_text: str
    analogy_breaks: str
    limits: list[str]
    wt_example_title: str
    wt_input: str
    wt_output: str
    wt_stages: list[StageCopy]


class SceneOut(_Strict):
    scene: Scene
    copy_: Copy = Field(alias="copy")


class WireOut(_Strict):
    scene: WireScene
    copy_: Copy = Field(alias="copy")


def output_schema() -> dict:
    schema = _drop_nulls(_drop_titles(WireOut.model_json_schema(by_alias=True)))
    return _open_enums(_inline(schema, schema.get("$defs", {})))


def _choice(value: Any, allowed: tuple[str, ...], fallback: str) -> str:
    v = str(value or "").strip().lower()
    return v if v in allowed else fallback


def from_wire(data: dict) -> dict:
    s = dict(data.get("scene", {}))
    s["setting"] = _choice(s.get("setting"), Setting.__args__, "plain")
    s["actors"] = [{**a, "icon": _choice(a.get("icon"), ICONS, "cube")} for a in s.get("actors", [])]
    for side in ("before", "after"):
        panel = dict(s.get(side, {}))
        beats = []
        for b in panel.get("beats", []):
            kind = _choice(b.get("kind"), BeatKind.__args__, "mark")
            text = str(b.get("text") or "")
            # No fio, o tipo do selo e o do traço viajam em text (a gramática tem teto)
            beats.append({
                **b, "kind": kind, "tone": _choice(b.get("tone"), Tone.__args__, "neutral"),
                "mark": _choice(text, Mark.__args__, "ok") if kind == "mark" else "",
                "shape": _choice(text, Shape.__args__, "straight") if kind == "path" else "straight",
                "text": text if kind in ("say", "fill") else "",
            })
        panel["beats"] = beats
        s[side] = panel
    return {"scene": s, "copy": data.get("copy", {})}


# ------------------------------------------------------------------ prompt

SYSTEM = """You make two things for one AI paper on Decoded, a site where developers and ML researchers learn what a paper found in under a minute.

1. A BEFORE × AFTER SCENE

The page draws a tiny animated scene twice, side by side: on the left the world before this paper (the usual approach or the baseline), on the right the same situation with the paper's idea. A reader watches both play for five seconds and sees the paper's point without reading.

Draw the phenomenon, not the pipeline. Show what a person would SEE happening in the paper's world. Never chain data -> model -> output boxes: a separate step-by-step diagram already covers the method.
- A handwriting robot: the arm and the letter it writes. Before, a stiff straight-segment stroke; after, a smooth stroke.
- A driving model: the car on the road and the pedestrian. Before, the car reaches the crossing and brakes late; after, it slows down early.
- An agent that wastes tokens: the agent, a "tokens" meter, the tool, the answer. Before, the meter fills up before the answer; after, it stays low and the answer arrives sooner.
- A retrieval method: the question and five documents. Before, a path goes to the wrong document; after, it goes straight to the right one.
- A benchmark or case study with no new method: before = what people assumed; after = what the paper actually observed.

Pieces (pick only from this list): car, person, people, robot, arm, drone, document, chat, code, database, search, model, chip, server, image, camera, chart, clock, coin, lock, shield, warning, check, cross, flag, target, eye, pencil, book, globe, wrench, bolt, cube, pin, bug, key, stop, light.
- setting: road (a road band across rows 4 to 7, for anything that drives or follows a route), desk (a ground line, for robots and physical tasks), grid (faint dots, for spatial or search problems), plain (everything else).
- 2 to 5 actors, labels of 1 to 3 words. The grid is 24 columns (0 to 23) by 12 rows (0 to 11). Actors start at the same place in both panels, at least 4 columns or 3 rows apart.
- 3 to 7 beats per panel over time t from 0.0 to 1.0:
  - move: the actor travels to (col, row).
  - say: a speech bubble, at most 6 words, in plain words a person would say.
  - path: a line drawn as it happens through 2 to 10 grid points (a route, a stroke, a trajectory). shape smooth for natural motion, straight for stiff or mechanical motion. tone good, bad or neutral colours it.
  - fill: a small meter under the actor fills to amount (0.0 to 1.0); text names it ("tokens", "time", "errors", "cost"). Use it to compare a quantity between the panels.
  - mark: a badge on an actor: ok, fail, wait (slow), fast.
  - dim: the actor fades (ignored, dropped, wrong).
- Same situation, same rhythm in both panels; change only what the paper changes. End each panel on something the eye can read: a mark, a full or empty meter, a finished stroke.
- outcome: at most 8 words per panel, a reader's caption ("brakes late, right at the crossing", "slows down a second earlier").
- Nothing the paper doesn't show. No numbers in the scene.

2. THE PAGE TEXT, IN A READER'S VOICE

You get the page's current text. Rewrite every field in copy the way a sharp reader explains a paper to a developer friend: casual, direct, specific. Same facts, same numbers, fewer words.
- Aim for 20 to 30 percent fewer words than the original. Never more.
- Short sentences. Contractions are fine. Lead with the point.
- Cut filler: no "this paper", "the authors", "novel", "crucial", "leverage", "enables", "seamless", "notably", "in essence", "it's worth noting", no em-dash asides, no rhetorical questions, no lists of three adjectives.
- Keep each list the same length and order (steps, terms, limits, wt_stages). Keep term names exactly. Empty in, empty out.
- Never add a number that isn't in the original text or the paper.

Examples:
- "Most learning-from-demonstration methods copy only the path. Force and timing are ignored, and few datasets record them." -> "Robots usually copy the pen's path and nothing else. Pressure and speed get thrown away."
- "Qwen3 models at 4B to 14B beat text and latent baselines on 11 benchmarks with faster inference." -> "From 4B to 14B, it beats text and latent agents on 11 benchmarks, and runs faster."
- "A small adapter, HybridLink, feeds hidden states back as inputs. Special tokens open and close silent latent spans." -> "A small adapter feeds the model's hidden state back in. Two special tokens switch silent thinking on and off."

Before answering, check: every beat's actor exists; points and moves stay inside the 24 x 12 grid; the scene shows the phenomenon and not a pipeline; both panels tell the same situation; each copy field is shorter than its original; list lengths match."""


def _current_copy(visual: dict, walk: dict | None) -> dict:
    stat = visual.get("stat") or {}
    sim = visual.get("sim") or {}
    analogy = visual.get("analogy") or {}
    walk = walk or {}
    return {
        "hook": visual.get("hook", ""),
        "stat_label": stat.get("label", ""),
        "stat_context": stat.get("context", ""),
        "steps": [{"title": s.get("title", ""), "text": s.get("text", "")} for s in visual.get("steps", [])],
        "results_caption": (visual.get("results") or {}).get("caption", ""),
        "sim_title": sim.get("title", "") if sim.get("template") != "none" else "",
        "sim_question": sim.get("question", "") if sim.get("template") != "none" else "",
        "sim_takeaway": sim.get("takeaway", "") if sim.get("template") != "none" else "",
        "terms": [{"term": t.get("term", ""), "plain": t.get("plain", "")} for t in visual.get("terms", [])],
        "analogy_text": analogy.get("text", ""),
        "analogy_breaks": analogy.get("breaks", ""),
        "limits": list(visual.get("limits", [])),
        "wt_example_title": walk.get("example_title", ""),
        "wt_input": walk.get("input", ""),
        "wt_output": walk.get("output", ""),
        "wt_stages": [{"title": s.get("title", ""), "says": s.get("says", ""), "example": s.get("example", "")}
                      for s in walk.get("stages", [])],
    }


def user_message(paper: Paper, visual: dict, walk: dict | None, text: str) -> str:
    facts = {
        "stat": visual.get("stat"),
        "results": visual.get("results"),
    }
    return (
        f"<title>{paper.title}</title>\n"
        f"<abstract>{paper.abstract or ''}</abstract>\n"
        f"<facts>{json.dumps(facts, ensure_ascii=False)}</facts>\n"
        f"<current_copy>{json.dumps(_current_copy(visual, walk), ensure_ascii=False)}</current_copy>\n"
        f"<paper>\n{text[:PAPER_CHARS]}\n</paper>"
    )


# ----------------------------------------------------------------- conferência


def _numbers(text: str) -> set[str]:
    return {m.group(0) for m in re.finditer(r"-?\d+(?:[.,]\d+)?", text or "")}


def _printed(num: str, printed: set[str]) -> bool:
    try:
        return bool(_forms(float(num.replace(",", ""))) & printed)
    except ValueError:
        return False


def verify_scene(s: Scene, source_text: str) -> tuple[Scene, list[str], list[str]]:
    s = s.model_copy(deep=True)
    warnings: list[str] = []
    dropped: list[str] = []

    seen: set[str] = set()
    s.actors = [a for a in s.actors[:6] if not (a.id in seen or seen.add(a.id))]
    for a in s.actors:
        a.col = min(max(a.col, 0), COLS - 1)
        a.row = min(max(a.row, 0), ROWS - 1)
    ids = {a.id for a in s.actors}
    if len(s.actors) < 2:
        dropped.append("menos de 2 peças")

    for side in (s.before, s.after):
        kept = []
        for b in sorted(side.beats, key=lambda b: b.t)[:7]:
            b.t = min(max(b.t, 0.0), 1.0)
            if b.kind != "path" and b.actor not in ids:
                continue
            if b.kind == "move":
                b.col = min(max(b.col, 0), COLS - 1)
                b.row = min(max(b.row, 0), ROWS - 1)
            if b.kind == "path":
                pts = re.findall(r"(-?\d+)\s*,\s*(-?\d+)", b.points)
                if len(pts) < 2:
                    continue
                b.points = " ".join(f"{min(max(int(c), 0), COLS - 1)},{min(max(int(r), 0), ROWS - 1)}" for c, r in pts[:10])
            if b.kind == "fill":
                b.amount = min(max(b.amount, 0.0), 1.0)
                b.text = " ".join(b.text.split()[:2])
            kept.append(b)
        side.beats = kept
        if len(kept) < 2:
            dropped.append(f"quadro '{side.label}' com menos de 2 momentos")

    return s, warnings, dropped


def merge_copy(visual: dict, walk: dict | None, copy: Copy, source_text: str) -> tuple[dict, dict | None, list[str]]:
    """Aplica a reescrita campo a campo; o que não confere fica como estava."""
    old = _current_copy(visual, walk)
    new = copy.model_dump()
    printed = _numbers_in(source_text)
    warnings: list[str] = []

    def ok(path: str, before: str, after: str) -> bool:
        if not after.strip() and before.strip():
            return False
        extra = [n for n in _numbers(after) if n not in _numbers(before) and not _printed(n, printed)]
        if extra:
            warnings.append(f"{path}: número novo {extra[:3]} — mantido o original")
            return False
        if len(after.split()) > max(len(before.split()), 1):
            warnings.append(f"{path}: ficou mais longo — mantido o original")
            return False
        return True

    v = json.loads(json.dumps(visual))
    w = json.loads(json.dumps(walk)) if walk else None

    def take(path: str, before: str, after: str) -> str:
        return after if ok(path, before, after) else before

    v["hook"] = take("hook", old["hook"], new["hook"])
    if v.get("stat"):
        v["stat"]["label"] = take("stat_label", old["stat_label"], new["stat_label"])
        v["stat"]["context"] = take("stat_context", old["stat_context"], new["stat_context"])
    if len(new["steps"]) == len(v.get("steps", [])):
        for i, s in enumerate(v["steps"]):
            s["title"] = take(f"steps.{i}.title", s["title"], new["steps"][i]["title"])
            s["text"] = take(f"steps.{i}.text", s["text"], new["steps"][i]["text"])
    if v.get("results"):
        v["results"]["caption"] = take("results_caption", old["results_caption"], new["results_caption"])
    if (v.get("sim") or {}).get("template") not in (None, "none"):
        for key in ("title", "question", "takeaway"):
            v["sim"][key] = take(f"sim.{key}", old[f"sim_{key}"], new[f"sim_{key}"])
    if len(new["terms"]) == len(v.get("terms", [])):
        for i, t in enumerate(v["terms"]):
            if new["terms"][i]["term"].strip().lower() == t["term"].strip().lower():
                t["plain"] = take(f"terms.{i}", t["plain"], new["terms"][i]["plain"])
    if v.get("analogy"):
        v["analogy"]["text"] = take("analogy.text", old["analogy_text"], new["analogy_text"])
        v["analogy"]["breaks"] = take("analogy.breaks", old["analogy_breaks"], new["analogy_breaks"])
    if len(new["limits"]) == len(v.get("limits", [])):
        v["limits"] = [take(f"limits.{i}", a, b) for i, (a, b) in enumerate(zip(v["limits"], new["limits"]))]
    if w:
        w["example_title"] = take("wt.example_title", old["wt_example_title"], new["wt_example_title"])
        w["input"] = take("wt.input", old["wt_input"], new["wt_input"])
        w["output"] = take("wt.output", old["wt_output"], new["wt_output"])
        if len(new["wt_stages"]) == len(w.get("stages", [])):
            for i, s in enumerate(w["stages"]):
                for key in ("title", "says", "example"):
                    s[key] = take(f"wt.stages.{i}.{key}", s[key], new["wt_stages"][i][key])
    return v, w, warnings


# ---------------------------------------------------------------------- run


def custom_id_for(arxiv_id: str) -> str:
    return "s-" + re.sub(r"[^a-zA-Z0-9_-]", "_", arxiv_id)[:60]


async def candidates(limit: int, only: list[str] | None = None) -> list[tuple[Paper, ParsedContent, dict, dict | None]]:
    """Papers com decode visual (e passo a passo, se houver), ainda sem cena."""
    visual = aliased(DecodedContent)
    walk = aliased(DecodedContent)
    has_scene = exists().where(
        DecodedContent.paper_id == Paper.id,
        DecodedContent.section == SECTION,
        DecodedContent.prompt_version == PROMPT_VERSION,
    )
    stmt = (
        select(Paper, ParsedContent, visual.content, walk.content)
        .join(ParsedContent, ParsedContent.paper_id == Paper.id)
        .join(visual, and_(visual.paper_id == Paper.id, visual.section == run.SECTION,
                           visual.prompt_version == PROMPT_VERSION))
        .outerjoin(walk, and_(walk.paper_id == Paper.id, walk.section == wt.SECTION,
                              walk.prompt_version == PROMPT_VERSION))
        .where(~has_scene)
        .order_by(Paper.priority_score.desc().nulls_last(), Paper.published_at.desc())
    )
    if only:
        stmt = stmt.where(Paper.arxiv_id.in_(only))
    async with async_session_factory() as session:
        rows = (await session.execute(stmt.limit(limit))).all()
    return [(p, parsed, v, w) for p, parsed, v, w in rows]


def _params(paper: Paper, parsed: ParsedContent, visual: dict, walk: dict | None, model: str, effort: str) -> dict:
    return {
        "model": model,
        "max_tokens": MAX_TOKENS,
        "system": [{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}],
        "messages": [{"role": "user", "content": user_message(paper, visual, walk, parsed.markdown or "")}],
        "output_config": {"effort": effort, "format": {"type": "json_schema", "schema": output_schema()}},
    }


def estimate(rows: list, model: str, output_tokens: int) -> dict:
    system_tokens = int((len(SYSTEM) + len(json.dumps(output_schema()))) / run.CHARS_PER_TOKEN)
    inputs = [
        int((min(len(parsed.markdown or ""), PAPER_CHARS) + len(json.dumps(v)) + len(json.dumps(w or {}))
             + len(p.abstract or "")) / run.CHARS_PER_TOKEN) + 300
        for p, parsed, v, w in rows
    ]
    usage = {
        "input_tokens": sum(inputs),
        "cache_read_input_tokens": system_tokens * max(len(rows) - 1, 0),
        "cache_creation_input_tokens": system_tokens,
        "output_tokens": output_tokens * len(rows),
    }
    total = run.cost_usd(model, usage, batch=True)
    return {"papers": len(rows), "model": model, "usd_total": round(total, 2),
            "usd_per_paper": round(total / max(len(rows), 1), 3)}


def parse(message) -> SceneOut:
    return SceneOut.model_validate(from_wire(json.loads(run._text_of(message))))


async def store(paper_id: int, arxiv_id: str, message, model: str, batch: bool, source_text: str,
                latency_ms: int = 0) -> run.Outcome:
    usage = message.usage.model_dump() if message.usage else {}
    cost = run.cost_usd(model, usage, batch=batch)
    if message.stop_reason in ("refusal", "max_tokens"):
        return run.Outcome(arxiv_id, "refused" if message.stop_reason == "refusal" else "truncated", cost)
    try:
        out = parse(message)
    except (ValidationError, ValueError) as e:
        return run.Outcome(arxiv_id, "invalid", cost, detail=str(e)[:400])

    scene, warnings, dropped = verify_scene(out.scene, source_text)
    async with async_session_factory() as session:
        repo = DecodedContentsRepository(session)
        sections = await repo.get_all_sections(paper_id, PROMPT_VERSION)
        # O repositório devolve as linhas; o que interessa é o conteúdo delas
        visual_row, walk_row = sections.get(run.SECTION), sections.get(wt.SECTION)
        visual = dict(visual_row.content) if visual_row is not None else None
        walk = dict(walk_row.content) if walk_row is not None else None
        if visual is None:
            return run.Outcome(arxiv_id, "invalid", cost, detail="sem decode visual")
        if visual.get("copy_original"):
            # O texto já foi reescrito numa rodada anterior; reescrever de novo só encurta mais
            new_visual, new_walk = dict(visual), walk
        else:
            new_visual, new_walk, copy_warnings = merge_copy(visual, walk, out.copy_, source_text)
            warnings += copy_warnings

        if not dropped:
            await repo.upsert_section(
                paper_id=paper_id, section=SECTION,
                content={"schema": SCHEMA_ID, "prompt": PROMPT_ID, **scene.model_dump(), "warnings": warnings},
                model=model, prompt_version=PROMPT_VERSION,
                input_tokens=usage.get("input_tokens", 0) + (usage.get("cache_read_input_tokens") or 0)
                + (usage.get("cache_creation_input_tokens") or 0),
                output_tokens=usage.get("output_tokens", 0), cost_usd=cost, latency_ms=latency_ms,
            )
        # O texto antigo fica guardado no decode visual, para voltar atrás se preciso
        new_visual["copy_original"] = visual.get("copy_original") or _current_copy(visual, walk)
        for section, before, after in ((run.SECTION, visual, new_visual), (wt.SECTION, walk, new_walk)):
            if after is not None and after != before:
                await repo.upsert_section(
                    paper_id=paper_id, section=section, content=after,
                    model=model, prompt_version=PROMPT_VERSION,
                    input_tokens=0, output_tokens=0, cost_usd=0.0, latency_ms=0,
                )
        await session.commit()
    status = "invalid" if dropped else "stored"
    return run.Outcome(arxiv_id, status, cost, warnings, "; ".join(dropped) or None)


async def trial(arxiv_id: str, model: str, effort: str, api_key: str) -> tuple[run.Outcome, dict | None]:
    """Uma chamada direta, sem gravar: devolve a cena e os textos já conferidos."""
    rows = await candidates(1, only=[arxiv_id])
    if not rows:
        raise SystemExit(f"{arxiv_id}: sem decode visual, sem texto ou já com cena")
    paper, parsed, visual, walk = rows[0]

    client = AsyncAnthropic(api_key=api_key)
    started = time.perf_counter()
    async with client.messages.stream(**_params(paper, parsed, visual, walk, model, effort)) as stream:
        message = await stream.get_final_message()
    await client.close()
    usage = message.usage.model_dump()
    cost = run.cost_usd(model, usage, batch=False)
    try:
        out = parse(message)
    except (ValidationError, ValueError) as e:
        return run.Outcome(arxiv_id, "invalid", cost, detail=str(e)[:400]), None
    scene, warnings, dropped = verify_scene(out.scene, parsed.markdown or "")
    new_visual, new_walk, copy_warnings = merge_copy(visual, walk, out.copy_, parsed.markdown or "")
    preview = {"scene": scene.model_dump(), "visual": new_visual, "walkthrough": new_walk,
               "latency_ms": int((time.perf_counter() - started) * 1000)}
    return run.Outcome(arxiv_id, "previewed", cost, warnings + copy_warnings, "; ".join(dropped) or None), preview


async def submit(limit: int, model: str, effort: str, api_key: str, only: list[str] | None = None) -> dict:
    rows = await candidates(limit, only)
    if not rows:
        raise SystemExit("nenhum paper com decode visual sem cena")
    requests = [
        Request(custom_id=custom_id_for(p.arxiv_id),
                params=MessageCreateParamsNonStreaming(**_params(p, parsed, v, w, model, effort)))
        for p, parsed, v, w in rows
    ]
    client = AsyncAnthropic(api_key=api_key)
    batch = await client.messages.batches.create(requests=requests)
    await client.close()

    run.STATE_DIR.mkdir(parents=True, exist_ok=True)
    state = {
        "batch_id": batch.id, "kind": SECTION, "model": model, "effort": effort, "prompt": PROMPT_ID,
        "papers": {custom_id_for(p.arxiv_id): {"paper_id": p.id, "arxiv_id": p.arxiv_id} for p, _, _, _ in rows},
    }
    run._state_path(batch.id).write_text(json.dumps(state, indent=2))
    return {"batch_id": batch.id, "requests": len(requests), "status": batch.processing_status}
