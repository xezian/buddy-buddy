Start the buddy-buddy daemon to capture your buddy's speech bubbles in the background.

Use the Bash tool to run each step.

**1. Verify tmux**
```bash
echo "${TMUX:-unset}"
```
If output is `unset`, stop and report: "bb-watch requires an active tmux session. Launch Claude Code inside tmux first."

**2. Check for existing daemon**
```bash
pid=$(cat ~/.claude/buddy/daemon.pid 2>/dev/null)
[ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && echo "running:$pid" || echo "stopped"
```
If output starts with `running:`, stop and report: "Daemon is already running (PID shown). Use /bb-unwatch to stop it first."

**3. Ensure state directory**
```bash
mkdir -p ~/.claude/buddy
```

**4. Launch daemon (detached)**
```bash
nohup ~/.claude/buddy/bin/bb-daemon \
  </dev/null >>~/.claude/buddy/daemon.log 2>&1 &
disown $!
sleep 1
cat ~/.claude/buddy/daemon.pid 2>/dev/null || echo "failed"
```
If output is `failed`, report: "Daemon failed to start. Check ~/.claude/buddy/daemon.log."

**5. Report success**
Tell the user: "Watching. Your buddy's bubbles are being captured to ~/.claude/buddy/journal.toon"
