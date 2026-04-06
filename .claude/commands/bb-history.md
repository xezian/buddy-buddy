Show buddy journal history. Accepts an optional number of entries to display.

$ARGUMENTS contains the optional N provided by the user (e.g. `/bb-history 10`).

Run:
```bash
node --experimental-strip-types "$(pwd)/src/bb-history.ts" $ARGUMENTS
```

Display the output directly to the user. No commentary needed — the script output is the full response.
