# buddy-buddy

> Exo-memory for your Claude Code `/buddy` — a way to hold on to the things they say in passing, and to speak with them on purpose.

**Status:** Pre-implementation — spec only (pass 2, significantly reframed from pass 1)
**Intended audience:** Claude Code users on Pro/Max plans with `/buddy` enabled
**License:** MIT

---

## What this is

`buddy-buddy` is a Claude Code skill that gives you two things Anthropic's `/buddy` system does not:

1. **Memory of what your buddy has said.** Speech bubbles are ephemeral — they flash next to your input box and are overwritten in place. If you were heads-down and missed one, it's gone. `buddy-buddy` runs a background observer that captures every bubble it sees to a persistent journal, so "I missed it" becomes "let me look."
2. **A way to speak with your buddy directly, and show them their own past.** Your buddy has no memory across sessions — species, rarity, and stats are hash-recomputed every time you launch Claude Code; only `name`, `personality`, and `hatchedAt` persist. `buddy-buddy` lets you address your buddy via a dedicated LLM call, with optional slices of the journal handed back as "here's what you said before" context. The buddy becomes the main character; buddy-buddy is its exo-memory.

The skill is intentionally a **thin, read-only wrapper** around Anthropic's companion state. It reads `~/.claude.json`'s `companion.personality` to build the buddy's voice; it never writes there. All persistent state lives under `~/.claude/buddy/`.

---

## The constraint that shapes everything

Jetsam-style speech bubbles — the `/buddy` feature's core UI — are drawn in a fixed region beside the input box and **overwritten in place** on every new bubble, every keystroke that redraws the input line, and every full-screen refresh. They never scroll up into the terminal's scrollback buffer. Once overwritten, the bytes that drew them are gone from the terminal's cell state.

This means:

- Copy-paste only works if you notice the bubble and highlight it before it's overwritten.
- `tmux capture-pane -p` on demand only captures what's currently on screen — same limitation.
- There is no local file, session log, or event stream that records bubble utterances. We checked. The `~/.claude/projects/*.jsonl` session transcripts only contain `user` / `assistant` / `system` / `attachment` message types; bubbles never land there.

**The only way to recover a bubble you didn't read in time is to have already been watching when it appeared.** That is why `buddy-buddy` needs a background daemon. Every other design decision in this spec follows from that single fact.

---

## Architecture

Three pieces:

1. **The daemon** — a small background process that polls `tmux capture-pane -p` at ~2s intervals while you work, extracts any bubble region from the captured pane, diffs against the previous poll, and appends new bubble text to the journal. Raw captures live in memory only and are discarded after each poll; only the extracted clean bubble text ever touches disk.
2. **The journal** — an append-only TOON file under `~/.claude/buddy/` containing two record types: **observations** (bubbles the daemon captured) and **exchanges** (prompts sent to the buddy and their replies via `/bb-say`).
3. **The commands** — five slash commands under the `/bb-*` namespace, covering daemon control, journal readback, and direct address to the buddy.

---

## Core commands

All commands live under the `/bb-*` prefix. Nothing uses `/buddy-*` or `/bud` — those namespaces are reserved for Anthropic's own commands so `buddy-buddy` never collides with upstream.

| Command             | Purpose                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/bb-watch`         | Start the background daemon. Requires an active tmux session.                                                                                                                                                                                                                                                                                                                    |
| `/bb-unwatch`       | Stop the daemon.                                                                                                                                                                                                                                                                                                                                                                 |
| `/bb-missed`        | Show journal entries captured since you last looked. Marks them as seen when you exit the view. This is the "what did my buddy say while I was heads-down" command.                                                                                                                                                                                                              |
| `/bb-history [N]`   | Show the last N journal entries (or all, if small). Foundation for future summarization/charting/reflection features to be built on top.                                                                                                                                                                                                                                         |
| `/bb-say [message]` | Speak to the buddy directly. Standalone LLM call; system prompt is `companion.personality` plus a slice of recent journal entries as context. Reply is auto-captured as a new exchange record. Flags: `--context N` sets how many recent entries to include (default 5), `--no-context` disables injection, `--pin <ids>` pins specific entries instead of the recent-N default. |

---

## The mechanic

The journal is **shared memory between you and your buddy**. It stores exactly two kinds of records:

- **Observations** — bubbles the daemon caught while watching. These are things your buddy said without being asked, which neither you nor the buddy would otherwise remember.
- **Exchanges** — prompts you sent via `/bb-say` and the replies they produced. Both halves stored together as a single record. When an exchange was built with pinned or injected context, the IDs of those entries are recorded alongside so the provenance of each reply is auditable.

The loop:

1. You work. The daemon watches. Your buddy comments in bubbles. Each new bubble the daemon sees becomes an `obs` record in the journal.
2. You want to know what you missed → `/bb-missed` shows the unseen slice.
3. You want to hear from your buddy on purpose → `/bb-say` runs a direct LLM call with `companion.personality` as the system prompt. By default the last 5 journal entries are fed into the call as context, so the buddy can be shown what it said recently and respond with continuity. You can turn this off or pin specific entries.
4. The reply becomes a new exchange record. Over time, the journal is both your record of the buddy _and_ the buddy's only record of itself.

Your buddy is not trained, leveled, mutated, or persisted beyond what Anthropic already persists. It stays pure. `buddy-buddy` only remembers, plays back, and relays.

---

## TOON format (Terse Object-Oriented Notation)

TOON is the on-disk format for the journal. Design priorities in order:

1. **Token-minimal** — LLM can parse a full journal in one context pass. This matters because `/bb-say` feeds journal slices into LLM calls on every invocation, and future reflection features (summaries, charts, poems) will do the same at higher volume.
2. **Extensible** — new record types and new fields slot in without breaking existing records.
3. **Human-skimmable** — a developer (or you, during debugging) can read raw TOON without a decoder.

### Design rules

- Every record has a `type` tag and a `v` (version) field. Unknown fields are preserved on round-trip, not dropped.
- Field keys are lowercase, underscored, max 12 chars.
- Timestamps are Unix epoch **milliseconds** (integer). The `ts` field doubles as the record's ID; 1ms granularity makes collisions effectively impossible at the daemon's poll rate.
- Strings are double-quoted; internal double quotes are backslash-escaped.
- Lists use square brackets with space-separated entries.
- The journal file is append-only. Records are never edited or deleted in place.

### Record types

```
# observed bubble (written by the daemon)
{type:obs v:1 ts:1775423560123 text:"called my null pointer a 'galaxy-brained failure'. accurate."}

# exchange (written by /bb-say)
{type:ex v:1 ts:1775423700456 prompt:"what do you make of this function?" reply:"genuinely impressed you named a variable 'tmp'" ctx:[1775423560123]}
```

The `ctx` field on exchanges is a list of `ts` values of entries that were fed into the LLM call as context. Empty list (`ctx:[]`) or omitted entirely when `--no-context` was used.

---

## Storage contract

`buddy-buddy` is **strictly read-only to `~/.claude.json`**. It reads the `companion.personality` field to build the buddy's system prompt in `/bb-say`. It does not read any other field from `~/.claude.json`, and it never writes to anything under `companion` (or anywhere else in that file).

All persistent state `buddy-buddy` owns lives under `~/.claude/buddy/`:

```
~/.claude/buddy/
  journal.toon      # append-only event log (observations + exchanges)
  last-seen.toon    # single record tracking the /bb-missed pointer
  daemon.pid        # pidfile for /bb-unwatch
```

This read-only boundary is the stronger successor to the original spec's "thin wrapper" principle. Every future Anthropic schema change becomes a read-path concern only; no write-path to defend. If Anthropic renames, restructures, or removes `companion.personality`, only `/bb-say`'s system prompt construction needs updating.

---

## Daemon design

- **Language / runtime:** TBD in Phase 2. Candidates: Node (matches Claude Code's ecosystem), Python (fastest for a tmux-scraping prototype), Go (single static binary, easy to distribute). Decision deferred until we know how much bubble extraction logic ends up being.
- **Requirement:** must be launched from inside an active tmux session. `/bb-watch` errors out with a clear message if `$TMUX` is unset.
- **Polling:** `tmux capture-pane -p` every 2 seconds. Hardcoded in v1; no config file. Tune later if empirically wrong.
- **Extraction:** matches a bubble-region pattern against the captured pane text. The specific pattern (box-drawing glyphs, position heuristics) is **empirical** — it will be discovered during Phase 2 by running the daemon against real `/buddy` output and iterating on the extractor until it's reliable. The extractor's correctness is the single biggest technical risk in v1.
- **Deduplication:** each poll's extracted bubble text is compared to the previous poll's. Identical text → no record emitted. Different text → one new `obs` record appended.
- **Memory model (Model A):** raw captured pane text lives only in a local variable for the duration of each poll. It is never written to disk. Only the extracted clean bubble text, once validated as new, reaches `journal.toon`.
- **Lifecycle:** `/bb-watch` forks the daemon to the background and writes `daemon.pid`. `/bb-unwatch` reads the pidfile and sends SIGTERM. Daemon handles SIGTERM cleanly, flushes any buffered writes, removes the pidfile, exits.

---

## Scope exclusions

`buddy-buddy` does **not**:

- Patch the Claude Code binary, inject into its process, or instrument its API calls.
- Wrap `claude` in a PTY, replace its entry point, or intercept its stdout stream.
- Scrape the terminal outside the explicit opt-in daemon model. No macOS Accessibility API, no iTerm2 window API, no screen-capture.
- Write to any field under `companion` in `~/.claude.json`, or to any other field there.
- Train, mutate, persist, or override buddy stats (DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK). Those are Anthropic's domain — computed from a hash of the account ID, recomputed per session, never persisted by Anthropic and not persisted by us either.
- Touch species, rarity, appearance, or any other hash-derived attribute.
- Sync data to any remote service.
- Claim to be an official Anthropic product.

---

## Open mechanics (to resolve during implementation)

Three genuine unknowns remain, all of which are empirical and answerable during Phase 2–5 rather than in advance:

- **Bubble extraction heuristic.** What exact glyph pattern and positional logic reliably identifies a bubble in `tmux capture-pane` output across terminal themes and claude versions? First-pass guess: match runs of box-drawing characters (`╭╮╰╯│─`) near the bottom of the pane. Refine empirically.
- **Polling interval.** 2 seconds is the starting guess. If bubbles empirically linger longer, we can slow it down. If they vanish faster and we miss captures, we speed up. Budget implications: polling faster means more `tmux` subprocess calls, but `capture-pane` is cheap enough that this is unlikely to matter.
- **Context framing in `/bb-say`.** When we inject past journal entries into the buddy's system prompt, how are they presented to the model? "Here is what you said recently:" vs "The user previously observed you saying:" vs raw record dump. Affects how the buddy perceives its own continuity. Start with "here is what you said recently" framing, iterate based on how replies feel.

---

## Future layers (deferred, not declined)

Ideas that sit above the v1 foundation and can be built later without breaking anything:

- **Summarization, charts, poems, dry recaps.** `/bb-history` is the foundation for a whole family of reflection features — hand a slice of the journal to an LLM with a framing prompt ("summarize the last week in the form of a haiku" / "chart Jetsam's mood by hour") and render the result. Designed-in, not implemented in v1.
- **Elixers and confections.** If we want to let the user temporarily adjust buddy stat levels _without_ violating the "keep the buddy pure" principle, we can offer treats that the buddy may accept or decline. Acceptance is never forced; declines are real. Requires a mechanics discussion before any code. Strictly post-v1.
- **Rename.** Intentionally dropped from v1. If Anthropic ships `/buddy rename`, we defer to them. If they don't, we may add `/bb-rename` later — it would be the _only_ thing `buddy-buddy` writes to `~/.claude.json`, and that decision should be made deliberately, not by default.
- **Non-tmux capture paths.** tmux is required for v1. A future pass could add a macOS Accessibility API path for users who don't want tmux, at the cost of platform coupling and permission prompts. Revisit if demand materializes.
- **Upstream bubble event stream.** File a feature request with Anthropic for an official log or event stream of bubble utterances. If they ship one, the daemon can be retired entirely — the capture path becomes "tail the stream Anthropic provides." The forward-compat rule on TOON records means any existing journal stays valid through that transition.

---

## Extension points

When Anthropic ships new companion features, extend `buddy-buddy` by adding new TOON record types and new command modules — not by rewriting existing ones. The `v` field plus unknown-field preservation rule makes this safe: old journals stay valid, old records keep their semantics, new fields slot in on new records.

---

## Phases for v1

Mechanics are already resolved at the architectural level; implementation proceeds in phases with a single discussion gate at Phase 2.

### Phase 0 — repo setup

- [x] Create public GitHub repo: `buddy-buddy`
- [x] Add `SPEC.md` (this file)
- [x] Add `README.md` (one paragraph: what it is, what it needs, how to install)
- [x] Add `CONTRIBUTING.md` (short: how to propose new exercises or TOON record types)
- [x] Choose license (MIT suggested)
- [x] Add `.claude/` and `~/.claude/buddy/` to `.gitignore` — never commit personal buddy data

### Phase 1 — TOON foundation

- [x] Write a single `toon.js` / `toon.ts` parser/writer module: parse, serialize, append, validate unknown-field preservation
- [x] Tests: round-trip fidelity for `obs` and `ex` records, unknown-field preservation, append-only semantics, escape handling for strings with embedded quotes

### Phase 2 — daemon prototype (discussion gate)

- [x] **Discussion gate:** decide on runtime language (Node / Python / Go) based on how much bubble extraction logic is expected to be. No code before this conversation.
- [x] Write a throwaway script that calls `tmux capture-pane -p` in a loop and dumps the output, to study what bubble rendering actually looks like in the wild
- [x] Develop the bubble extraction heuristic iteratively against real `/buddy` output
- [x] Wire the extractor into a polling loop that writes `obs` records to a test journal

### Phase 3 — `/bb-watch`, `/bb-unwatch`

- [x] Promote the Phase 2 loop to a real daemon: background fork, pidfile, SIGTERM handling
- [x] Implement `/bb-watch` and `/bb-unwatch` as thin wrappers around daemon lifecycle

### Phase 4 — `/bb-missed`, `/bb-history`

- [x] Implement `last-seen.toon` pointer
- [x] `/bb-missed` reads journal entries newer than the pointer, displays them, updates the pointer on exit
- [x] `/bb-history [N]` reads and displays the last N entries regardless of pointer

### Phase 5 — `/bb-say`

- [x] Implement direct LLM call using `companion.personality` as system prompt
- [x] Implement context injection (default last 5 entries, `--context N`, `--no-context`, `--pin <ids>`)
- [x] Capture reply as new `ex` record in the journal

## Phase 5.5 - `bb-say` +

- [ ] Ensure bb-say is routed to the current account's buddy, even if using a different account's API key
- [ ] Response needs to capture more than the first line (responses are in chat not the bubble, seems like new lines cut it off)
- [ ] Update instructions and install script to require the API key or disable bb-say

### Phase 6 — first public share

- [ ] README with install instructions and a short demo
- [ ] Post to r/ClaudeAI and relevant dev channels
- [ ] Tag `v0.1.0`

---

## Notes for first-time open-source contributors

If you are new to open-sourcing a project: the goal for a first release is not completeness — it is a working core that others can run and react to. Phases 0–4 above are enough for a meaningful v0.1 _if you cut `/bb-say`_; Phases 0–5 are enough if you keep it. Ship that, share it, and let feedback shape what comes next.

The `CONTRIBUTING.md` file is more important than it sounds. Even one paragraph saying "open an issue before a PR" will save you from reviewing unwanted rewrites of the core.
