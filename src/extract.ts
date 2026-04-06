/**
 * Bubble extractor — Phase 2 heuristic.
 *
 * First-pass guess: buddy speech bubbles are box-drawing regions using
 * ╭─╮ / │ / ╰─╯ characters. Finds the last (most recent) such region
 * in a captured pane and returns the interior text.
 *
 * This is empirical — iterate against real /buddy output until reliable.
 */

export interface BubbleMatch {
  text: string;
  rawLines: string[]; // original lines from pane, for debugging
}

/**
 * Extract the most recent bubble from a `tmux capture-pane -p` snapshot.
 * Returns null if no bubble region is found.
 */
export function extractBubble(pane: string): BubbleMatch | null {
  const lines = pane.split('\n');

  // Scan from bottom up — the most recent bubble is nearest the input box.
  let topIdx = -1;
  let col = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    const j = lines[i].indexOf('╭');
    if (j !== -1 && (lines[i][j + 1] === '─' || lines[i][j + 1] === '╮')) {
      topIdx = i;
      col = j;
      break;
    }
  }
  if (topIdx === -1) return null;

  // Find the matching bottom border (╰) at the same column.
  let botIdx = -1;
  for (let i = topIdx + 1; i < lines.length; i++) {
    if (lines[i][col] === '╰') {
      botIdx = i;
      break;
    }
  }
  if (botIdx === -1) return null;

  // Determine the right border column from the top border's ╮ position.
  const rightCol = lines[topIdx].indexOf('╮', col + 1);
  if (rightCol === -1) return null;

  // Extract interior: slice strictly between left │ and right │ to exclude
  // anything drawn after the bubble (e.g. Jetsam's ASCII art).
  const interior: string[] = [];
  for (let i = topIdx + 1; i < botIdx; i++) {
    const line = lines[i];
    if (line[col] === '│') {
      interior.push(line.slice(col + 1, rightCol).trim());
    }
  }

  const text = interior.join('\n').trim();
  if (!text) return null;

  return { text, rawLines: lines.slice(topIdx, botIdx + 1) };
}
