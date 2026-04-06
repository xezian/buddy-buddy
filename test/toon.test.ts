import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse, serialize, append } from '../src/toon.ts';

// --- parse ---

test('parse obs record', () => {
  const rec = parse('{type:obs v:1 ts:1775423560123 text:"called my null pointer a \'galaxy-brained failure\'. accurate."}');
  assert.equal(rec.type, 'obs');
  assert.equal(rec.v, 1);
  assert.equal(rec.ts, 1775423560123);
  assert.equal(rec.text, "called my null pointer a 'galaxy-brained failure'. accurate.");
});

test('parse ex record with ctx list', () => {
  const rec = parse('{type:ex v:1 ts:1775423700456 prompt:"what do you make of this function?" reply:"genuinely impressed you named a variable \'tmp\'" ctx:[1775423560123]}');
  assert.equal(rec.type, 'ex');
  assert.equal(rec.v, 1);
  assert.equal(rec.ts, 1775423700456);
  assert.equal(rec.prompt, 'what do you make of this function?');
  assert.equal(rec.reply, "genuinely impressed you named a variable 'tmp'");
  assert.deepEqual(rec.ctx, [1775423560123]);
});

test('parse empty ctx list', () => {
  const rec = parse('{type:ex v:1 ts:1000 prompt:"hi" reply:"hey" ctx:[]}');
  assert.deepEqual(rec.ctx, []);
});

test('parse ctx list with multiple ids', () => {
  const rec = parse('{type:ex v:1 ts:999 prompt:"hi" reply:"hey" ctx:[111 222 333]}');
  assert.deepEqual(rec.ctx, [111, 222, 333]);
});

test('parse string with embedded double quotes', () => {
  const rec = parse('{type:obs v:1 ts:1 text:"she said \\"hello\\""}');
  assert.equal(rec.text, 'she said "hello"');
});

test('parse string with embedded backslash', () => {
  const rec = parse('{type:obs v:1 ts:1 text:"path: C:\\\\Users"}');
  assert.equal(rec.text, 'path: C:\\Users');
});

test('parse string with backslash immediately before closing quote', () => {
  // "\\" in TOON is an escaped backslash, followed by the real closing "
  const rec = parse('{type:obs v:1 ts:1 text:"ends with \\\\"}');
  assert.equal(rec.text, 'ends with \\');
});

test('parse rejects non-record input', () => {
  assert.throws(() => parse('not a record'), /Invalid TOON record/);
  assert.throws(() => parse('{missing colon}'), /Invalid TOON token/);
});

// --- serialize ---

test('serialize obs record produces parseable output', () => {
  const line = serialize({ type: 'obs', v: 1, ts: 1775423560123, text: 'hello world' });
  assert.match(line, /^\{.*\}$/);
  const rec = parse(line);
  assert.equal(rec.type, 'obs');
  assert.equal(rec.v, 1);
  assert.equal(rec.ts, 1775423560123);
  assert.equal(rec.text, 'hello world');
});

test('serialize ex record with ctx list', () => {
  const line = serialize({ type: 'ex', v: 1, ts: 100, prompt: 'yo', reply: 'sup', ctx: [1, 2] });
  const rec = parse(line);
  assert.deepEqual(rec.ctx, [1, 2]);
});

// --- round-trip ---

test('round-trip obs record', () => {
  const original = { type: 'obs', v: 1, ts: 1775423560123, text: "called my null pointer a 'galaxy-brained failure'. accurate." };
  assert.deepEqual(parse(serialize(original)), original);
});

test('round-trip ex record', () => {
  const original = { type: 'ex', v: 1, ts: 1775423700456, prompt: 'what do you make of this?', reply: "genuinely impressed", ctx: [1775423560123] };
  assert.deepEqual(parse(serialize(original)), original);
});

test('round-trip string with double quotes', () => {
  const original = { type: 'obs', v: 1, ts: 1, text: 'she said "hello"' };
  assert.deepEqual(parse(serialize(original)), original);
});

test('round-trip string with backslash', () => {
  const original = { type: 'obs', v: 1, ts: 1, text: 'path: C:\\Users' };
  assert.deepEqual(parse(serialize(original)), original);
});

test('round-trip string with backslash-quote sequence', () => {
  const original = { type: 'obs', v: 1, ts: 1, text: 'tricky: \\"' };
  assert.deepEqual(parse(serialize(original)), original);
});

test('round-trip empty ctx list', () => {
  const original = { type: 'ex', v: 1, ts: 1, prompt: 'hi', reply: 'hey', ctx: [] };
  assert.deepEqual(parse(serialize(original)), original);
});

// --- unknown-field preservation ---

test('unknown fields survive parse → serialize → parse round-trip', () => {
  const line = '{type:obs v:1 ts:123 text:"hi" mood:"wistful" intensity:9}';
  const rec = parse(line);
  assert.equal(rec.mood, 'wistful');
  assert.equal(rec.intensity, 9);
  const reparsed = parse(serialize(rec));
  assert.equal(reparsed.mood, 'wistful');
  assert.equal(reparsed.intensity, 9);
});

test('unknown list field preserved on round-trip', () => {
  const line = '{type:obs v:1 ts:123 text:"hi" tags:[foo bar baz]}';
  const rec = parse(line);
  assert.deepEqual(rec.tags, ['foo', 'bar', 'baz']);
  const reparsed = parse(serialize(rec));
  assert.deepEqual(reparsed.tags, ['foo', 'bar', 'baz']);
});

// --- append ---

test('append creates file and writes record', async () => {
  const path = join(tmpdir(), `toon-test-${Date.now()}.toon`);
  try {
    const rec = { type: 'obs', v: 1, ts: 42, text: 'hello' };
    await append(path, rec);
    const content = await readFile(path, 'utf8');
    assert.match(content, /^\{.*\}\n$/);
    assert.deepEqual(parse(content.trim()), rec);
  } finally {
    await unlink(path).catch(() => {});
  }
});

test('append-only: second append preserves first record', async () => {
  const path = join(tmpdir(), `toon-test-${Date.now()}.toon`);
  try {
    const a = { type: 'obs', v: 1, ts: 1, text: 'first' };
    const b = { type: 'obs', v: 1, ts: 2, text: 'second' };
    await append(path, a);
    await append(path, b);
    const lines = (await readFile(path, 'utf8')).trim().split('\n');
    assert.equal(lines.length, 2);
    assert.deepEqual(parse(lines[0]), a);
    assert.deepEqual(parse(lines[1]), b);
  } finally {
    await unlink(path).catch(() => {});
  }
});
