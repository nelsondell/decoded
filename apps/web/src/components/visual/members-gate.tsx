"use client";

import { SignInButton, SignUpButton, useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";

import { Redacted } from "@/components/brand";
import { ModeSwitcher } from "@/components/modes/mode-switcher";
import { PodcastSection } from "@/components/podcast/podcast-section";
import type { PaperDetail } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { visualOf, type Glyph as GlyphName } from "@/lib/visual-types";

import { Glyph } from "./glyphs";
import { VisualLocked } from "./visual-locked";

/** O que a trava pode dizer sobre o que guarda: nomes e contagens. */
export type MemberTeaser = {
  metric: string | null;
  simTitle: string | null;
  terms: number;
  limits: number;
};

/*
  A segunda metade do paper. Quem não entrou vê o que tem aqui e o convite
  para criar conta; quem entrou recebe o resto do decode, os modos e o
  áudio. O conteúdo fechado nunca vai no HTML da página (que é ISR e igual
  para todo mundo): ele é buscado aqui, depois que o Clerk confirma a sessão.
*/
export function MembersGate({
  arxivId,
  teaser,
  anchors,
}: {
  arxivId: string;
  teaser: MemberTeaser | null;
  /** Ids do índice lateral que moram aqui; sem sessão, apontam para a trava. */
  anchors: string[];
}) {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return <GateGhost />;
  if (!isSignedIn) return <Gate teaser={teaser} anchors={anchors} />;
  return <MemberSections arxivId={arxivId} visual={teaser !== null} />;
}

function MemberSections({ arxivId, visual }: { arxivId: string; visual: boolean }) {
  const { authedFetch } = useApi();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["paper-full", arxivId],
    queryFn: () => authedFetch<PaperDetail>(`/v1/papers/${arxivId}`),
    enabled: visual,
    staleTime: 60 * 60 * 1000,
  });
  const v = data ? visualOf(data.decoded ?? {}) : undefined;

  return (
    <>
      {visual && isPending && <GateGhost />}
      {visual && isError && (
        <section className="op-section vz-gate" role="status">
          <p className="vz-gate-title">The rest of this paper did not load.</p>
          <button type="button" className="op-link" onClick={() => void refetch()}>
            Try again
          </button>
        </section>
      )}
      {v && <VisualLocked v={v} />}
      <PodcastSection arxivId={arxivId} />
      <ModeSwitcher arxivId={arxivId} />
    </>
  );
}

function Gate({ teaser, anchors }: { teaser: MemberTeaser | null; anchors: string[] }) {
  const items: { glyph: GlyphName; text: string }[] = [
    ...(teaser?.metric
      ? [{ glyph: "chart" as const, text: `Results: ${teaser.metric}` }]
      : []),
    ...(teaser?.simTitle ? [{ glyph: "slider" as const, text: `Try it: ${teaser.simTitle}` }] : []),
    ...(teaser && teaser.terms > 0
      ? [{ glyph: "text" as const, text: `${teaser.terms} ${teaser.terms === 1 ? "term" : "terms"} explained` }]
      : []),
    ...(teaser && teaser.limits > 0
      ? [{ glyph: "warning" as const, text: `${teaser.limits} ${teaser.limits === 1 ? "limit" : "limits"}` }]
      : []),
    { glyph: "model" as const, text: "Audio and other modes" },
  ];

  return (
    <section id="members" className="op-section vz-gate" aria-labelledby="vz-gate-title">
      {anchors.map((id) => (
        <span key={id} id={id} className="vz-gate-anchor" aria-hidden />
      ))}
      <div className="vz-gate-ghost" aria-hidden>
        <Redacted width={260} seed={1} />
        <Redacted width={200} seed={2} />
      </div>
      <h2 id="vz-gate-title" className="vz-gate-title" data-reveal="fade" data-delay="60">
        {teaser ? "The rest is free with an account." : "Audio and modes are free with an account."}
      </h2>
      <ul className="vz-gate-list" data-reveal="fade" data-delay="140">
        {items.map((item) => (
          <li key={item.text}>
            <Glyph name={item.glyph} size={20} className="vz-gate-glyph" />
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
      <div className="vz-gate-actions" data-reveal="fade" data-delay="220">
        <SignUpButton mode="modal">
          <button type="button" className="vz-gate-primary">
            Create a free account
          </button>
        </SignUpButton>
        <SignInButton mode="modal">
          <button type="button" className="op-link">
            Sign in
          </button>
        </SignInButton>
      </div>
    </section>
  );
}

/** Lugar guardado enquanto a sessão ou o conteúdo carregam, sem pulo de layout. */
function GateGhost() {
  return (
    <section className="op-section vz-gate" aria-busy="true">
      <div className="vz-gate-ghost" aria-hidden>
        <Redacted width={260} seed={1} />
        <Redacted width={200} seed={2} />
        <Redacted width={240} seed={3} />
      </div>
    </section>
  );
}
