"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useApi } from "@/lib/use-api";
import { EVENTS, capture } from "@/lib/analytics";

interface FollowState {
  target_type: string;
  slug: string;
  following: boolean;
}

/** Seguir, como ação em linha: mono, fio embaixo; seguindo, fio de tinta. */
export function FollowButton({
  targetType,
  slug,
  initialFollowing = false,
}: {
  targetType: "author" | "institution" | "topic";
  slug: string;
  initialFollowing?: boolean;
}) {
  const { isSignedIn } = useAuth();
  const { authedFetch } = useApi();
  const queryClient = useQueryClient();
  const [following, setFollowing] = useState(initialFollowing);

  const toggle = useMutation({
    mutationFn: () =>
      authedFetch<FollowState>("/v1/follows", {
        method: "POST",
        body: JSON.stringify({ target_type: targetType, slug }),
      }),
    onSuccess: (result) => {
      capture(result.following ? EVENTS.FOLLOWED : EVENTS.UNFOLLOWED, {
        target_type: targetType,
        slug,
      });
      setFollowing(result.following);
      void queryClient.invalidateQueries({ queryKey: ["follows"] });
    },
  });

  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button type="button" className="op-link">
          Follow +
        </button>
      </SignInButton>
    );
  }

  return (
    <button
      type="button"
      onClick={() => toggle.mutate()}
      disabled={toggle.isPending}
      aria-pressed={following}
      className="op-link"
      data-on={following ? "" : undefined}
    >
      {toggle.isPending ? "…" : following ? "Following ✓" : "Follow +"}
    </button>
  );
}
