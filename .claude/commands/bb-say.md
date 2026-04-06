Speak directly to your buddy. The exchange is automatically recorded to the journal.

$ARGUMENTS contains the user's message and any optional flags:
  --context N     use last N journal entries as context (default: 5)
  --no-context    disable context injection
  --pin <ids>     use specific entry IDs (ts values) as context instead of recent-N

Run:
```bash
node --experimental-strip-types "$(pwd)/src/bb-say.ts" $ARGUMENTS
```

Display the output (your buddy's reply) to the user. No extra commentary needed.
