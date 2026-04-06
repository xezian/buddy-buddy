Stop the buddy-buddy background daemon.

Use the Bash tool to run each step.

**1. Read pidfile**
```bash
cat ~/.claude/buddy/daemon.pid 2>/dev/null || echo "none"
```
If output is `none`, report: "No daemon is running." and stop.

**2. Stop the daemon**
```bash
pid=$(cat ~/.claude/buddy/daemon.pid)
kill -TERM "$pid" 2>/dev/null && echo "stopped:$pid" || echo "gone"
```
The daemon removes its own pidfile on SIGTERM.

**3. Confirm**
If output starts with `stopped:`, report: "Daemon stopped."
If output is `gone`, report: "Process was already gone — cleaning up." then run:
```bash
rm -f ~/.claude/buddy/daemon.pid
```
