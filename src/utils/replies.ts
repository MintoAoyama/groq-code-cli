export interface ReplySource {
  role: string;
  content: string;
}

export interface CodeBlock {
  language: string;
  source: string;
}

// One entry per prompt the user typed: every text the assistant wrote until the
// next prompt, so the list counts turns, not the notes between tool calls.
export function repliesOf(messages: readonly ReplySource[]): string[] {
  const replies: string[] = [];
  let parts: string[] = [];
  const flush = () => {
    if (parts.length > 0) replies.push(parts.join('\n\n'));
    parts = [];
  };
  for (const message of messages) {
    if (message.role === 'user') {
      flush();
    } else if (message.role === 'assistant' && message.content.trim() !== '') {
      parts.push(message.content.trim());
    }
  }
  flush();
  return replies.reverse();
}

export function codeBlocksOf(text: string): CodeBlock[] {
  return [...text.matchAll(/^```([^\n]*)\n([\s\S]*?)^```/gm)].map(match => ({
    language: (match[1] ?? '').trim(),
    source: (match[2] ?? '').replace(/\n$/, ''),
  }));
}

export function linesOf(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '');
}

// Returns the 1-based position among the newest replies, or an error for anything else.
export function parseReplyIndex(args: string): { index: number } | { error: string } {
  const trimmed = args.trim();
  if (trimmed === '') return { index: 1 };
  if (!/^\d+$/.test(trimmed) || Number(trimmed) < 1) {
    return { error: `Expected a positive number, got "${trimmed}".` };
  }
  return { index: Number(trimmed) };
}

const isWide = (code: number) =>
  (code >= 0x1100 && code <= 0x115f) ||
  (code >= 0x2e80 && code <= 0xa4cf) ||
  (code >= 0xac00 && code <= 0xd7a3) ||
  (code >= 0xf900 && code <= 0xfaff) ||
  (code >= 0xfe30 && code <= 0xfe4f) ||
  (code >= 0xff00 && code <= 0xff60) ||
  (code >= 0xffe0 && code <= 0xffe6) ||
  (code >= 0x1f300 && code <= 0x1faff) ||
  (code >= 0x20000 && code <= 0x3fffd);

export function cellWidth(text: string): number {
  let used = 0;
  for (const char of text) used += isWide(char.codePointAt(0) ?? 0) ? 2 : 1;
  return used;
}

// Cuts to terminal cells, not characters: a full-width character takes two.
export function fit(text: string, cells: number): string {
  if (cellWidth(text) <= cells) return text;
  let used = 0;
  let out = '';
  for (const char of text) {
    const width = isWide(char.codePointAt(0) ?? 0) ? 2 : 1;
    if (used + width > cells - 1) break;
    used += width;
    out += char;
  }
  return out + '…';
}
