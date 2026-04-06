/**
 * dump.ts — Phase 2 study tool (throwaway)
 *
 * Captures tmux pane output every second and writes annotated snapshots
 * to a file so we can study what buddy bubbles look like and iterate
 * on the extraction heuristic.
 *
 * Usage (inside an active tmux session with Claude Code running):
 *   node --experimental-strip-types scripts/dump.ts [output-file]
 *
 * Default output file: dump.txt (gitignored)
 * Press Ctrl+C to stop.
 */

import { execSync } from 'node:child_process';
import { writeFileSync, appendFileSync } from 'node:fs';
import { extractBubble } from '../src/extract.ts';

const INTERVAL_MS = 1000;
const outFile = process.argv[2] ?? 'dump.txt';

if (!process.env.TMUX) {
  console.error('Error: $TMUX is unset — run this inside a tmux session.');
  process.exit(1);
}

writeFileSync(outFile, `# buddy-buddy dump — ${new Date().toISOString()}\n\n`, 'utf8');
console.log(`Writing snapshots to ${outFile}  (Ctrl+C to stop)\n`);

let prev = '';
let n = 0;

function tick() {
  let pane: string;
  try {
    pane = execSync('tmux capture-pane -p', { encoding: 'utf8' });
  } catch {
    console.error('tmux capture-pane failed — are you still in a tmux session?');
    return;
  }

  if (pane === prev) return;
  prev = pane;
  n++;

  const ts = Date.now();
  const match = extractBubble(pane);
  const label = match ? `BUBBLE: ${JSON.stringify(match.text)}` : '(no bubble)';

  appendFileSync(
    outFile,
    `=== SNAPSHOT ${n} ts:${ts} ===\n${pane}\n=== EXTRACT ===\n${label}\n\n`,
    'utf8',
  );

  console.log(`[${n}] ${label}`);
  if (match) {
    console.log('  raw lines:');
    match.rawLines.forEach(l => console.log('  ' + JSON.stringify(l)));
  }
}

tick();
setInterval(tick, INTERVAL_MS);
