import Link from "next/link";
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
 * Um tópico como linha do arquivo da capa: nome grande à esquerda, momento
 * em mono à direita. Subindo ou novo, o número fica musgo.
 */
export function TopicCard({
  topic,
  showKeywords = true,
}: {
  topic: TopicCardType;
  showKeywords?: boolean;
}) {
  const keywords = topic.keywords ?? [];
  const warm = topic.momentum_label === "rising" || topic.momentum_label === "new";

  return (
    <li data-reveal="fade" data-delay="auto">
      <Link
        href={`/topic/${topic.slug}`}
        className="op-row"
        data-size="m"
        data-cur="open"
      >
        <span className="op-row-main">
          <span>{topic.name}</span>
          {topic.description && (
            <span className="op-row-desc">{topic.description}</span>
          )}
          <span className="op-label mt-[calc(14*var(--px))] flex flex-wrap gap-x-[calc(22*var(--px))] gap-y-1">
            <span className="tnum">{topic.paper_count} papers</span>
            {topic.recent_papers > 0 && (
              <span className="tnum">{topic.recent_papers} recent</span>
            )}
            {showKeywords &&
              keywords.slice(0, 4).map((k) => <span key={k}>{k}</span>)}
          </span>
        </span>
        <span className={`op-row-count ${warm ? "text-accent" : ""}`}>
          {formatMomentum(topic.momentum, topic.momentum_label)}
        </span>
      </Link>
    </li>
  );
}

/** Lista de tópicos — o mesmo fio de cima e de baixo do arquivo da capa. */
export function TopicList({ children }: { children: React.ReactNode }) {
  return <ul className="op-archive-list">{children}</ul>;
}
