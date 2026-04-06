/**
 * bb-say — speak directly to your buddy.
 *
 * Reads companion.personality from ~/.claude.json, builds a system prompt
 * optionally enriched with recent journal entries, calls the Claude API,
 * prints the reply, and records the exchange as an `ex` record.
 *
 * Usage:
 *   node --experimental-strip-types src/bb-say.ts [flags] [message...]
 *
 * Flags:
 *   --context N     use last N journal entries as context (default: 5)
 *   --no-context    disable context injection entirely
 *   --pin <ts...>   use specific entry IDs (ts values) instead of recent-N
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { append, type ToonRecord } from './toon.ts';
import { readJournal, JOURNAL_PATH } from './journal.ts';

const MODEL   = 'claude-haiku-4-5-20251001';
const CLAUDE_JSON = join(homedir(), '.claude.json');

// --- argument parsing ---

export interface ParsedArgs {
  message: string;
  contextN: number | false; // false = --no-context
  pinIds: number[];
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  let contextN: number | false = 5;
  const pinIds: number[] = [];
  const messageParts: string[] = [];

  let i = 0;
  while (i < args.length) {
    const a = args[i];
    if (a === '--no-context') {
      contextN = false;
      i++;
    } else if (a === '--context' && i + 1 < args.length) {
      contextN = Math.max(0, parseInt(args[++i], 10));
      i++;
    } else if (a === '--pin') {
      i++;
      while (i < args.length && /^\d+$/.test(args[i])) {
        pinIds.push(parseInt(args[i++], 10));
      }
    } else {
      messageParts.push(a);
      i++;
    }
  }

  return { message: messageParts.join(' ').trim(), contextN, pinIds };
}

// --- personality ---

export function readPersonality(): string {
  let raw: string;
  try {
    raw = readFileSync(CLAUDE_JSON, 'utf8');
  } catch {
    throw new Error(`Could not read ~/.claude.json`);
  }
  const data = JSON.parse(raw);
  const p = data?.companion?.personality;
  if (typeof p !== 'string' || !p.trim()) {
    throw new Error('companion.personality not found in ~/.claude.json');
  }
  return p;
}

// --- context selection ---

export function selectContext(
  records: ToonRecord[],
  { contextN, pinIds }: Pick<ParsedArgs, 'contextN' | 'pinIds'>,
): ToonRecord[] {
  if (contextN === false) return [];
  if (pinIds.length > 0) {
    const set = new Set(pinIds);
    return records.filter(r => typeof r.ts === 'number' && set.has(r.ts as number));
  }
  return records.slice(-contextN);
}

// --- system prompt ---

export function buildSystemPrompt(personality: string, context: ToonRecord[]): string {
  if (context.length === 0) return personality;

  const lines = context.map(r => {
    const d = new Date(r.ts as number);
    const when = d.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    if (r.type === 'obs') {
      return `[${when}] You said: "${r.text as string}"`;
    }
    if (r.type === 'ex') {
      return `[${when}] User: "${r.prompt as string}" / You replied: "${r.reply as string}"`;
    }
    return `[${when}] ${JSON.stringify(r)}`;
  });

  return `${personality}\n\nHere is what you said recently:\n${lines.join('\n')}`;
}

// --- main ---

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (!args.message) {
    console.error('Usage: /bb-say [--context N] [--no-context] [--pin <ids>] <message>');
    process.exit(1);
  }

  const personality = readPersonality();
  const records     = readJournal();
  const context     = selectContext(records, args);
  const systemPrompt = buildSystemPrompt(personality, context);

  const client   = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: args.message }],
  });

  const reply = response.content[0].type === 'text' ? response.content[0].text : '';
  console.log(reply);

  const ctxIds = context.map(r => r.ts as number);
  const record: ToonRecord = {
    type: 'ex',
    v: 1,
    ts: Date.now(),
    prompt: args.message,
    reply,
    ...(ctxIds.length > 0 ? { ctx: ctxIds } : {}),
  };
  await append(JOURNAL_PATH, record);
}

// Only run when executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}
