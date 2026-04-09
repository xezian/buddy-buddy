# buddy-buddy

> **April 9, 2025 update:** Anthropic's `/buddy` companion was a April Fools feature (not very funny) and has been removed from Claude Code ([#45488](https://github.com/anthropics/claude-code/issues/45488)). `buddy-buddy` was built in the brief window when buddies were real. The code still works if the feature ever returns — until then, consider this repo a monument to companions lost too soon. 🪦

Exo-memory for your Claude Code `/buddy` companion. Captures the things your buddy says in passing to a persistent journal, and lets you speak with them directly — with their own past handed back as context.

Anthropic's `/buddy` system gives you a small terminal companion that sits beside your input box and comments in speech bubbles. Those bubbles are ephemeral: overwritten in place the moment anything redraws the screen, never entering your terminal's scrollback. If you missed what your buddy said, it's gone. On top of that, your buddy has no memory across sessions.

`buddy-buddy` fills both gaps. A small background daemon watches for bubbles while you work and saves each one to a local journal. A `/bb-say` command lets you address your buddy directly, optionally feeding recent journal entries back as context so they have continuity across sessions. Your buddy is never mutated — no training, no stat edits, no renames. `buddy-buddy` only observes, records, and relays.

## Requirements

- Claude Code with `/buddy` enabled (Pro or Max plan)
- Node.js 22.6+
- `tmux` — Claude Code must run inside a tmux session so the daemon can poll `tmux capture-pane`
- An Anthropic API key stored as `buddyApiKey` in `~/.claude.json` (used by `/bb-say` for standalone LLM calls — not required for the other commands)
- macOS or Linux (WSL2 on Windows should work; Windows-native terminals are not supported)

## Installation

```bash
git clone https://github.com/xezian/buddy-buddy.git
cd buddy-buddy
npm install
npm run install-commands
```

`install-commands` copies the five `/bb-*` slash commands to `~/.claude/commands/`, generates wrapper scripts in `~/.claude/buddy/bin/`, sets up auto-start via a `SessionStart` hook, and configures permissions so the commands run without prompts. Restart Claude Code after running it.

Verify tmux is installed:

```bash
tmux -V   # should print tmux 3.x or later
# if not: brew install tmux  (macOS)  or  sudo apt install tmux  (Linux)
```

## Usage

**Start a tmux session and launch Claude Code inside it:**

```bash
tmux new-session -s work
claude
```

The daemon starts automatically when Claude Code launches inside tmux (via a `SessionStart` hook). It watches all tmux panes, so multiple Claude Code instances are covered. You can also start it manually:

```
/bb-watch
```

**See what you missed:**

```
/bb-missed
```

Shows all bubbles captured since your last check, then marks them as seen.

**Browse full history:**

```
/bb-history
/bb-history 10
```

**Speak to your buddy directly:**

```
/bb-say how's it going?
/bb-say --no-context just a quick question
/bb-say --context 10 what do you make of all that?
/bb-say --pin 1775480433732 do you remember saying this?
```

Uses `companion.personality` from `~/.claude.json` as the system prompt. Last 5 journal entries are injected as context by default so your buddy has continuity. The reply is auto-captured as an exchange record.

**Stop the daemon:**

```
/bb-unwatch
```

## Journal

Everything is stored in `~/.claude/buddy/`:

```
~/.claude/buddy/
  journal.toon      # all captured bubbles and exchanges
  last-seen.toon    # pointer for /bb-missed
  daemon.pid        # daemon lifecycle
  daemon.log        # daemon stderr
  bin/              # wrapper scripts for clean command display
```

The journal format (TOON) is append-only, one record per line, human-readable:

```
{type:"obs" v:1 ts:1775480433732 text:"*scales bristle irritably*\nWrong PID. You killed process four, not your bug."}
{type:"ex" v:1 ts:1775480500000 prompt:"how's it going?" reply:"Fine. Mostly. The CSS thing is still bothering me." ctx:[1775480433732]}
```

## License

MIT. See [LICENSE](./LICENSE).
