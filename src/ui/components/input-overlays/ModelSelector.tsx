import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { MUTED } from '../../theme.js';
import { getSelectableModels } from '../../../utils/models.js';

interface ModelSelectorProps {
  onSubmit: (model: string) => void;
  onCancel: () => void;
  currentModel?: string;
}

export default function ModelSelector({ onSubmit, onCancel, currentModel }: ModelSelectorProps) {
  const [availableModels] = useState(() => getSelectableModels().map(model => ({
    ...model,
    description: model.preview
      ? 'Preview: Groq may remove it without notice'
      : model.known ? '' : 'Not in the built-in list: tool calling and pricing are unverified',
  })));
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const currentIndex = availableModels.findIndex(model => model.id === currentModel);
    return currentIndex >= 0 ? currentIndex : 0;
  });

  useInput((input, key) => {
    if (key.return) {
      onSubmit(availableModels[selectedIndex].id);
      return;
    }

    if (key.escape) {
      onCancel();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex(prev => Math.min(availableModels.length - 1, prev + 1));
      return;
    }

    if (key.ctrl && input === 'c') {
      onCancel();
      return;
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan" bold>Select Model</Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text color={MUTED}>
          Choose a model for your conversation. The chat will be cleared when you switch models.
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text color={MUTED}>
          Visit <Text underline>https://groq.com/pricing</Text> for more information.
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        {availableModels.map((model, index) => (
          <Box key={model.id} marginBottom={index === availableModels.length - 1 ? 0 : 1}>
            <Text 
              color={index === selectedIndex ? 'black' : 'white'}
              backgroundColor={index === selectedIndex ? 'cyan' : undefined}
              bold={index === selectedIndex}
            >
              {index === selectedIndex ? <Text bold>{">"}</Text> : "  "} {""}
              {model.name}
              {model.id === currentModel ? ' (current)' : ''}
            </Text>
            {index === selectedIndex && (
              <Box marginLeft={4} marginTop={0}>
                <Text color={MUTED}>
                  {model.description}
                </Text>
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}