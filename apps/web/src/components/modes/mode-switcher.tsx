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
  type ModeStatus,
  type ModesListResponse,
  type StoryMode,
} from "@/lib/mode-types";
import { SectionHead } from "@/components/page-shell";
import { DiagramModeView } from "./diagram-mode";
import { MathModeView } from "./math-mode";
import { AnalogyModeView, CodeModeView, StoryModeView } from "./other-modes";
import { Icon } from "@/components/icons";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "/api").replace(
  /\/+$/,
  "",
);

/** Intervalo de releitura enquanto algum modo está sendo gerado. */
const POLL_MS = 3000;

type Credits = {
  left: number | null;
  unlimited: boolean;
  resetAt: string | null;
};

type GenerateResult = {
  mode: ModeName;
  status: ModeStatus;
  content: unknown;
  credits_remaining: number | null;
};

export function ModeSwitcher({ arxivId }: { arxivId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { isSignedIn } = useAuth();
  const { authedFetch } = useApi();
  const queryClient = useQueryClient();

  const activeMode = (params.get("mode") as ModeName | null) ?? null;
  // Com e sem sessão a resposta muda (créditos), então a chave também
  const queryKey = ["modes", arxivId, isSignedIn ? "member" : "guest"];

  // O estado de cada modo mora no servidor: recarregar a página no meio de
  // uma geração volta a mostrá-la e segue esperando até ficar pronta
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<ModesListResponse> => {
      if (isSignedIn) {
        return authedFetch<ModesListResponse>(`/v1/papers/${arxivId}/modes`);
      }
      const res = await fetch(`${API_BASE}/v1/papers/${arxivId}/modes`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    refetchInterval: (query) =>
      query.state.data?.modes.some((m) => m.status === "generating") ? POLL_MS : false,
  });

  const generate = useMutation({
    mutationFn: (mode: ModeName) => {
      capture(EVENTS.MODE_GENERATE_CLICKED, { mode, arxiv_id: arxivId });
      return authedFetch<GenerateResult>(`/v1/papers/${arxivId}/modes/${mode}/generate`, {
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
      // Mostra o novo estado e o saldo já, sem esperar a releitura
      queryClient.setQueryData<ModesListResponse>(queryKey, (prev) =>
        prev
          ? {
              ...prev,
              credits_remaining: result.credits_remaining ?? prev.credits_remaining,
              modes: prev.modes.map((m) =>
                m.mode === result.mode
                  ? { ...m, status: result.status, content: result.content ?? m.content }
                  : m,
              ),
            }
          : prev,
      );
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error, mode) => {
      if (error instanceof Error && error.message.includes("402")) {
        capture(EVENTS.MODE_OUT_OF_CREDITS, { mode, arxiv_id: arxivId });
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });

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
  const credits: Credits = {
    left: data?.credits_remaining ?? null,
    unlimited: data?.plan === "pro",
    resetAt: data?.credits_reset_at ?? null,
  };

  function selectMode(mode: ModeName | null) {
    if (mode) {
      capture(EVENTS.MODE_TAB_CLICKED, {
        mode,
        arxiv_id: arxivId,
        was_cached: modeMap.get(mode)?.status === "ready",
      });
    }
    generate.reset();
    const next = new URLSearchParams(params.toString());
    if (mode === null) next.delete("mode");
    else next.set("mode", mode);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <section id="modes" className="op-section">
      <SectionHead label="Explain it different" />

      {/* Abas: a tipografia da navegação, sublinhado de tinta na ativa */}
      <div role="tablist" aria-label="Explanation modes" className="op-tabs" data-fit="">
        {ALL_MODES.map((mode) => {
          const status = modeMap.get(mode)?.status;
          const isActive = activeMode === mode;

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
              {status === "ready" && !isActive && (
                <span className="op-tab-mark" aria-label="ready" />
              )}
              {status === "generating" && (
                <span className="op-tab-mark" data-busy="" aria-label="generating" />
              )}
            </button>
          );
        })}
      </div>

      {activeMode && (
        <div className="pt-[calc(40*var(--px))]" data-reveal="fade" data-delay="0" key={activeMode}>
          <ModePanel
            mode={activeMode}
            info={active ?? null}
            credits={credits}
            isSignedIn={!!isSignedIn}
            isGenerating={
              active?.status === "generating" ||
              (generate.isPending && generate.variables === activeMode)
            }
            error={generate.error}
            onGenerate={() => generate.mutate(activeMode)}
          />
        </div>
      )}
    </section>
  );
}

function resetDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ModePanel({
  mode,
  info,
  credits,
  isSignedIn,
  isGenerating,
  error,
  onGenerate,
}: {
  mode: ModeName;
  info: ModeInfo | null;
  credits: Credits;
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
      <div role="status" className="op-mode-wait">
        <p className="op-label m-0 text-accent">Generating {MODE_LABELS[mode].toLowerCase()}</p>
        <p className="op-prose op-prose-2 mb-0 mt-[calc(12*var(--px))]">
          About a minute. Keep reading; it appears here when ready.
        </p>
        <div className="mt-[calc(24*var(--px))] h-px w-[calc(160*var(--px))] overflow-hidden bg-border">
          <div className="h-px w-1/3 animate-[slide_1.4s_ease-in-out_infinite] bg-accent" />
        </div>
      </div>
    );
  }

  const outOfCredits =
    error instanceof Error && error.message.includes("402")
      ? true
      : !credits.unlimited && credits.left === 0;

  // Não gerado
  return (
    <div>
      <p className="op-big">{MODE_DESCRIPTIONS[mode]}</p>

      {info?.status === "failed" && error == null && (
        <p className="op-label mb-0 mt-[calc(18*var(--px))] text-destructive">
          The last try failed. Try again.
        </p>
      )}

      {error != null && !outOfCredits && (
        <p className="op-label mb-0 mt-[calc(18*var(--px))] text-destructive">
          Generation failed. Try again.
        </p>
      )}

      <div className="op-mode-action">
        {!isSignedIn ? (
          <SignInButton mode="modal">
            <button type="button" className="op-link">
              Sign in to generate <Icon name="arrow-right" />
            </button>
          </SignInButton>
        ) : outOfCredits ? (
          <p className="op-label m-0">
            No credits left
            {credits.resetAt ? ` · more on ${resetDay(credits.resetAt)}` : ""}
          </p>
        ) : (
          <>
            <button type="button" onClick={onGenerate} className="op-link">
              Generate · 1 credit <Icon name="arrow-right" />
            </button>
            {credits.left !== null && (
              <span className="op-label tnum">
                {credits.unlimited
                  ? "Unlimited"
                  : `${credits.left} ${credits.left === 1 ? "credit" : "credits"} left`}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
