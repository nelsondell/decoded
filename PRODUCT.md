# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Developers who build with AI and want to keep up with research without reading PDFs, plus ML researchers and students who read many papers and need to triage fast. Both arrive mostly from links (Hacker News, search, shares) and decide in seconds whether a paper is worth their time.

## Product Purpose

Decoded turns new AI papers from arXiv into explanations a technical reader understands in minutes: a one-line hook, the headline number, how the method works, the results, an interactive simulator, terms, and limits. Success is a reader opening a paper, understanding it faster than from the abstract, and coming back.

## Positioning

Each paper is decoded from its full text, not its abstract, and every number shown is checked against the paper before it is published. The explanation is visual and interactive (flow diagram, results chart with a guess-then-reveal, a one-knob simulator), not a summary paragraph.

## Operating Context

- Papers are picked from what people discuss (Hacker News) and decoded in one-off batches; there is no automatic decoding. Readers' credits pay for on-demand explanation modes.
- Accounts: Clerk. Signed-out visitors see the open part of each paper (hook, headline number, the three steps and the flow diagram). Signed-in readers see results, simulator, terms, limits, modes and audio.
- The paper list on the home is the main way in; the primary action for a first-time visitor is opening a paper.

## Capabilities and Constraints

- Next.js 16 App Router (apps/web), FastAPI (apps/api), Postgres on Neon. The home is ISR (revalidates every 5 min).
- The gate is enforced by the site only for now: the public API still returns the full decode. Closing it at the API is an open decision.
- Clerk runs on a development instance (100-user cap) until the production instance and DNS are set up.
- No recurring infrastructure or automatic spend.

## Brand Commitments

- Name: Decoded. Tagline in use: "AI research, explained for humans."
- English-language reader-facing copy.

## Evidence on Hand

- 129 visually decoded papers in production, plus a larger index of undecoded papers with abstracts.
- No testimonials, customer logos, or usage numbers exist; do not invent them.

## Product Principles

- Show the paper, not the product: real titles, numbers and figures carry the page.
- Every number on screen traces back to the paper.
- Short before long: the open part must stand on its own in under a minute.
- Value first, account second: the gate appears after the reader has already learned something.
