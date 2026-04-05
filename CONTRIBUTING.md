# Contributing to buddy-buddy

Thanks for being interested. A few things before you open a PR.

## Open an issue first

`buddy-buddy` is a small, opinionated project with a scope that has been deliberately narrowed. Before writing any non-trivial code, please open an issue describing what you'd like to change and why. This saves both of us time — some things that look like obvious improvements are deliberately excluded, and some things that look out-of-scope might actually be welcome in a later phase.

One-line typo fixes and documentation clarifications can go straight to a PR without an issue.

## Read the spec and `CLAUDE.md`

Everything in [`SPEC.md`](./SPEC.md) is load-bearing. In particular, the "Scope exclusions" and "Architectural boundaries" sections list things the project intentionally will not do (PTY wrapping, terminal scraping outside the opt-in daemon, writes to `~/.claude.json`, buddy stat mutation, etc.). Proposals that cross those boundaries need a strong argument before they're considered, because each boundary was chosen for a specific reason documented in the spec.

[`CLAUDE.md`](./CLAUDE.md) captures the same architecture in a more compact form for AI assistants working in the repo, and reflects lessons learned during design. It's a fast way to get oriented.

## Proposing new TOON record types

If you want to add a new record type to the journal (for a new command, a new reflection feature, a new integration), your issue should include:

- The new `type` tag name (lowercase, short)
- The full field set with short keys (max 12 chars, lowercase, underscored)
- How the record fits with the existing `obs` and `ex` types — does it describe something new, or is it a variant of an existing type?
- Whether any existing records need to change (they probably shouldn't; the `v` field and unknown-field preservation rule are designed so that new types can be added without touching old ones)

## Proposing new commands

New `/bb-*` commands should serve one of: (a) the core mechanic of capturing/recalling/addressing the buddy, (b) a future reflection layer built on top of the journal. Commands that mutate Anthropic state, manage buddy stats, or require features not currently in upstream Claude Code will be declined.

## Proposing future-layer features

Summarization, charting, poem generation, mood graphs, dry recaps, and similar reflection features are explicitly welcomed — they're in the "Future layers" section of the spec as things to build on top of `/bb-history`. If you have ideas here, open an issue and we can scope a phase for them.

## What will be declined

- Anything that wraps or replaces `claude` as the user's entry point (PTY wrapping, shell alias hijacking, etc.)
- Anything that reads or writes outside the read-only contract with `~/.claude.json` (specifically: anything that touches fields other than `companion.personality`, or writes to that file at all)
- Any mechanism to override, persist, or mutate buddy stats (DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK) — those belong to Anthropic
- Remote sync, telemetry, or any network IO beyond the `/bb-say` LLM call
- Patching, decompiling, or instrumenting the Claude Code binary

## Code of conduct

Be kind, be curious, remember this is a for-fun side project about a terminal pet. Don't take it too seriously. Your buddy wouldn't.
