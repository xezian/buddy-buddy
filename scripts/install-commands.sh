#!/usr/bin/env bash
# Install buddy-buddy slash commands to ~/.claude/commands/
# Replaces $(pwd) in each file with the actual buddy-buddy directory path.

set -euo pipefail

BUDDY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$HOME/.claude/commands"

mkdir -p "$DEST"

for src in "$BUDDY_DIR/.claude/commands"/bb-*.md; do
  name="$(basename "$src")"
  sed "s|\$(pwd)|$BUDDY_DIR|g" "$src" > "$DEST/$name"
  echo "  installed: $DEST/$name"
done

echo ""
echo "Done. Restart Claude Code to pick up /bb-watch, /bb-unwatch, /bb-missed, /bb-history, /bb-say."
