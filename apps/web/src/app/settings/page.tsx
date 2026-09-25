"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Column,
  Masthead,
  PageSection,
  PageShell,
  Rail,
  RailHeading,
  RailNote,
} from "@/components/page-shell";
import { useApi } from "@/lib/use-api";

interface DigestPrefs {
  enabled: boolean;
  max_papers: number;
  include_general: boolean;
}

/** Uma preferência: texto à esquerda, escolhas em mono à direita. */
function Setting({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-[calc(40*var(--px))] gap-y-4 border-t border-border py-[calc(28*var(--px))] first:border-t-0 first:pt-0">
      <div className="min-w-0 flex-[1_1_320px]">
        <p className="op-h3">{title}</p>
        <p className="op-prose op-prose-2 mb-0 mt-[calc(8*var(--px))] max-w-[48ch] text-[length:calc(17*var(--px))]">
          {hint}
        </p>
      </div>
      <div className="op-tabs flex-none border-b-0" role="group" aria-label={title}>
        {children}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { authedFetch } = useApi();
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["digest-prefs"],
    queryFn: () => authedFetch<DigestPrefs>("/v1/me/digest/preferences"),
  });

  const update = useMutation({
    mutationFn: (patch: Partial<DigestPrefs>) =>
      authedFetch<DigestPrefs>("/v1/me/digest/preferences", {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(["digest-prefs"], result);
    },
  });

  const choice = (on: boolean, label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      disabled={update.isPending}
      aria-pressed={on}
      className="op-nav-link disabled:opacity-50"
    >
      {label}
    </button>
  );

  return (
    <PageShell>
      <Masthead
        kicker={<span>Account</span>}
        title="Settings"
        lead="One email, Tuesdays. Choose whether it comes and how much it carries."
      />

      <Column>
        <PageSection label="Weekly digest" aside={update.isPending ? "saving…" : undefined}>
          {isLoading && <div className="h-24 animate-pulse bg-surface" />}

          {prefs && (
            <div data-reveal="fade" data-delay="80">
              <Setting
                title="Send me the weekly digest"
                hint="Papers from the topics, authors, and institutions you follow. Tuesdays."
              >
                {choice(prefs.enabled, "On", () => update.mutate({ enabled: true }))}
                {choice(!prefs.enabled, "Off", () => update.mutate({ enabled: false }))}
              </Setting>

              <Setting title="Papers per email" hint="Fewer means a higher bar for each one.">
                {[4, 6, 8, 10].map((n) => (
                  <span key={n} className="tnum">
                    {choice(prefs.max_papers === n, String(n), () =>
                      update.mutate({ max_papers: n }),
                    )}
                  </span>
                ))}
              </Setting>

              <Setting
                title="Fill with general feed"
                hint="When you follow nothing, send the highest-priority papers instead of nothing."
              >
                {choice(prefs.include_general, "On", () =>
                  update.mutate({ include_general: true }),
                )}
                {choice(!prefs.include_general, "Off", () =>
                  update.mutate({ include_general: false }),
                )}
              </Setting>
            </div>
          )}

          {update.isError && (
            <p className="op-label mt-[calc(18*var(--px))] text-destructive">
              That change didn&apos;t save. Try again.
            </p>
          )}
        </PageSection>
      </Column>

      <Rail>
        <RailHeading>What the digest is</RailHeading>
        <RailNote>
          One email, Tuesdays. Paper title, the one-sentence layer, and the
          number that matters. It should read like a page from the site that
          happened to arrive in an inbox.
        </RailNote>
      </Rail>
    </PageShell>
  );
}
