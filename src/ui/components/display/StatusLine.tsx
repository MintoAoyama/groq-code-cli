import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { MUTED } from '../../theme.js';
import { estimateCost, getModelInfo } from '../../../utils/models.js';
import {
  formatCost,
  formatTokens,
  readGitStatus,
  type GitStatus,
  type RateLimit,
} from '../../../utils/status.js';

const GIT_REFRESH_MS = 5000;

interface StatusLineProps {
  model: string;
  autoApprove: boolean;
  isProcessing: boolean;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  contextTokens: number;
  rateLimit?: RateLimit;
}

const joinSegments = (segments: React.ReactNode[]) =>
  segments.flatMap((segment, i) => (i === 0 ? [segment] : [<Text key={`sep-${i}`} color={MUTED}> | </Text>, segment]));

function useGitStatus(isProcessing: boolean): GitStatus | undefined {
  const [status, setStatus] = useState<GitStatus>();
  useEffect(() => {
    let alive = true;
    const refresh = () => readGitStatus().then(next => alive && setStatus(next));
    refresh();
    const timer = setInterval(refresh, GIT_REFRESH_MS);
    timer.unref();
    return () => {
      alive = false;
      clearInterval(timer);
    };
    // Refresh as soon as a request ends: its tools may have edited files.
  }, [isProcessing]);
  return status;
}

export default function StatusLine({
  model,
  autoApprove,
  isProcessing,
  promptTokens,
  completionTokens,
  totalTokens,
  contextTokens,
  rateLimit,
}: StatusLineProps) {
  const git = useGitStatus(isProcessing);
  const contextWindow = getModelInfo(model)?.contextWindow;
  const cost = estimateCost(model, promptTokens, completionTokens);

  const firstLine: React.ReactNode[] = [<Text key="model">{model}</Text>];
  if (git) {
    firstLine.push(
      <Text key="git">
        Git: <Text color="magenta">{git.branch}</Text>
        {(git.insertions > 0 || git.deletions > 0) && (
          <Text color="yellow"> (+{git.insertions},-{git.deletions})</Text>
        )}
      </Text>,
    );
  }
  if (autoApprove) firstLine.push(<Text key="approve" color="cyan" bold>auto-approve edits</Text>);

  const secondLine: React.ReactNode[] = [
    <Text key="ctx" color={MUTED}>
      Ctx: {formatTokens(contextTokens)}
      {contextWindow ? ` (${((contextTokens / contextWindow) * 100).toFixed(1)}%)` : ''}
    </Text>,
  ];
  if (cost !== undefined) secondLine.push(<Text key="cost">{formatCost(cost)}</Text>);
  secondLine.push(
    <Text key="tokens">
      Tokens: {formatTokens(totalTokens)} ( {formatTokens(promptTokens)} / {formatTokens(completionTokens)} )
    </Text>,
  );
  if (rateLimit?.remainingTokens !== undefined) {
    const limit = rateLimit.limitTokens !== undefined ? `/${formatTokens(rateLimit.limitTokens)}` : '';
    secondLine.push(<Text key="tpm" color={MUTED}>TPM left: {formatTokens(rateLimit.remainingTokens)}{limit}</Text>);
  }
  if (rateLimit?.remainingRequests !== undefined) {
    const limit = rateLimit.limitRequests !== undefined ? `/${rateLimit.limitRequests}` : '';
    secondLine.push(<Text key="rpd" color={MUTED}>RPD left: {rateLimit.remainingRequests}{limit}</Text>);
  }

  // One Text per line, so a narrow terminal wraps the line as text instead of
  // shrinking every segment into its own column.
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text>{joinSegments(firstLine)}</Text>
      <Text>{joinSegments(secondLine)}</Text>
    </Box>
  );
}
