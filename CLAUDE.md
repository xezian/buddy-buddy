# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Phases 0–5.6 are complete. The codebase is TypeScript (Node 22.6+), with source in `src/`, slash commands in `.claude/commands/`, and an install script in `scripts/`. Tests live in `test/`. Build/run: `npm install`, `npm run install-commands`, `npm test`.

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

- **`~/.claude.json` is strictly read-only.** `buddy-buddy` reads `companion.personality` and `companion.name` to build the buddy's system prompt and display name. It never writes to anything under `companion`. This is the stronger successor to the original spec's "thin wrapper" principle and is the single most important invariant in the project. Any future schema change from Anthropic becomes a read-path concern only.
- **All persistent state lives under `~/.claude/buddy/`:** `journal.toon` (append-only), `last-seen.toon` (single-record pointer for `/bb-missed`), `daemon.pid` (lifecycle), `bin/` (wrapper scripts installed by `install-commands`).
- **The daemon captures in memory only (Model A).** Raw `tmux capture-pane` output lives in a local variable for the duration of one poll and is discarded. Only extracted clean bubble text ever touches disk. No raw snapshot is ever written, not even temporarily, not even under a debug flag in production code paths.
- **`/bb-*` is the command namespace.** Never use `/buddy-*`, `/bud`, or any similar prefix — those are reserved for Anthropic's own commands so `buddy-buddy` never collides with upstream.
- **tmux is required for the daemon.** `/bb-watch` must error out cleanly if `$TMUX` is unset. The daemon auto-discovers and polls all tmux panes (not just the one where it was started). No PTY wrapping, no Accessibility API, no stdout interception, no binary instrumentation — all explicitly excluded by scope.

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

Phases 0–5.6 are complete. Phase 6 (first public share) is next. See SPEC.md for the full phase checklist.

## Resolved mechanics

These were open questions during design, now settled:

- **Bubble extraction heuristic:** scans from bottom of pane upward for box-drawing glyphs (`╭╮╰╯│─`), extracts interior text between left and right `│` borders. See `src/extract.ts`.
- **Polling interval:** 2 seconds — works well empirically, `capture-pane` is cheap.
- **Context framing in `/bb-say`:** "Here is what you said recently:" followed by timestamped entries. See `src/bb-say.ts:buildSystemPrompt`.

## Collaboration notes

- This is a for-fun side project — lighthearted, experimental, not top-priority. Match that tone.
- Lean terse. The user is sometimes verbose, sometimes curt; default to brevity either way and only expand when asked.
- Push back on requests when you disagree. Opinionated responses are welcome. The project name arc went `buddy-trainer` → `buddy-keeper` → `buddy-buddy`; the user circled back to their original instinct, but the earlier challenge was wanted. Expect more of that pattern — silly and wildly imaginative ideas are the point, and some of them deserve a second thought before implementation. The pass 1 → pass 2 spec rewrite is another instance: aggressive pushback on "just scrape the terminal" and "TOON is premature" was useful even though the user ultimately kept TOON.

## Extension philosophy

When Anthropic ships new companion features, extend via **new TOON record types and new command modules**, not by rewriting existing ones. The `v` field plus unknown-field preservation rule is what makes this safe. Deferred ideas tracked in SPEC.md §"Future layers": elixers (opt-in, never-forced stat buffs), rename (only if Anthropic doesn't ship it), non-tmux capture paths, summarization/chart/poem layers over `/bb-history`, and retiring the daemon if Anthropic ever ships an official bubble event stream.
