import { useState, useEffect } from 'react';
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

export default function MessageInput({ 
  value, 
  onChange, 
  onSubmit, 
  placeholder = "... (Esc to clear, /exit or Ctrl+C to exit)",
  userMessageHistory = []
}: MessageInputProps) {
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [draftMessage, setDraftMessage] = useState('');
  const [cursorPosition, setCursorPosition] = useState(value.length);
  const [pastes, setPastes] = useState<Map<number, string>>(new Map());

  const isSlashCommand = value.startsWith('/');
  const showSlashCommands = isSlashCommand;

  // Keep cursor position in bounds and reset to end when value is cleared
  useEffect(() => {
    if (value.length === 0) {
      setCursorPosition(0);
      // Clear draft and reset history when input is cleared (after sending message)
      setDraftMessage('');
      setHistoryIndex(-1);
      setPastes(new Map());
    } else if (cursorPosition > value.length) {
      setCursorPosition(value.length);
    }
  }, [value]);

  const insertText = (text: string) => {
    const newValue = value.slice(0, cursorPosition) + text + value.slice(cursorPosition);
    onChange(newValue);
    setCursorPosition(prev => prev + text.length);
    setSelectedCommandIndex(0);
    setHistoryIndex(-1);
  };

  const insertPaste = (text: string) => {
    const lineCount = lineCountOf(text);
    if (lineCount < PASTE_COLLAPSE_LINES) {
      insertText(text);
      return;
    }
    const id = pastes.size + 1;
    setPastes(prev => new Map(prev).set(id, text));
    insertText(pastePlaceholder(id, lineCount));
  };

  const submit = (text: string) => {
    onSubmit(expandPastes(text, pastes));
  };

  usePaste(text => insertPaste(text.replace(/\r\n?/g, '\n')));

  const lineStart = value.lastIndexOf('\n', cursorPosition - 1) + 1;
  const nextNewline = value.indexOf('\n', cursorPosition);
  const isFirstLine = lineStart === 0;
  const isLastLine = nextNewline === -1;

  useInput((input, key) => {
    // Shift+Enter is only distinguishable from Enter under the kitty keyboard protocol;
    // Option+Enter, Ctrl+J and a trailing backslash cover terminals without it.
    if ((key.return && (key.shift || key.meta)) || (key.ctrl && input === 'j') || input === '\n') {
      insertText('\n');
      return;
    }

    if (key.return) {
      if (value[cursorPosition - 1] === '\\') {
        onChange(value.slice(0, cursorPosition - 1) + '\n' + value.slice(cursorPosition));
        return;
      }
      if (isSlashCommand) {
        // Auto-complete to selected command
        const searchTerm = value.slice(1).toLowerCase();
        const commands = getCommandNames();
        const filteredCommands = commands.filter(cmd => 
          cmd.toLowerCase().includes(searchTerm)
        );
        if (filteredCommands.length > 0) {
          onSubmit('/' + (filteredCommands[selectedCommandIndex] || filteredCommands[0]));
          return;
        }
      }
      submit(value);
      return;
    }

    if (key.upArrow) {
      if (showSlashCommands) {
        setSelectedCommandIndex(prev => Math.max(0, prev - 1));
      } else if (!isFirstLine) {
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
          setHistoryIndex(newIndex);
          const historicalMessage = userMessageHistory[userMessageHistory.length - 1 - newIndex];
          onChange(historicalMessage);
          setCursorPosition(historicalMessage.length);
        }
      } else {
        setCursorPosition(0);
      }
      return;
    }

    if (key.downArrow) {
      if (showSlashCommands) {
        const searchTerm = value.slice(1).toLowerCase();
        const commands = getCommandNames();
        const filteredCommands = commands.filter(cmd => 
          cmd.toLowerCase().includes(searchTerm)
        );
        setSelectedCommandIndex(prev => Math.min(filteredCommands.length - 1, prev + 1));
      } else if (!isLastLine) {
        const followingNewline = value.indexOf('\n', nextNewline + 1);
        const nextLineEnd = followingNewline === -1 ? value.length : followingNewline;
        const column = cursorPosition - lineStart;
        setCursorPosition(Math.min(nextNewline + 1 + column, nextLineEnd));
      } else if (cursorPosition === value.length && historyIndex >= 0) {
        // Navigate through message history when at last position
        const newIndex = historyIndex - 1;
        if (newIndex >= 0) {
          setHistoryIndex(newIndex);
          const historicalMessage = userMessageHistory[userMessageHistory.length - 1 - newIndex];
          onChange(historicalMessage);
          setCursorPosition(historicalMessage.length);
        } else {
          // Return to draft message (current input)
          setHistoryIndex(-1);
          onChange(draftMessage);
          setCursorPosition(draftMessage.length);
        }
      } else {
        setCursorPosition(value.length);
      }
      return;
    }

    if (key.leftArrow) {
      setCursorPosition(prev => Math.max(0, prev - 1));
      return;
    }

    if (key.rightArrow) {
      setCursorPosition(prev => Math.min(value.length, prev + 1));
      return;
    }

    if (key.delete) {
      if (cursorPosition < value.length) {
        onChange(value.slice(0, cursorPosition) + value.slice(cursorPosition + 1));
      }
      setSelectedCommandIndex(0);
      setHistoryIndex(-1);
      return;
    }

    if (key.backspace) {
      if (cursorPosition > 0) {
        const length = backspaceLength(value.slice(0, cursorPosition));
        const newValue = value.slice(0, cursorPosition - length) + value.slice(cursorPosition);
        onChange(newValue);
        setCursorPosition(prev => prev - length);
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

  const displayValue = value || placeholder;
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