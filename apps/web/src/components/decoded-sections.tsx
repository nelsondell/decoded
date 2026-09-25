import type {
  Analogies,
  DeepDive,
  FiguresExplained,
  OneSentence,
  SixtySecondRead,
  VocabTerm,
  Vocabulary,
} from "@/lib/decoded-types";
import { DEEP_DIVE_ORDER } from "@/lib/decoded-types";
import { PageSection } from "./page-shell";
import { VocabText } from "./vocab-text";

/*
  As camadas do decode no registro do Offprint: cada uma abre com um fio e
  um rótulo em mono, o texto corre em Literata leve, e nada vive dentro de
  caixa. O que é dado (números de seção, rótulos) fica em mono ink-3.
*/

/** Cada camada é uma seção com fio e rótulo; o aside vai à direita. */
export function Section({
  id,
  label,
  aside,
  children,
}: {
  id: string;
  label: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <PageSection id={id} label={label} aside={aside}>
      <div data-reveal="fade" data-delay="80">
        {children}
      </div>
    </PageSection>
  );
}

/* ---------------------------------------------------------------- */
/* One sentence — o destaque                                          */
/* ---------------------------------------------------------------- */
export function OneSentenceBlock({ data }: { data: OneSentence }) {
  return <p className="op-big">{data.text}</p>;
}

/* ---------------------------------------------------------------- */
/* 60-second read                                                     */
/* ---------------------------------------------------------------- */
const SIXTY_LABELS = [
  { key: "problem", label: "Problem" },
  { key: "approach", label: "Approach" },
  { key: "result", label: "Result" },
] as const;

export function SixtySecondBlock({
  data,
  terms,
}: {
  data: SixtySecondRead;
  terms: VocabTerm[];
}) {
  return (
    <div className="flex flex-col gap-[calc(28*var(--px))]">
      {SIXTY_LABELS.map(({ key, label }) => (
        <div
          key={key}
          className="grid gap-2 sm:grid-cols-[calc(120*var(--px))_1fr] sm:gap-[calc(24*var(--px))]"
        >
          <p className="op-label m-0 pt-[0.45em]">{label}</p>
          <p className="op-prose m-0">
            <VocabText text={data[key]} terms={terms} />
          </p>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Deep dive                                                          */
/* ---------------------------------------------------------------- */
export function DeepDiveBlock({
  data,
  terms,
}: {
  data: DeepDive;
  terms: VocabTerm[];
}) {
  return (
    <div className="flex flex-col gap-[calc(56*var(--px))]">
      {DEEP_DIVE_ORDER.map((key, i) => {
        const section = data[key];
        if (!section?.body) return null;

        return (
          <div key={key}>
            <div className="flex items-baseline gap-[calc(18*var(--px))]">
              <span className="op-label tnum flex-none">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="op-h3">{section.heading}</h3>
            </div>
            <p className="op-prose mb-0 mt-[calc(16*var(--px))] sm:pl-[calc(38*var(--px))]">
              <VocabText text={section.body} terms={terms} />
            </p>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Figures                                                            */
/* ---------------------------------------------------------------- */
export function FiguresBlock({ data }: { data: FiguresExplained }) {
  if (data.items.length === 0) return null;

  return (
    <div className="flex flex-col gap-[calc(56*var(--px))]">
      {data.items.map((fig, i) => (
        <figure key={i} className="m-0">
          <p className="op-label m-0 text-accent">{fig.figure_ref}</p>

          {fig.caption_from_paper && (
            <p className="op-prose op-prose-2 mb-0 mt-[calc(12*var(--px))] text-[length:calc(17*var(--px))] italic">
              {fig.caption_from_paper}
            </p>
          )}

          <p className="op-prose mb-0 mt-[calc(16*var(--px))]">{fig.plain_language}</p>

          <figcaption className="op-figcaption">
            <span>takeaway</span>
            <span className="max-w-[48ch]">{fig.key_insight}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Analogies                                                          */
/* ---------------------------------------------------------------- */
export function AnalogiesBlock({ data }: { data: Analogies }) {
  if (data.items.length === 0) return null;

  return (
    <div className="flex flex-col">
      {data.items.map((item, i) => (
        <div
          key={i}
          className="grid gap-2 border-t border-border py-[calc(24*var(--px))] first:border-t-0 first:pt-0 sm:grid-cols-[calc(200*var(--px))_1fr] sm:gap-[calc(24*var(--px))]"
        >
          <p className="op-label m-0 pt-[0.45em] text-accent">{item.concept}</p>
          <p className="op-prose m-0">{item.analogy}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Vocabulary                                                         */
/* ---------------------------------------------------------------- */
export function VocabularyBlock({ data }: { data: Vocabulary }) {
  if (data.terms.length === 0) return null;

  return (
    <dl className="m-0 flex flex-col">
      {data.terms.map((t, i) => (
        <div
          key={i}
          className="grid gap-1.5 border-t border-border py-[calc(16*var(--px))] first:border-t-0 first:pt-0 sm:grid-cols-[calc(200*var(--px))_1fr] sm:gap-[calc(24*var(--px))]"
        >
          <dt className="font-mono text-[length:calc(14*var(--px))] font-light text-accent">
            {t.term}
          </dt>
          <dd className="op-prose op-prose-2 m-0 text-[length:calc(17*var(--px))]">
            {t.definition}
          </dd>
        </div>
      ))}
    </dl>
  );
}
