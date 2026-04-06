/**
 * bb-missed — show journal entries captured since last check.
 * Invoked by the /bb-missed skill. Updates the last-seen pointer on exit.
 */

import {
  readJournal, readLastSeenTs, writeLastSeen, formatEntry,
} from './journal.ts';

const lastTs  = readLastSeenTs();
const records = readJournal();
const unseen  = records.filter(r => typeof r.ts === 'number' && (r.ts as number) > lastTs);

if (unseen.length === 0) {
  console.log('Nothing new since last check.');
  process.exit(0);
}

const count = unseen.length;
console.log(`${count} new ${count === 1 ? 'entry' : 'entries'} since last check.\n`);
console.log(unseen.map(formatEntry).join('\n\n'));

const maxTs = Math.max(...unseen.map(r => r.ts as number));
writeLastSeen(maxTs);
