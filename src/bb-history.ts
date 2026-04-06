/**
 * bb-history [N] — show the last N journal entries (default: all).
 * Invoked by the /bb-history skill.
 */

import { readJournal, formatEntry } from './journal.ts';

const n   = process.argv[2] ? parseInt(process.argv[2], 10) : NaN;
const all = readJournal();

if (all.length === 0) {
  console.log('No journal entries yet.');
  process.exit(0);
}

const entries = !isNaN(n) ? all.slice(-n) : all;

if (!isNaN(n) && all.length > entries.length) {
  console.log(`Showing last ${entries.length} of ${all.length} entries.\n`);
}

console.log(entries.map(formatEntry).join('\n\n'));
