"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api, type FeedResponse } from "@/lib/api";
import { EmptyNote } from "@/components/page-shell";
import { PaperCard, PaperCardSkeleton, PaperList } from "./paper-card";

const PAGE_SIZE = 20;

export function FeedList({
  initialData,
  category,
  decodedOnly,
}: {
  initialData: FeedResponse;
  category?: string;
  decodedOnly: boolean;
}) {
  const sentinel = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isError } =
    useInfiniteQuery({
      queryKey: ["feed", category ?? "all", decodedOnly],
      initialPageParam: 0,
      queryFn: ({ pageParam }) =>
        api.getFeed({
          limit: PAGE_SIZE,
          offset: pageParam as number,
          category,
          decodedOnly,
        }),
      getNextPageParam: (last, all) =>
        last.has_more ? all.length * PAGE_SIZE : undefined,
      initialData: {
        pages: [initialData],
        pageParams: [0],
      },
    });

  // Observa o sentinel e busca a próxima página quando ele entra em tela
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "400px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const papers = data.pages.flatMap((p) => p.papers);

  if (papers.length === 0) {
    return (
      <div className="mt-[calc(40*var(--px))]">
        <EmptyNote label="Nothing decoded here yet">
          No paper in this filter has cleared the queue. It runs in
          community-signal order.
        </EmptyNote>
      </div>
    );
  }

  return (
    <>
      <PaperList>
        {papers.map((p, i) => (
          <PaperCard key={p.arxiv_id} paper={p} source="feed" position={i} />
        ))}
        {isFetchingNextPage && (
          <>
            <PaperCardSkeleton />
            <PaperCardSkeleton />
          </>
        )}
      </PaperList>

      <div ref={sentinel} className="pt-[calc(28*var(--px))]">
        {isError && (
          <p className="op-label m-0 text-destructive">Failed to load more</p>
        )}
        {!hasNextPage && papers.length > PAGE_SIZE && (
          <p className="op-label m-0">End of the archive</p>
        )}
      </div>
    </>
  );
}
