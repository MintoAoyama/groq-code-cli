import { useState, useEffect, useRef } from 'react';
import { Box, Text, useInput, usePaste } from 'ink';
import { MUTED } from '../../theme.js';
import { getCommandNames } from '../../../commands/index.js';
import SlashCommandSuggestions from '../input-overlays/SlashCommandSuggestions.js';
import { PASTE_COLLAPSE_LINES, backspaceLength, expandPastes, lineCountOf, pastePlaceholder } from '../../../utils/paste.js';

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  userMessageHistory?: string[];
}

// Keys that arrive in one stdin chunk are handled before React re-renders, so handlers
// read the latest state from the ref instead of the values captured at render time.
function useLatestState<T>(initial: T) {
  const [state, setState] = useState(initial);
  const ref = useRef(state);
  const set = (next: T) => {
    ref.current = next;
    setState(next);
  };
  return [state, ref, set] as const;
}

const filterCommands = (value: string) => {
  const searchTerm = value.slice(1).toLowerCase();
  return getCommandNames().filter(cmd => cmd.toLowerCase().includes(searchTerm));
};

export default function MessageInput({
  value,
  onChange,
  onSubmit,
  placeholder = "... (Esc to clear, /exit or Ctrl+C to exit)",
  userMessageHistory = []
}: MessageInputProps) {
  const [selectedCommandIndex, selectedCommandIndexRef, setSelectedCommandIndex] = useLatestState(0);
  const [, historyIndexRef, setHistoryIndex] = useLatestState(-1);
  const [, draftMessageRef, setDraftMessage] = useLatestState('');
  const [cursorPosition, cursorRef, setCursorPosition] = useLatestState(value.length);
  const pastesRef = useRef(new Map<number, string>());

  // The parent also changes the value (clearing it on Esc or after sending), so follow the prop.
  const valueRef = useRef(value);
  valueRef.current = value;
  const setValue = (next: string) => {
    valueRef.current = next;
    onChange(next);
  };

  const showSlashCommands = value.startsWith('/');

  // Keep cursor position in bounds and reset to end when value is cleared
  useEffect(() => {
    if (value.length === 0) {
      setCursorPosition(0);
      // Clear draft and reset history when input is cleared (after sending message)
      setDraftMessage('');
      setHistoryIndex(-1);
      pastesRef.current = new Map();
    } else if (cursorRef.current > value.length) {
      setCursorPosition(value.length);
    }
  }, [value]);

  const insertText = (text: string) => {
    const current = valueRef.current;
    const cursor = cursorRef.current;
    setValue(current.slice(0, cursor) + text + current.slice(cursor));
    setCursorPosition(cursor + text.length);
    setSelectedCommandIndex(0);
    setHistoryIndex(-1);
  };

  const insertPaste = (text: string) => {
    const lineCount = lineCountOf(text);
    if (lineCount < PASTE_COLLAPSE_LINES) {
      insertText(text);
      return;
    }
    const id = pastesRef.current.size + 1;
    pastesRef.current = new Map(pastesRef.current).set(id, text);
    insertText(pastePlaceholder(id, lineCount));
  };

  const showHistory = (index: number) => {
    setHistoryIndex(index);
    const message = index === -1 ? draftMessageRef.current : userMessageHistory[userMessageHistory.length - 1 - index];
    setValue(message);
    setCursorPosition(message.length);
  };

  usePaste(text => insertPaste(text.replace(/\r\n?/g, '\n')));

  useInput((input, key) => {
    const value = valueRef.current;
    const cursorPosition = cursorRef.current;
    const historyIndex = historyIndexRef.current;
    const isSlashCommand = value.startsWith('/');
    const lineStart = value.lastIndexOf('\n', cursorPosition - 1) + 1;
    const nextNewline = value.indexOf('\n', cursorPosition);

    // Shift+Enter is only distinguishable from Enter under the kitty keyboard protocol;
    // Option+Enter, Ctrl+J and a trailing backslash cover terminals without it.
    if ((key.return && (key.shift || key.meta)) || (key.ctrl && input === 'j') || input === '\n') {
      insertText('\n');
      return;
    }

    if (key.return) {
      if (value[cursorPosition - 1] === '\\') {
        setValue(value.slice(0, cursorPosition - 1) + '\n' + value.slice(cursorPosition));
        return;
      }
      if (isSlashCommand) {
        // Auto-complete to selected command
        const filteredCommands = filterCommands(value);
        if (filteredCommands.length > 0) {
          onSubmit('/' + (filteredCommands[selectedCommandIndexRef.current] || filteredCommands[0]));
          return;
        }
      }
      onSubmit(expandPastes(value, pastesRef.current));
      return;
    }

    if (key.upArrow) {
      if (isSlashCommand) {
        setSelectedCommandIndex(Math.max(0, selectedCommandIndexRef.current - 1));
      } else if (lineStart > 0) {
        const prevLineStart = value.lastIndexOf('\n', lineStart - 2) + 1;
        const column = cursorPosition - lineStart;
        setCursorPosition(Math.min(prevLineStart + column, lineStart - 1));
      } else if (cursorPosition === 0 && userMessageHistory.length > 0) {
        // Store current input as draft when first navigating to history
        if (historyIndex === -1) {
          setDraftMessage(value);
        }
        // Navigate to message history when at 0th position
        const newIndex = Math.min(historyIndex + 1, userMessageHistory.length - 1);
        if (newIndex !== historyIndex) {
          showHistory(newIndex);
        }
      } else {
        setCursorPosition(0);
      }
      return;
    }

    if (key.downArrow) {
      if (isSlashCommand) {
        const filteredCommands = filterCommands(value);
        setSelectedCommandIndex(Math.min(filteredCommands.length - 1, selectedCommandIndexRef.current + 1));
      } else if (nextNewline !== -1) {
        const followingNewline = value.indexOf('\n', nextNewline + 1);
        const nextLineEnd = followingNewline === -1 ? value.length : followingNewline;
        const column = cursorPosition - lineStart;
        setCursorPosition(Math.min(nextNewline + 1 + column, nextLineEnd));
      } else if (cursorPosition === value.length && historyIndex >= 0) {
        // Navigate through message history when at last position; -1 returns to the draft
        showHistory(historyIndex - 1);
      } else {
        setCursorPosition(value.length);
      }
      return;
    }

    if (key.leftArrow) {
      setCursorPosition(Math.max(0, cursorPosition - 1));
      return;
    }

    if (key.rightArrow) {
      setCursorPosition(Math.min(value.length, cursorPosition + 1));
      return;
    }

    if (key.delete) {
      if (cursorPosition < value.length) {
        setValue(value.slice(0, cursorPosition) + value.slice(cursorPosition + 1));
      }
      setSelectedCommandIndex(0);
      setHistoryIndex(-1);
      return;
    }

    if (key.backspace) {
      if (cursorPosition > 0) {
        const length = backspaceLength(value.slice(0, cursorPosition));
        setValue(value.slice(0, cursorPosition - length) + value.slice(cursorPosition));
        setCursorPosition(cursorPosition - length);
      }
      setSelectedCommandIndex(0);
      setHistoryIndex(-1);
      return;
    }

    if (key.ctrl) {
      // Handle Ctrl+C in parent component
      return;
    }

    // Regular character input
    if (input && !key.meta && !key.ctrl) {
      insertPaste(input.replace(/\r\n?/g, '\n'));
    }
  });

  const isPlaceholder = !value;

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan" bold>{'>'} </Text>
        <Box flexGrow={1}>
          {isPlaceholder ? (
            <Text color={MUTED}>
              <Text backgroundColor="cyan" color="black"> </Text>
              {placeholder}
            </Text>
          ) : (
            <Text color={MUTED}>
              {value.slice(0, cursorPosition)}
              <Text backgroundColor="cyan" color="black">
                {cursorPosition < value.length && value[cursorPosition] !== '\n' ? value[cursorPosition] : ' '}
              </Text>
              {value[cursorPosition] === '\n' ? value.slice(cursorPosition) : value.slice(cursorPosition + 1)}
            </Text>
          )}
        </Box>
      </Box>
      {showSlashCommands && (
        <SlashCommandSuggestions
          input={value}
          selectedIndex={selectedCommandIndex}
          onSelect={(command: string) => onSubmit('/' + command)}
        />
      )}
    </Box>
  );
}
