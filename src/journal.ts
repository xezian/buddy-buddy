/**
 * Shared journal utilities: read, format, and manage the last-seen pointer.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parse, serialize, type ToonRecord } from './toon.ts';

export const BUDDY_DIR      = join(homedir(), '.claude', 'buddy');
export const JOURNAL_PATH   = join(BUDDY_DIR, 'journal.toon');
export const LAST_SEEN_PATH = join(BUDDY_DIR, 'last-seen.toon');

const CLAUDE_JSON = join(homedir(), '.claude.json');

function readBuddyName(): string {
  try {
    const data = JSON.parse(readFileSync(CLAUDE_JSON, 'utf8'));
    const name = data?.companion?.name;
    if (typeof name === 'string' && name.trim()) return name.trim();
  } catch { /* ignore */ }
  return 'buddy';
}

/** Parse every non-blank line in the journal file into a ToonRecord array. */
export function readJournal(path = JOURNAL_PATH): ToonRecord[] {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return [];
  }
  const records: ToonRecord[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try { records.push(parse(line)); } catch { /* skip malformed lines */ }
  }
  return records;
}

/** Return the ts of the last entry the user has seen, or 0 if never checked. */
export function readLastSeenTs(path = LAST_SEEN_PATH): number {
  try {
    const record = parse(readFileSync(path, 'utf8').trim());
    return typeof record.ts === 'number' ? record.ts : 0;
  } catch {
    return 0;
  }
}

/** Overwrite last-seen.toon with a new pointer ts. */
export function writeLastSeen(ts: number, path = LAST_SEEN_PATH): void {
  writeFileSync(path, serialize({ type: 'seen', v: 1, ts }) + '\n', 'utf8');
}

/** Format a single journal record for human display. */
export function formatEntry(record: ToonRecord): string {
  const ts   = record.ts   as number;
  const type = record.type as string;

  const d = new Date(ts);
  const label = d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const header = `── ${label} ${'─'.repeat(30)}`;

  if (type === 'obs') {
    return `${header}\n${record.text as string}`;
  }
  if (type === 'ex') {
    const name = readBuddyName();
    return `${header}\nYou: ${record.prompt as string}\n${name}: ${record.reply as string}`;
  }
  return `${header}\n${JSON.stringify(record)}`;
}
