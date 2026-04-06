/**
 * TOON — Terse Object-Oriented Notation
 * On-disk format for the buddy-buddy journal.
 *
 * Wire format examples:
 *   {type:obs v:1 ts:1775423560123 text:"called my null pointer a 'galaxy-brained failure'. accurate."}
 *   {type:ex v:1 ts:1775423700456 prompt:"what do you make of this function?" reply:"genuinely impressed you named a variable 'tmp'" ctx:[1775423560123]}
 *
 * Rules:
 *   - One record per line, wrapped in { }
 *   - Fields are space-separated key:value pairs
 *   - Strings are double-quoted; " and \ inside strings are backslash-escaped
 *   - Lists use [space-separated elements]
 *   - Integers are unquoted
 *   - Unknown fields are preserved on round-trip
 */

import { appendFile } from 'node:fs/promises';

export type ToonValue = string | number | ToonValue[];
export type ToonRecord = Record<string, ToonValue>;

/**
 * Parse a single TOON record line into a plain JS object.
 * Numbers come back as JS numbers; everything else is a string or array.
 * Unknown fields are preserved.
 */
export function parse(line: string): ToonRecord {
  line = line.trim();
  if (!line.startsWith('{') || !line.endsWith('}')) {
    throw new Error(`Invalid TOON record: must be wrapped in { }`);
  }
  const inner = line.slice(1, -1).trim();
  if (!inner) return {};

  const tokens = tokenize(inner);
  const record: ToonRecord = {};
  for (const token of tokens) {
    const colon = token.indexOf(':');
    if (colon === -1) throw new Error(`Invalid TOON token (no colon): ${token}`);
    const key = token.slice(0, colon);
    record[key] = parseValue(token.slice(colon + 1));
  }
  return record;
}

/**
 * Serialize a plain JS object into a TOON record line.
 * Numbers are unquoted. Strings are double-quoted. Arrays use [].
 */
export function serialize(record: ToonRecord): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    parts.push(`${key}:${serializeValue(value)}`);
  }
  return '{' + parts.join(' ') + '}';
}

/**
 * Append a record to a TOON file. Creates the file if absent.
 */
export async function append(filePath: string, record: ToonRecord): Promise<void> {
  await appendFile(filePath, serialize(record) + '\n', 'utf8');
}

// --- internals ---

/**
 * Split inner record content into key:rawValue tokens.
 * Respects quoted strings (with \" and \\ escapes) and [lists].
 */
function tokenize(inner: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let i = 0;

  while (i < inner.length) {
    const ch = inner[i];

    if (ch === ' ') {
      if (current) { tokens.push(current); current = ''; }
      i++;
    } else if (ch === '"') {
      // Quoted string value — read including delimiters, respecting \" and \\
      current += ch;
      i++;
      while (i < inner.length) {
        const c = inner[i];
        if (c === '\\' && i + 1 < inner.length &&
            (inner[i + 1] === '"' || inner[i + 1] === '\\')) {
          current += c + inner[i + 1];
          i += 2;
        } else if (c === '"') {
          current += c;
          i++;
          break;
        } else {
          current += c;
          i++;
        }
      }
    } else if (ch === '[') {
      // List value — read until ]
      current += ch;
      i++;
      while (i < inner.length && inner[i] !== ']') {
        current += inner[i];
        i++;
      }
      if (i < inner.length) { current += ']'; i++; }
    } else {
      current += ch;
      i++;
    }
  }

  if (current) tokens.push(current);
  return tokens;
}

function parseValue(raw: string): ToonValue {
  if (raw.startsWith('"')) {
    return raw.slice(1, -1).replace(/\\(["\\nrt])/g, (_, c) => {
      const map: Record<string, string> = { '"': '"', '\\': '\\', n: '\n', r: '\r', t: '\t' };
      return map[c] ?? c;
    });
  }
  if (raw.startsWith('[')) {
    return parseListElements(raw.slice(1, -1).trim());
  }
  return parseScalar(raw);
}

function parseListElements(inner: string): ToonValue[] {
  if (!inner) return [];
  const elements: ToonValue[] = [];
  let i = 0;
  while (i < inner.length) {
    while (i < inner.length && inner[i] === ' ') i++;
    if (i >= inner.length) break;
    let raw = '';
    if (inner[i] === '"') {
      raw += '"';
      i++;
      while (i < inner.length) {
        const c = inner[i];
        if (c === '\\' && i + 1 < inner.length &&
            (inner[i + 1] === '"' || inner[i + 1] === '\\')) {
          raw += c + inner[i + 1];
          i += 2;
        } else if (c === '"') {
          raw += c; i++; break;
        } else {
          raw += c; i++;
        }
      }
    } else {
      while (i < inner.length && inner[i] !== ' ') raw += inner[i++];
    }
    elements.push(parseValue(raw));
  }
  return elements;
}

function parseScalar(raw: string): string | number {
  return /^-?\d+$/.test(raw) ? Number(raw) : raw;
}

function serializeValue(value: ToonValue): string {
  if (Array.isArray(value)) {
    return '[' + value.map(serializeValue).join(' ') + ']';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return '"' + value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    + '"';
}
