#!/usr/bin/env bash
# Install buddy-buddy slash commands to ~/.claude/commands/
# Replaces $(pwd) in each file with the actual buddy-buddy directory path.
# Also patches ~/.claude/settings.json with permissions and a SessionStart hook.

set -euo pipefail

BUDDY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$HOME/.claude/commands"

mkdir -p "$DEST"

for src in "$BUDDY_DIR/.claude/commands"/bb-*.md; do
  name="$(basename "$src")"
  sed "s|\$(pwd)|$BUDDY_DIR|g" "$src" > "$DEST/$name"
  echo "  installed: $DEST/$name"
done

# --- patch ~/.claude/settings.json ---
SETTINGS="$HOME/.claude/settings.json"

python3 - "$BUDDY_DIR" "$SETTINGS" <<'PYEOF'
import json, sys, os

buddy_dir, settings_path = sys.argv[1], sys.argv[2]

try:
    with open(settings_path) as f:
        s = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    s = {}

# permissions
s.setdefault('permissions', {}).setdefault('allow', [])
new_perms = [
    f'Bash(node --experimental-strip-types "{buddy_dir}/src/bb-missed.ts")',
    f'Bash(node --experimental-strip-types "{buddy_dir}/src/bb-history.ts"*)',
    f'Bash(node --experimental-strip-types "{buddy_dir}/src/bb-say.ts"*)',
    f'Bash(node --experimental-strip-types "{buddy_dir}/src/daemon.ts"*)',
    'Bash(cat ~/.claude/buddy/daemon.pid*)',
    'Bash(kill -0 *)',
    'Bash(kill -TERM *)',
    'Bash(mkdir -p ~/.claude/buddy)',
    'Bash(rm -f ~/.claude/buddy/daemon.pid)',
]
for p in new_perms:
    if p not in s['permissions']['allow']:
        s['permissions']['allow'].append(p)

# SessionStart hook — start daemon automatically when in tmux
start_cmd = (
    f'[ -n "$TMUX" ] && '
    f'pid=$(cat ~/.claude/buddy/daemon.pid 2>/dev/null) && '
    f'kill -0 "$pid" 2>/dev/null || '
    f'( mkdir -p ~/.claude/buddy && '
    f'nohup node --experimental-strip-types "{buddy_dir}/src/daemon.ts" "${{TMUX_PANE}}" '
    f'</dev/null >>~/.claude/buddy/daemon.log 2>&1 & disown $! ); true'
)
hook_entry = {'matcher': '', 'hooks': [{'type': 'command', 'command': start_cmd}]}

hooks = s.setdefault('SessionStart', [])
# replace any existing buddy-buddy SessionStart hook
hooks[:] = [h for h in hooks if buddy_dir not in json.dumps(h)]
hooks.append(hook_entry)

with open(settings_path, 'w') as f:
    json.dump(s, f, indent=2)
    f.write('\n')

print(f'  patched: {settings_path}')
PYEOF

# --- check buddyApiKey ---
echo ""
python3 - <<'PYEOF'
import json, os
path = os.path.expanduser('~/.claude.json')
try:
    d = json.load(open(path))
    if d.get('buddyApiKey'):
        print('  buddyApiKey: found ✓')
    else:
        print('  buddyApiKey: NOT SET')
        print('')
        print('  /bb-say needs an Anthropic API key stored in ~/.claude.json.')
        print('  Add it with:')
        print('    node -e "const fs=require(\'fs\'),p=os.homedir()+\'/.claude.json\',d=JSON.parse(fs.readFileSync(p));d.buddyApiKey=\'sk-ant-...\';fs.writeFileSync(p,JSON.stringify(d,null,2))"')
        print('  or edit ~/.claude.json directly and add: "buddyApiKey": "sk-ant-..."')
        print('  Without it, /bb-watch, /bb-missed, and /bb-history still work fine.')
except Exception as e:
    print(f'  could not read ~/.claude.json: {e}')
PYEOF

echo ""
echo "Done. Restart Claude Code to pick up /bb-watch, /bb-unwatch, /bb-missed, /bb-history, /bb-say."
echo ""
echo "Notes:"
echo "  - The SessionStart hook will auto-start the daemon when Claude Code launches in tmux."
echo "  - The daemon stops itself when the watched tmux pane closes."
echo "  - For tmux mouse support (scroll, click panes), add to ~/.tmux.conf:"
echo "      set -g mouse on"
