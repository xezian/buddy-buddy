import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractBubble } from '../src/extract.ts';

function makePane(lines: string[]): string {
  return lines.join('\n');
}

test('returns null when no bubble present', () => {
  assert.equal(extractBubble('just some text\nno boxes here\n'), null);
  assert.equal(extractBubble(''), null);
});

test('extracts single-line bubble', () => {
  const pane = makePane([
    '                                    ',
    '╭──────────────────╮',
    '│ hello from buddy │',
    '╰──────────────────╯',
    '> ',
  ]);
  const match = extractBubble(pane);
  assert.ok(match);
  assert.equal(match.text, 'hello from buddy');
});

test('extracts multi-line bubble', () => {
  const pane = makePane([
    '╭────────────────────╮',
    '│ line one           │',
    '│ line two           │',
    '╰────────────────────╯',
  ]);
  const match = extractBubble(pane);
  assert.ok(match);
  assert.equal(match.text, 'line one\nline two');
});

test('extracts bubble at non-zero column', () => {
  const pane = makePane([
    'some ui on the left   ╭──────────╮',
    'some ui on the left   │ hi there │',
    'some ui on the left   ╰──────────╯',
    '> input here',
  ]);
  const match = extractBubble(pane);
  assert.ok(match);
  assert.equal(match.text, 'hi there');
});

test('picks the last (most recent) bubble when multiple exist', () => {
  const pane = makePane([
    '╭───────────╮',
    '│ old bubble │',
    '╰───────────╯',
    '',
    '╭────────────╮',
    '│ new bubble │',
    '╰────────────╯',
    '> ',
  ]);
  const match = extractBubble(pane);
  assert.ok(match);
  assert.equal(match.text, 'new bubble');
});

test('returns null for unclosed bubble (no bottom border)', () => {
  const pane = makePane([
    '╭──────────╮',
    '│ no close │',
  ]);
  assert.equal(extractBubble(pane), null);
});

test('rawLines includes only the bubble region', () => {
  const pane = makePane([
    'noise',
    '╭──────────╮',
    '│ hi       │',
    '╰──────────╯',
    'more noise',
  ]);
  const match = extractBubble(pane);
  assert.ok(match);
  assert.equal(match.rawLines.length, 3);
  assert.ok(match.rawLines[0].includes('╭'));
  assert.ok(match.rawLines[2].includes('╰'));
});
