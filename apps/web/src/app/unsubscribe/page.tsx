"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Masthead, PageShell } from "@/components/page-shell";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "/api").replace(/\/+$/, "");

function UnsubscribeInner() {
  const params = useSearchParams();
  const token = params.get("token");

  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("error");
      return;
    }

    fetch(`${API_BASE}/v1/me/digest/unsubscribe?token=${encodeURIComponent(token)}`, {
      method: "POST",
    })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((data: { email: string | null }) => {
        setEmail(data.email);
        setState("done");
      })
      .catch(() => setState("error"));
  }, [token]);

  if (state === "loading") {
    return <p className="op-label col-span-full pt-[calc(88*var(--px))]">Unsubscribing…</p>;
  }

  if (state === "error") {
    return (
      <Masthead
        kicker={<span>Weekly digest</span>}
        title="That link didn’t work"
        lead="The link may be malformed or already used. You can turn the digest off from your settings."
        meta={
          <Link href="/settings" className="op-link">
            Settings →
          </Link>
        }
      />
    );
  }

  return (
    <Masthead
      kicker={<span>Weekly digest</span>}
      title="Unsubscribed"
      lead={
        <>
          {email ? (
            <>
              No more weekly digests to <span className="font-mono">{email}</span>.
            </>
          ) : (
            "No more weekly digests."
          )}{" "}
          Nothing else changes — your saved papers and account stay as they were.
        </>
      }
      meta={
        <>
          <Link href="/settings" className="op-link">
            Turn it back on
          </Link>
          <Link href="/" className="op-link">
            Back to Decoded
          </Link>
        </>
      }
    />
  );
}

export default function UnsubscribePage() {
  return (
    <PageShell>
      <Suspense fallback={<p className="op-label col-span-full pt-[calc(88*var(--px))]">Loading…</p>}>
        <UnsubscribeInner />
      </Suspense>
    </PageShell>
  );
}
