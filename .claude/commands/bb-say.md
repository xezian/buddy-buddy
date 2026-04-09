Speak directly to your buddy. The exchange is automatically recorded to the journal.

$ARGUMENTS contains the user's message and any optional flags:
  --context N     use last N journal entries as context (default: 5)
  --no-context    disable context injection
  --pin <ids>     use specific entry IDs (ts values) as context instead of recent-N

Run:
```bash
~/.claude/buddy/bin/bb-say $ARGUMENTS
```

Output the script's stdout exactly as-is, preserving every line and newline. No summarizing, no truncating, no commentary.
