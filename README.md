# buddy-buddy

Exo-memory for your Claude Code `/buddy` companion. Captures the things your buddy says in passing to a persistent journal, and lets you speak with them directly — with their own past handed back as context.

Anthropic's `/buddy` system shipped on April 1, 2026. It gives you a small terminal companion that sits beside your input box and comments in speech bubbles. Those bubbles are ephemeral: they're overwritten in place the moment anything redraws the input line, and they never enter your terminal's scrollback. If you were heads-down on something and missed what your buddy said, it's gone. On top of that, your buddy has no memory across sessions — species, rarity, and stats are hash-recomputed from your account ID every time Claude Code starts.

`buddy-buddy` fills both gaps. A small background daemon watches for bubbles while you work and saves each one to a local journal. A `/bb-say` command lets you address your buddy directly via a dedicated LLM call that uses their personality as its system prompt, optionally feeding recent journal entries back as context so the buddy has continuity across days. Your buddy itself is never mutated — no training, no stat edits, no renames. `buddy-buddy` only observes, records, and relays.

## Status

**Pre-implementation.** This repository currently contains only the design documents. No working code yet. See [`SPEC.md`](./SPEC.md) for the full architecture and implementation plan.

## Requirements (planned)

- Claude Code with `/buddy` enabled (Pro or Max plan)
- `tmux` — the daemon captures bubbles by polling `tmux capture-pane`, so Claude Code must be run inside an active tmux session
- macOS, Linux, or WSL2 on Windows. Windows-native terminals are not supported in v1.

## Installation

Not yet available. Check back after v0.1.0 ships.

## License

MIT. See [LICENSE](./LICENSE).
