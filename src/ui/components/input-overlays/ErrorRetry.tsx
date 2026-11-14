import React from 'react';
import { Box, Text } from 'ink';
import { MUTED } from '../../theme.js';

interface ErrorRetryProps {
  error: string;
  onRetry: () => void;
  onCancel: () => void;
}

export default function ErrorRetry({ error, onRetry, onCancel }: ErrorRetryProps) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="red" paddingX={1} paddingY={1}>
      <Box marginBottom={1}>
        <Text color="red" bold>
          ❌ An error occurred:
        </Text>
      </Box>
      
      <Box marginBottom={2} flexWrap="wrap">
        <Text color="red">
          {error}
        </Text>
      </Box>
      
      <Box justifyContent="space-between">
        <Box>
          <Text color="green" bold>
            [R]etry
          </Text>
          <Text color={MUTED}> - Try the request again</Text>
        </Box>
        <Box>
          <Text color="red" bold>
            [C]ancel
          </Text>
          <Text color={MUTED}> - Stop and return to input</Text>
        </Box>
      </Box>
      
      <Box marginTop={1}>
        <Text color={MUTED}>
          Press R to retry or C to cancel
        </Text>
      </Box>
    </Box>
  );
}