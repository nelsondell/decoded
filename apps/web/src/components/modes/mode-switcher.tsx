"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EVENTS, capture } from "@/lib/analytics";
import { useApi } from "@/lib/use-api";
import {
  ALL_MODES,
  MODE_DESCRIPTIONS,
  MODE_LABELS,
  type AnalogyMode,
  type CodeMode,
  type DiagramMode,
  type MathMode,
  type ModeInfo,
  type ModeName,
  type ModesListResponse,
  type StoryMode,
} from "@/lib/mode-types";
import { SectionHead } from "@/components/page-shell";
import { DiagramModeView } from "./diagram-mode";
import { MathModeView } from "./math-mode";
import { AnalogyModeView, CodeModeView, StoryModeView } from "./other-modes";
import { useEffect, useState } from "react";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "/api").replace(
  /\/+$/,
  "",
);

export function ModeSwitcher({ arxivId }: { arxivId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { isSignedIn } = useAuth();
  const { authedFetch } = useApi();
  const queryClient = useQueryClient();

  const activeMode = (params.get("mode") as ModeName | null) ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["modes", arxivId],
    queryFn: async (): Promise<ModesListResponse> => {
      if (isSignedIn) {
        return authedFetch<ModesListResponse>(`/v1/papers/${arxivId}/modes`);
      }
      const res = await fetch(`${API_BASE}/v1/papers/${arxivId}/modes`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  const generate = useMutation({
    mutationFn: (mode: ModeName) => {
      capture(EVENTS.MODE_GENERATE_CLICKED, { mode, arxiv_id: arxivId });
      return authedFetch<{
        mode: string;
        status: string;
        content: unknown;
        credits_remaining: number;
        poll_after_ms: number | null;
      }>(`/v1/papers/${arxivId}/modes/${mode}/generate`, {
        method: "POST",
      });
    },
    onSuccess: (result) => {
      capture(EVENTS.MODE_GENERATED, {
        mode: result.mode,
        arxiv_id: arxivId,
        cached: result.status === "ready",
        credits_left: result.credits_remaining,
      });
      void queryClient.invalidateQueries({ queryKey: ["me"] });

      if (result.status === "ready") {
        void queryClient.invalidateQueries({ queryKey: ["modes", arxivId] });
        return;
      }

      if (result.status === "generating") {
        setPolling(result.mode as ModeName);
      }
    },
    onError: (error, mode) => {
      if (error instanceof Error && error.message.includes("402")) {
        capture(EVENTS.MODE_OUT_OF_CREDITS, { mode, arxiv_id: arxivId });
      }
    },
  });

  const [polling, setPolling] = useState<ModeName | null>(null);

  const { data: polled } = useQuery({
    queryKey: ["mode-poll", arxivId, polling],
    queryFn: async (): Promise<ModeInfo> => {
      const res = await fetch(
        `${API_BASE}/v1/papers/${arxivId}/modes/${polling}`,
      );
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: polling !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "generating" || status === "pending" ? 3000 : false;
    },
  });

  useEffect(() => {
    if (!polled) return;
    if (
      polled.status === "ready" ||
      polled.status === "failed" ||
      polled.status === "not_applicable"
    ) {
      setPolling(null);
      void queryClient.invalidateQueries({ queryKey: ["modes", arxivId] });
    }
  }, [polled, arxivId, queryClient]);

  function selectMode(mode: ModeName | null) {
    if (mode) {
      const info = modeMap.get(mode);
      capture(EVENTS.MODE_TAB_CLICKED, {
        mode,
        arxiv_id: arxivId,
        was_cached: info?.status === "ready",
      });
    }
    const next = new URLSearchParams(params.toString());
    if (mode === null) next.delete("mode");
    else next.set("mode", mode);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  if (isLoading) {
    return (
      <section className="op-section" aria-busy="true">
        <div className="h-10 animate-pulse bg-surface" />
      </section>
    );
  }

  const modeMap = new Map<string, ModeInfo>(
    (data?.modes ?? []).map((m) => [m.mode, m]),
  );
  const active = activeMode ? modeMap.get(activeMode) : null;
  const credits =
    data?.credits_remaining !== null && data?.credits_remaining !== undefined
      ? data.plan === "pro"
        ? "unlimited"
        : `${data.credits_remaining} credits`
      : null;

  return (
    <section id="modes" className="op-section">
      <SectionHead label="Explain it different" aside="the same mechanism, five ways" />

      {/* Abas: a tipografia da navegação, sublinhado de tinta na ativa */}
      <div role="tablist" aria-label="Explanation modes" className="op-tabs">
        {ALL_MODES.map((mode) => {
          const info = modeMap.get(mode);
          const isActive = activeMode === mode;
          const ready = info?.status === "ready";

          return (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => selectMode(isActive ? null : mode)}
              className="op-nav-link"
            >
              {MODE_LABELS[mode]}
              {ready && !isActive && (
                <span className="ml-1.5 text-accent" aria-label="ready">
                  ·
                </span>
              )}
            </button>
          );
        })}

        {credits && <span className="op-tabs-aside tnum">{credits}</span>}
      </div>

      {/* Conteúdo */}
      {activeMode && (
        <div className="pt-[calc(40*var(--px))]" data-reveal="fade" data-delay="0" key={activeMode}>
          <ModePanel
            mode={activeMode}
            info={active ?? null}
            isSignedIn={!!isSignedIn}
            isGenerating={generate.isPending || polling === activeMode}
            error={generate.error}
            onGenerate={() => generate.mutate(activeMode)}
          />
        </div>
      )}
    </section>
  );
}

function ModePanel({
  mode,
  info,
  isSignedIn,
  isGenerating,
  error,
  onGenerate,
}: {
  mode: ModeName;
  info: ModeInfo | null;
  isSignedIn: boolean;
  isGenerating: boolean;
  error: unknown;
  onGenerate: () => void;
}) {
  // Pronto — renderiza
  if (info?.status === "ready" && info.content) {
    switch (mode) {
      case "math":
        return <MathModeView data={info.content as MathMode} />;
      case "analogy":
        return <AnalogyModeView data={info.content as AnalogyMode} />;
      case "story":
        return <StoryModeView data={info.content as StoryMode} />;
      case "diagram":
        return <DiagramModeView data={info.content as DiagramMode} />;
      case "code":
        return <CodeModeView data={info.content as CodeMode} />;
    }
  }

  if (info?.status === "not_applicable") {
    return <p className="op-big text-muted-foreground">This mode doesn&apos;t fit this paper.</p>;
  }

  if (isGenerating) {
    return (
      <div role="status">
        <p className="op-label m-0 text-accent">Generating</p>
        <p className="op-prose op-prose-2 mb-0 mt-[calc(12*var(--px))]">
          This takes 20 to 60 seconds. You can keep reading.
        </p>
        <div className="mt-[calc(24*var(--px))] h-px w-[calc(160*var(--px))] overflow-hidden bg-border">
          <div className="h-px w-1/3 animate-[slide_1.4s_ease-in-out_infinite] bg-accent" />
        </div>
      </div>
    );
  }

  // Não gerado
  return (
    <div>
      <p className="op-big">{MODE_LABELS[mode]}</p>
      <p className="op-prose op-prose-2 mb-0 mt-[calc(14*var(--px))] max-w-[46ch]">
        {MODE_DESCRIPTIONS[mode]}
      </p>

      {info?.status === "failed" && error == null && (
        <p className="op-label mb-0 mt-[calc(18*var(--px))] text-destructive">
          The last attempt at this mode failed.
        </p>
      )}

      {error != null && (
        <p className="op-label mb-0 mt-[calc(18*var(--px))] text-destructive">
          {error instanceof Error && error.message.includes("402")
            ? "Out of credits. They reset weekly."
            : "Generation failed. Try again."}
        </p>
      )}

      <div className="mt-[calc(30*var(--px))]">
        {isSignedIn ? (
          <button type="button" onClick={onGenerate} className="op-link" data-cur="make">
            Generate · 1 credit →
          </button>
        ) : (
          <SignInButton mode="modal">
            <button type="button" className="op-link" data-cur="sign in">
              Sign in to generate →
            </button>
          </SignInButton>
        )}
      </div>
    </div>
  );
}
