# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Pre-implementation. The repository currently contains design documentation (`SPEC.md`, this file, `README.md`, `CONTRIBUTING.md`), `LICENSE`, and `.gitignore` — no source code, no package manifest, no build system, no tests yet. Do not invent build/lint/test commands; there are none until Phase 2 begins.

**`SPEC.md` has been through a significant reframe (pass 2).** The original draft described a training/logging/rename layer with mutable "soul" text; that was scrapped in favor of the current design once we investigated how buddy bubbles actually work. If you see references in git history to `/buddy-train`, `/buddy-log`, `/buddy-rename`, `/bud`, `companion.soul`, or "soul mutations", those are pass 1 and no longer apply. Read `SPEC.md` end-to-end before making non-trivial decisions — it is the source of truth.

## What this project is

`buddy-buddy` is **exo-memory for Anthropic's `/buddy` companion system**. It gives the user two things Anthropic does not:

1. **A persistent record of what the buddy has said**, captured via a background daemon that watches bubble output while the user works. Bubbles are otherwise ephemeral and unrecoverable.
2. **A way to address the buddy directly** via a dedicated LLM call that uses `companion.personality` as the system prompt, optionally injecting past journal entries as context so the buddy has continuity across sessions.

The buddy itself is **never mutated**. No training, no stat persistence, no soul edits, no rename. `buddy-buddy` only observes, records, and relays.

## The load-bearing constraint

**Speech bubbles are drawn in a fixed region beside the input box and overwritten in place** on every new bubble, keystroke redraw, or full-screen refresh. They never enter the terminal's scrollback. Once overwritten, they are gone — from the terminal buffer, from session transcripts (`~/.claude/projects/*.jsonl` never contains them), from everywhere local.

This single fact is why `buddy-buddy` needs a background daemon. If a future task or contributor asks "why not just use copy-paste" or "why not tail a log file" or "why not scrape scrollback on demand" — the answer is always the same: the bubble is already gone by the time any of those mechanisms could run. Capture must be continuous or it cannot exist. Do not relitigate this.

## Architectural boundaries (hard rules)

- **`~/.claude.json` is strictly read-only.** `buddy-buddy` reads `companion.personality` to build the buddy's system prompt in `/bb-say`, and reads nothing else from that file. It never writes to anything under `companion`. This is the stronger successor to the original spec's "thin wrapper" principle and is the single most important invariant in the project. Any future schema change from Anthropic becomes a read-path concern only.
- **All persistent state lives under `~/.claude/buddy/`:** `journal.toon` (append-only), `last-seen.toon` (single-record pointer for `/bb-missed`), `daemon.pid` (lifecycle).
- **The daemon captures in memory only (Model A).** Raw `tmux capture-pane` output lives in a local variable for the duration of one poll and is discarded. Only extracted clean bubble text ever touches disk. No raw snapshot is ever written, not even temporarily, not even under a debug flag in production code paths.
- **`/bb-*` is the command namespace.** Never use `/buddy-*`, `/bud`, or any similar prefix — those are reserved for Anthropic's own commands so `buddy-buddy` never collides with upstream.
- **tmux is required for the daemon.** `/bb-watch` must error out cleanly if `$TMUX` is unset. No PTY wrapping, no Accessibility API, no stdout interception, no binary instrumentation — all explicitly excluded by scope.

## TOON format rules

TOON is the on-disk format for `journal.toon`. Design priorities in order: **token-minimal → extensible → human-skimmable**. Token efficiency is load-bearing because `/bb-say` feeds journal slices into LLM calls on every invocation, and future reflection features (summaries, charts, poems) will do the same at higher volume.

- Every record has a `type` tag and a `v` (version) field.
- **Unknown fields must be preserved on round-trip, not dropped.** Required test.
- Field keys are lowercase, underscored, max 12 chars.
- Timestamps are **Unix epoch milliseconds** (integer). The `ts` field doubles as the record's ID.
- Two record types in v1: `obs` (bubble captured by the daemon) and `ex` (exchange initiated by `/bb-say`, both prompt and reply stored together, with optional `ctx` list of referenced entry IDs).
- The journal is append-only. Records are never edited or deleted in place.

See SPEC.md §"TOON format" for canonical record shapes.

## Command set (v1)

Five commands, all under `/bb-*`:

- `/bb-watch` — start the daemon (requires active tmux session)
- `/bb-unwatch` — stop the daemon
- `/bb-missed` — show journal entries captured since last look; marks them as seen on exit
- `/bb-history [N]` — show the last N journal entries regardless of seen state
- `/bb-say [message]` — direct LLM call to the buddy with `companion.personality` as system prompt; reply auto-captured as an `ex` record; flags `--context N` (default 5), `--no-context`, `--pin <ids>`

See SPEC.md §"Core commands" for details.

## Implementation phase order

Do not skip phases. v1 ships when Phases 0–5 are complete; Phase 6 is the public-share pass.

- **Phase 0:** repo setup — README, CONTRIBUTING, license, `.gitignore`
- **Phase 1:** TOON parser/writer (`toon.js` or `toon.ts`), with round-trip and unknown-field-preservation tests
- **Phase 2:** daemon prototype — **discussion gate**: runtime language (Node / Python / Go) must be chosen before code. Iterative development of the bubble extraction heuristic against real `/buddy` output.
- **Phase 3:** `/bb-watch`, `/bb-unwatch`
- **Phase 4:** `/bb-missed`, `/bb-history`
- **Phase 5:** `/bb-say` with context injection
- **Phase 6:** first public share

## Open mechanics (empirical — resolve during implementation)

Three unknowns, all answerable by trying things rather than in advance:

- **Bubble extraction heuristic.** What glyph pattern reliably identifies a bubble region across terminal themes and Claude Code versions? First guess: runs of box-drawing characters near the bottom of the pane. Refine by running the daemon against real output.
- **Polling interval.** 2 seconds is the starting guess. Tune if bubbles are empirically faster or slower.
- **Context framing in `/bb-say`.** How should past journal entries be presented to the buddy in its system prompt? Start with "here is what you said recently:" framing, iterate based on how replies feel.

When a task touches one of these, try something and report what happened — do not ask the user to decide in the abstract. These are the only open questions; everything else is settled.

## Collaboration notes

- This is a for-fun side project — lighthearted, experimental, not top-priority. Match that tone.
- Lean terse. The user is sometimes verbose, sometimes curt; default to brevity either way and only expand when asked.
- Push back on requests when you disagree. Opinionated responses are welcome. The project name arc went `buddy-trainer` → `buddy-keeper` → `buddy-buddy`; the user circled back to their original instinct, but the earlier challenge was wanted. Expect more of that pattern — silly and wildly imaginative ideas are the point, and some of them deserve a second thought before implementation. The pass 1 → pass 2 spec rewrite is another instance: aggressive pushback on "just scrape the terminal" and "TOON is premature" was useful even though the user ultimately kept TOON.

## Extension philosophy

When Anthropic ships new companion features, extend via **new TOON record types and new command modules**, not by rewriting existing ones. The `v` field plus unknown-field preservation rule is what makes this safe. Deferred ideas tracked in SPEC.md §"Future layers": elixers (opt-in, never-forced stat buffs), rename (only if Anthropic doesn't ship it), non-tmux capture paths, summarization/chart/poem layers over `/bb-history`, and retiring the daemon if Anthropic ever ships an official bubble event stream.
