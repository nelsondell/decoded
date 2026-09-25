"use client";

import { useQuery } from "@tanstack/react-query";
import { PageSection } from "@/components/page-shell";
import { AudioPlayer } from "./audio-player";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "/api").replace(/\/+$/, "");

interface PodcastResponse {
  arxiv_id: string;
  status: string;
  audio_url: string | null;
  duration_seconds: number | null;
  chapters: Array<{
    title: string;
    start_seconds: number;
    end_seconds: number;
  }>;
}

export function PodcastSection({ arxivId }: { arxivId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["podcast", arxivId],
    queryFn: async (): Promise<PodcastResponse> => {
      const res = await fetch(`${API_BASE}/v1/podcasts/${arxivId}`);
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Sem episódio pronto, a seção não existe — nada de placeholder vazio
  if (isLoading || !data || data.status !== "ready" || !data.audio_url) {
    return null;
  }

  const minutes = Math.round((data.duration_seconds ?? 0) / 60);

  return (
    <PageSection id="podcast" label="Listen" aside={`${minutes} min`}>
      <AudioPlayer
        src={data.audio_url}
        arxivId={arxivId}
        chapters={data.chapters ?? []}
        duration={data.duration_seconds ?? undefined}
      />
    </PageSection>
  );
}
