import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readJournal, readLastSeenTs, writeLastSeen, formatEntry,
} from '../src/journal.ts';

const tmp = () => join(tmpdir(), `bb-test-${Date.now()}-${Math.random()}.toon`);

// --- readJournal ---

test('readJournal returns empty array when file missing', () => {
  assert.deepEqual(readJournal('/nonexistent/path.toon'), []);
});

test('readJournal parses obs records from file', () => {
  const path = tmp();
  try {
    writeFileSync(path, '{type:"obs" v:1 ts:100 text:"hello"}\n{type:"obs" v:1 ts:200 text:"world"}\n', 'utf8');
    const records = readJournal(path);
    assert.equal(records.length, 2);
    assert.equal(records[0].ts, 100);
    assert.equal(records[1].text, 'world');
  } finally {
    unlinkSync(path);
  }
});

test('readJournal skips blank lines', () => {
  const path = tmp();
  try {
    writeFileSync(path, '\n{type:"obs" v:1 ts:1 text:"hi"}\n\n', 'utf8');
    assert.equal(readJournal(path).length, 1);
  } finally {
    unlinkSync(path);
  }
});

// --- readLastSeenTs ---

test('readLastSeenTs returns 0 when file missing', () => {
  assert.equal(readLastSeenTs('/nonexistent/last-seen.toon'), 0);
});

test('readLastSeenTs returns ts from valid file', () => {
  const path = tmp();
  try {
    writeFileSync(path, '{type:"seen" v:1 ts:12345}\n', 'utf8');
    assert.equal(readLastSeenTs(path), 12345);
  } finally {
    unlinkSync(path);
  }
});

// --- writeLastSeen ---

test('writeLastSeen creates file with correct ts', () => {
  const path = tmp();
  try {
    writeLastSeen(99999, path);
    assert.equal(readLastSeenTs(path), 99999);
  } finally {
    unlinkSync(path);
  }
});

test('writeLastSeen overwrites existing pointer', () => {
  const path = tmp();
  try {
    writeLastSeen(111, path);
    writeLastSeen(222, path);
    assert.equal(readLastSeenTs(path), 222);
  } finally {
    unlinkSync(path);
  }
});

// --- formatEntry ---

test('formatEntry formats obs record', () => {
  const out = formatEntry({ type: 'obs', v: 1, ts: 1775480433732, text: 'hello there' });
  assert.ok(out.includes('hello there'));
  assert.ok(out.includes('──'));
});

test('formatEntry formats ex record', () => {
  const out = formatEntry({ type: 'ex', v: 1, ts: 1775480433732, prompt: 'yo?', reply: 'sup.' });
  assert.ok(out.includes('You: yo?'));
  assert.ok(out.includes('Jetsam: sup.'));
});

test('formatEntry handles unknown type gracefully', () => {
  const out = formatEntry({ type: 'future', v: 2, ts: 1, data: 'something' });
  assert.ok(out.includes('──'));
  assert.ok(out.includes('future'));
});
