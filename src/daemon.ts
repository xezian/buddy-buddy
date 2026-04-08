/**
 * buddy-buddy background daemon.
 *
 * Polls a specific tmux pane every 2s, extracts bubble text, deduplicates,
 * and appends obs records to ~/.claude/buddy/journal.toon.
 *
 * Started by /bb-watch — do not invoke directly.
 * Stopped by /bb-unwatch via SIGTERM.
 *
 * Usage:
 *   node --experimental-strip-types src/daemon.ts <pane-target>
 *
 * pane-target: tmux global pane ID (e.g. %3) — passed by /bb-watch from $TMUX_PANE.
 */

import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { extractBubble } from './extract.ts';
import { append } from './toon.ts';

const BUDDY_DIR = join(homedir(), '.claude', 'buddy');
const JOURNAL   = join(BUDDY_DIR, 'journal.toon');
const PIDFILE   = join(BUDDY_DIR, 'daemon.pid');
const POLL_MS   = 2000;

const paneTarget = process.argv[2] ?? process.env.TMUX_PANE;

if (!paneTarget) {
  process.stderr.write(
    'Error: no pane target. Pass the tmux pane ID as the first argument.\n'
  );
  process.exit(1);
}

mkdirSync(BUDDY_DIR, { recursive: true });
writeFileSync(PIDFILE, String(process.pid), 'utf8');

function cleanup(): void {
  try { unlinkSync(PIDFILE); } catch { /* already gone */ }
}

process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('SIGINT',  () => { cleanup(); process.exit(0); });

let lastText = '';
let consecutiveFailures = 0;
const MAX_FAILURES = 3;

async function poll(): Promise<void> {
  let pane: string;
  try {
    pane = execSync(`tmux capture-pane -p -t ${paneTarget}`, { encoding: 'utf8' });
    consecutiveFailures = 0;
  } catch {
    consecutiveFailures++;
    if (consecutiveFailures >= MAX_FAILURES) {
      cleanup();
      process.exit(0);
    }
    return;
  }

  const match = extractBubble(pane);
  if (!match || match.text === lastText) return;

  lastText = match.text;
  await append(JOURNAL, { type: 'obs', v: 1, ts: Date.now(), text: match.text });
}

poll();
setInterval(poll, POLL_MS);
