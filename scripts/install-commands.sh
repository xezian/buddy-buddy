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

# --- generate bin wrappers ---
BIN_DIR="$HOME/.claude/buddy/bin"
mkdir -p "$BIN_DIR"

NODE_FLAGS="--no-warnings --experimental-strip-types"

for pair in \
  "bb-missed:$BUDDY_DIR/src/bb-missed.ts" \
  "bb-history:$BUDDY_DIR/src/bb-history.ts" \
  "bb-say:$BUDDY_DIR/src/bb-say.ts" \
  "bb-daemon:$BUDDY_DIR/src/daemon.ts"; do
  cmd="${pair%%:*}"
  script="${pair#*:}"
  cat > "$BIN_DIR/$cmd" <<WRAPPER
#!/usr/bin/env bash
exec node $NODE_FLAGS "$script" "\$@"
WRAPPER
  chmod +x "$BIN_DIR/$cmd"
  echo "  wrapper: $BIN_DIR/$cmd"
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
bin = '~/.claude/buddy/bin'
new_perms = [
    f'Bash({bin}/bb-missed)',
    f'Bash({bin}/bb-history*)',
    f'Bash({bin}/bb-say*)',
    f'Bash({bin}/bb-daemon*)',
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
    f'( pid=$(cat ~/.claude/buddy/daemon.pid 2>/dev/null) && '
    f'kill -0 "$pid" 2>/dev/null || '
    f'( mkdir -p ~/.claude/buddy && '
    f'nohup {bin}/bb-daemon '
    f'</dev/null >>~/.claude/buddy/daemon.log 2>&1 & disown $! ) ); true'
)
hook_entry = {'hooks': [{'type': 'command', 'command': start_cmd}]}

all_hooks = s.setdefault('hooks', {})
session_hooks = all_hooks.setdefault('SessionStart', [])
# replace any existing buddy-buddy SessionStart hook
session_hooks[:] = [h for h in session_hooks if 'bb-daemon' not in json.dumps(h)]
session_hooks.append(hook_entry)

# clean up old mis-placed key from earlier installs
s.pop('SessionStart', None)

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
