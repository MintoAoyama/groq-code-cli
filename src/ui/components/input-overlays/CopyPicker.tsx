import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { MUTED } from '../../theme.js';
import { codeBlocksOf, fit, linesOf } from '../../../utils/replies.js';

// Rows of the list on screen at once; the window follows the selection.
const VISIBLE_ITEMS = 6;

export interface CopyChoice {
  text: string;
  label: string;
}

interface CopyPickerProps {
  replies: string[];
  // Index into replies whose parts are listed; undefined lists the replies.
  initialReply?: number;
  onCopy: (choice: CopyChoice) => void;
  onCancel: () => void;
}

interface Item {
  title: string;
  preview: string[];
  choose: () => void;
}

export default function CopyPicker({ replies, initialReply, onCopy, onCancel }: CopyPickerProps) {
  const [reply, setReply] = useState<number | undefined>(initialReply);
  const [selected, setSelected] = useState(0);
  const cells = Math.max(20, (process.stdout.columns || 80) - 10);

  const items: Item[] =
    reply === undefined
      ? replies.map((text, i) => {
          const [head = '', second] = linesOf(text).filter(line => !line.startsWith('```'));
          return {
            title: `${String(i + 1).padStart(2)}  ${head}`,
            preview: second === undefined ? [] : [second],
            choose: () => {
              if (codeBlocksOf(text).length === 0) {
                onCopy({ text, label: `reply ${i + 1}` });
              } else {
                setReply(i);
                setSelected(0);
              }
            },
          };
        })
      : [
          {
            title: 'Whole reply',
            preview: [],
            choose: () => onCopy({ text: replies[reply], label: `reply ${reply + 1}` }),
          },
          ...codeBlocksOf(replies[reply]).map((block, i) => ({
            title: `Code block ${i + 1}${block.language ? ` (${block.language})` : ''}`,
            preview: linesOf(block.source).slice(0, 2),
            choose: () => onCopy({ text: block.source, label: `code block ${i + 1} of reply ${reply + 1}` }),
          })),
        ];

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      onCancel();
      return;
    }
    if (key.return) {
      items[selected]?.choose();
      return;
    }
    // Shift+Tab is left alone: Chat binds it to the auto-approve toggle.
    if (key.upArrow) {
      setSelected(prev => (prev - 1 + items.length) % items.length);
      return;
    }
    if (key.downArrow || (key.tab && !key.shift)) {
      setSelected(prev => (prev + 1) % items.length);
    }
  });

  const start = Math.min(
    Math.max(0, selected - Math.floor(VISIBLE_ITEMS / 2)),
    Math.max(0, items.length - VISIBLE_ITEMS),
  );
  const visible = items.slice(start, start + VISIBLE_ITEMS);

  return (
    <Box flexDirection="column">
      <Text color="cyan" bold>
        {reply === undefined ? 'Copy a reply (newest first)' : `Copy from reply ${reply + 1}`}
      </Text>
      <Text color={MUTED}>↑/↓ to move, Enter to copy, Esc to close</Text>
      <Box flexDirection="column" marginTop={1}>
        {start > 0 && <Text color={MUTED}>  ↑ {start} more</Text>}
        {visible.map((item, i) => {
          const isSelected = start + i === selected;
          return (
            <Box key={start + i} flexDirection="column">
              <Text
                color={isSelected ? 'black' : undefined}
                backgroundColor={isSelected ? 'cyan' : undefined}
              >
                {isSelected ? '> ' : '  '}
                {fit(item.title, cells)}
              </Text>
              {item.preview.map((line, j) => (
                <Text key={j} color={MUTED}>      {fit(line, cells - 4)}</Text>
              ))}
            </Box>
          );
        })}
        {start + VISIBLE_ITEMS < items.length && (
          <Text color={MUTED}>  ↓ {items.length - start - VISIBLE_ITEMS} more</Text>
        )}
      </Box>
    </Box>
  );
}
