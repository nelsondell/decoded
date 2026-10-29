import { Ledger, LedgerNum, LedgerRow } from "@/components/ledger";
import type { TopicCard as TopicCardType } from "@/lib/api";

function formatMomentum(value: number, label: string): string {
  if (label === "new") return "new";
  if (label === "quiet") return "—";
  const pct = Math.round(value * 100);
  if (pct === 0) return "0%";
  // Sinal de menos tipográfico, não hífen: números alinham em coluna
  return pct > 0 ? `+${pct}%` : `−${Math.abs(pct)}%`;
}

/**
 * Um tópico no livro de achados. A coluna de número traz o tamanho do
 * tópico (ou o momento, nas listas de tendência do Pulse); subindo ou
 * novo, o momento fica musgo.
 */
export function TopicCard({
  topic,
  showKeywords = true,
  figure = "count",
}: {
  topic: TopicCardType;
  showKeywords?: boolean;
  /** O que vai na coluna de número: quantos papers ou quanto mudou. */
  figure?: "count" | "momentum";
}) {
  const keywords = topic.keywords ?? [];
  const warm = topic.momentum_label === "rising" || topic.momentum_label === "new";
  const momentum = formatMomentum(topic.momentum, topic.momentum_label);

  return (
    <LedgerRow
      href={`/topic/${topic.slug}`}
      num={
        figure === "momentum" ? (
          <LedgerNum value={momentum} label={`${topic.paper_count} papers`} />
        ) : (
          <LedgerNum
            value={topic.paper_count}
            unit="papers"
            label={
              <span className={warm ? "text-accent" : undefined}>{momentum} this month</span>
            }
          />
        )
      }
      title={topic.name}
      hook={topic.description}
      meta={
        <>
          {topic.recent_papers > 0 && <span className="tnum">{topic.recent_papers} recent</span>}
          {showKeywords && keywords.slice(0, 4).map((k) => <span key={k}>{k}</span>)}
        </>
      }
    />
  );
}

/** Lista de tópicos: o mesmo livro das listas de papers. */
export function TopicList({
  figure = "count",
  children,
}: {
  figure?: "count" | "momentum";
  children: React.ReactNode;
}) {
  return <Ledger columns={[figure === "momentum" ? "Change" : "Papers", "Topic"]}>{children}</Ledger>;
}
