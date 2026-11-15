// Pastes with at least this many lines are shown as a placeholder in the input box.
export const PASTE_COLLAPSE_LINES = 3;

const PLACEHOLDER = /\[Pasted text #(\d+) \+\d+ lines\]/g;
const PLACEHOLDER_AT_END = /\[Pasted text #\d+ \+\d+ lines\]$/;

export const lineCountOf = (text: string) => text.split('\n').length;

export const pastePlaceholder = (id: number, lineCount: number) => `[Pasted text #${id} +${lineCount} lines]`;

export const expandPastes = (text: string, pastes: Map<number, string>) =>
  text.replace(PLACEHOLDER, (placeholder, id) => pastes.get(Number(id)) ?? placeholder);

// Backspace right after a placeholder removes the whole placeholder, not its last character.
export const backspaceLength = (textBeforeCursor: string) =>
  textBeforeCursor.match(PLACEHOLDER_AT_END)?.[0].length ?? 1;
