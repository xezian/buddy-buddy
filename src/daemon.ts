/**
 * buddy-buddy background daemon.
 *
 * Polls ALL tmux panes every 2s, extracts bubble text, deduplicates
 * per-pane, and appends obs records to ~/.claude/buddy/journal.toon.
 *
 * Started by /bb-watch — do not invoke directly.
 * Stopped by /bb-unwatch via SIGTERM.
 *
 * Usage:
 *   node --experimental-strip-types src/daemon.ts
 *
 * No arguments required — discovers panes automatically via tmux list-panes.
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

// Verify tmux is available at startup.
try {
  execSync('tmux list-panes -a -F "#{pane_id}"', { encoding: 'utf8' });
} catch {
  process.stderr.write('Error: tmux is not available or no server is running.\n');
  process.exit(1);
}

mkdirSync(BUDDY_DIR, { recursive: true });
writeFileSync(PIDFILE, String(process.pid), 'utf8');

function cleanup(): void {
  try { unlinkSync(PIDFILE); } catch { /* already gone */ }
}

process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('SIGINT',  () => { cleanup(); process.exit(0); });

/** Last bubble text seen per pane, keyed by pane ID (e.g. "%3"). */
const lastTextByPane = new Map<string, string>();
let consecutiveFailures = 0;
const MAX_FAILURES = 3;

function discoverPanes(): string[] {
  try {
    const out = execSync('tmux list-panes -a -F "#{pane_id}"', { encoding: 'utf8' });
    return out.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

async function poll(): Promise<void> {
  const panes = discoverPanes();
  if (panes.length === 0) {
    consecutiveFailures++;
    if (consecutiveFailures >= MAX_FAILURES) {
      cleanup();
      process.exit(0);
    }
    return;
  }
  consecutiveFailures = 0;

  for (const paneId of panes) {
    let pane: string;
    try {
      pane = execSync(`tmux capture-pane -p -t ${paneId}`, { encoding: 'utf8' });
    } catch {
      // Pane may have closed between list and capture — skip it.
      continue;
    }

    const match = extractBubble(pane);
    if (!match || match.text === lastTextByPane.get(paneId)) continue;

    lastTextByPane.set(paneId, match.text);
    await append(JOURNAL, { type: 'obs', v: 1, ts: Date.now(), text: match.text });
  }

  // Prune stale pane entries that no longer exist.
  for (const key of lastTextByPane.keys()) {
    if (!panes.includes(key)) lastTextByPane.delete(key);
  }
}

poll();
setInterval(poll, POLL_MS);
