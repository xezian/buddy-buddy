import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, selectContext, buildSystemPrompt } from '../src/bb-say.ts';
import type { ToonRecord } from '../src/toon.ts';

const obs = (ts: number, text: string): ToonRecord => ({ type: 'obs', v: 1, ts, text });
const ex  = (ts: number, prompt: string, reply: string): ToonRecord =>
  ({ type: 'ex', v: 1, ts, prompt, reply });

// --- parseArgs ---

test('parseArgs: bare message', () => {
  const r = parseArgs(['node', 'bb-say.ts', 'hello', 'there']);
  assert.equal(r.message, 'hello there');
  assert.equal(r.contextN, 5);
  assert.deepEqual(r.pinIds, []);
});

test('parseArgs: --no-context', () => {
  const r = parseArgs(['node', 'bb-say.ts', '--no-context', 'hi']);
  assert.equal(r.contextN, false);
  assert.equal(r.message, 'hi');
});

test('parseArgs: --context N', () => {
  const r = parseArgs(['node', 'bb-say.ts', '--context', '10', 'hi']);
  assert.equal(r.contextN, 10);
});

test('parseArgs: --pin ids', () => {
  const r = parseArgs(['node', 'bb-say.ts', '--pin', '111', '222', 'what?']);
  assert.deepEqual(r.pinIds, [111, 222]);
  assert.equal(r.message, 'what?');
});

test('parseArgs: flags before and message last', () => {
  const r = parseArgs(['node', 'bb-say.ts', '--context', '3', 'tell me something']);
  assert.equal(r.contextN, 3);
  assert.equal(r.message, 'tell me something');
});

test('parseArgs: empty message', () => {
  const r = parseArgs(['node', 'bb-say.ts']);
  assert.equal(r.message, '');
});

// --- selectContext ---

const records: ToonRecord[] = [
  obs(1, 'first'),
  obs(2, 'second'),
  obs(3, 'third'),
  obs(4, 'fourth'),
  obs(5, 'fifth'),
  obs(6, 'sixth'),
];

test('selectContext: default last 5', () => {
  const ctx = selectContext(records, { contextN: 5, pinIds: [] });
  assert.equal(ctx.length, 5);
  assert.equal(ctx[0].ts, 2);
  assert.equal(ctx[4].ts, 6);
});

test('selectContext: --no-context returns empty', () => {
  assert.deepEqual(selectContext(records, { contextN: false, pinIds: [] }), []);
});

test('selectContext: --context N', () => {
  const ctx = selectContext(records, { contextN: 2, pinIds: [] });
  assert.equal(ctx.length, 2);
  assert.equal((ctx[0].ts as number), 5);
});

test('selectContext: --pin specific ids', () => {
  const ctx = selectContext(records, { contextN: 5, pinIds: [1, 3] });
  assert.equal(ctx.length, 2);
  assert.equal((ctx[0].ts as number), 1);
  assert.equal((ctx[1].ts as number), 3);
});

test('selectContext: --pin with unknown id is ignored', () => {
  const ctx = selectContext(records, { contextN: 5, pinIds: [1, 999] });
  assert.equal(ctx.length, 1);
});

// --- buildSystemPrompt ---

test('buildSystemPrompt: no context returns personality unchanged', () => {
  assert.equal(buildSystemPrompt('be a dragon', []), 'be a dragon');
});

test('buildSystemPrompt: includes "here is what you said recently"', () => {
  const prompt = buildSystemPrompt('be a dragon', [obs(1000, 'I saw a bug')]);
  assert.ok(prompt.includes('Here is what you said recently'));
  assert.ok(prompt.includes('I saw a bug'));
});

test('buildSystemPrompt: obs entry formatted with You said:', () => {
  const prompt = buildSystemPrompt('x', [obs(1775480000000, 'hmm')]);
  assert.ok(prompt.includes('You said: "hmm"'));
});

test('buildSystemPrompt: ex entry shows both sides', () => {
  const prompt = buildSystemPrompt('x', [ex(1775480000000, 'question?', 'answer.')]);
  assert.ok(prompt.includes('User: "question?"'));
  assert.ok(prompt.includes('You replied: "answer."'));
});
