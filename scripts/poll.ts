/**
 * poll.ts — Phase 2 polling prototype
 *
 * Polls tmux capture-pane every 2 seconds, extracts bubble text,
 * deduplicates, and appends obs records to a test journal.
 * This is the loop that becomes the real daemon in Phase 3.
 *
 * Usage (inside tmux with Claude Code running):
 *   node --experimental-strip-types scripts/poll.ts [journal.toon]
 *
 * Default journal: /tmp/bb-test.toon
 */

import { execSync } from 'node:child_process';
import { extractBubble } from '../src/extract.ts';
import { append } from '../src/toon.ts';

const POLL_MS = 2000;
const journal = process.argv[2] ?? '/tmp/bb-test.toon';

if (!process.env.TMUX) {
  console.error('Error: $TMUX is unset — run this inside a tmux session.');
  process.exit(1);
}

console.log(`Polling every ${POLL_MS / 1000}s — writing obs records to ${journal}`);
console.log('Press Ctrl+C to stop.\n');

let lastText = '';

async function poll() {
  let pane: string;
  try {
    pane = execSync('tmux capture-pane -p', { encoding: 'utf8' });
  } catch {
    return; // tmux gone; ignore until next tick
  }

  const match = extractBubble(pane);
  if (!match || match.text === lastText) return;

  lastText = match.text;
  const record = { type: 'obs', v: 1, ts: Date.now(), text: match.text };

  await append(journal, record);
  console.log(`obs recorded: ${JSON.stringify(match.text)}`);
}

poll();
setInterval(poll, POLL_MS);
