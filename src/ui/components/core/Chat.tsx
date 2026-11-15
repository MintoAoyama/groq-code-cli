import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { MUTED } from '../../theme.js';
import { Agent } from '../../../core/agent.js';
import { useAgent } from '../../hooks/useAgent.js';
import { useTokenMetrics } from '../../hooks/useTokenMetrics.js';
import { useSessionStats } from '../../hooks/useSessionStats.js';
import MessageHistory from './MessageHistory.js';
import MessageInput from './MessageInput.js';
import TokenMetrics from '../display/TokenMetrics.js';
import PendingToolApproval from '../input-overlays/PendingToolApproval.js';
import Login from '../input-overlays/Login.js';
import ModelSelector from '../input-overlays/ModelSelector.js';
import MaxIterationsContinue from '../input-overlays/MaxIterationsContinue.js';
import ErrorRetry from '../input-overlays/ErrorRetry.js';
import CopyPicker, { type CopyChoice } from '../input-overlays/CopyPicker.js';
import StatusLine from '../display/StatusLine.js';
import { handleSlashCommand } from '../../../commands/index.js';
import { codeBlocksOf, repliesOf } from '../../../utils/replies.js';
import { copyToClipboard } from '../../../utils/clipboard.js';

interface ChatProps {
  agent: Agent;
  initialPrompt?: string;
}

export default function Chat({ agent, initialPrompt }: ChatProps) {
  const {
    completionTokens,
    startTime,
    endTime,
    pausedTime,
    isPaused,
    isActive,
    startRequest,
    addApiTokens,
    pauseMetrics,
    resumeMetrics,
    completeRequest,
    resetMetrics,
  } = useTokenMetrics();

  const {
    sessionStats,
    addSessionTokens,
    clearSessionStats,
  } = useSessionStats();

  // Wrapper function to add tokens to both per-request and session totals
  const handleApiTokens = (usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }) => {
    addApiTokens(usage);      // Add to current request metrics
    addSessionTokens(usage);  // Add to cumulative session stats
  };

  const agentHook = useAgent(
    agent, 
    startRequest,      // Start tracking on new request
    handleApiTokens,   // Add API usage tokens to both request and session totals
    pauseMetrics,      // Pause during approval
    resumeMetrics,     // Resume after approval
    completeRequest    // Complete when agent is done
  );

  const {
    messages,
    userMessageHistory,
    isProcessing,
    currentToolExecution,
    pendingApproval,
    pendingMaxIterations,
    pendingError,
    sessionAutoApprove,
    showReasoning,
    sendMessage,
    approveToolExecution,
    respondToMaxIterations,
    respondToError,
    addMessage,
    setApiKey,
    clearHistory,
    toggleAutoApprove,
    toggleReasoning,
    interruptRequest,
  } = agentHook;

  const { exit } = useApp();
  const [inputValue, setInputValue] = useState('');
  const [showInput, setShowInput] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  // Mirrors the agent's value so the status line re-renders when it changes.
  const [reasoningEffort, setReasoningEffortState] = useState(agent.getReasoningEffort());
  // null hides the picker; replies with no initialReply lists them for /copy-pick.
  const [copyPicker, setCopyPicker] = useState<{ replies: string[]; initialReply?: number } | null>(null);

  // Handle global keyboard shortcuts
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }
    if (key.shift && key.tab) {
      toggleAutoApprove();
    }
    if (key.escape) {
      // If waiting for error retry decision, cancel retry
      if (pendingError) {
        handleErrorCancel();
      }
      // If waiting for tool approval, reject the tool
      else if (pendingApproval) {
        handleApproval(false);
      }
      // If model is actively processing (but not waiting for approval or executing tools after approval)
      else if (isProcessing && !currentToolExecution) {
        interruptRequest();
      }
      // If user is typing and nothing else is happening, clear the input
      else if (showInput && inputValue.trim()) {
        setInputValue('');
      }
    }
    
    // Handle error retry keys
    if (pendingError) {
      if (input.toLowerCase() === 'r') {
        handleErrorRetry();
      } else if (input.toLowerCase() === 'c') {
        handleErrorCancel();
      }
    }
  });

  // Hide input when processing, waiting for approval, error retry, or showing login/model selector
  useEffect(() => {
    setShowInput(!isProcessing && !pendingApproval && !pendingError && !showLogin && !showModelSelector && !copyPicker);
  }, [isProcessing, pendingApproval, pendingError, showLogin, showModelSelector, copyPicker]);

  const refreshModels = async () => {
    const replaced = await agent.refreshModels();
    if (replaced) {
      setReasoningEffortState(agent.getReasoningEffort());
      addMessage({
        role: 'system',
        content: `${replaced} is no longer available on Groq. Switched to ${agent.getCurrentModel()}.`,
      });
    }
  };

  useEffect(() => {
    // Wait for the model list so a saved model Groq has removed is replaced before the first request.
    refreshModels().then(() => {
      if (initialPrompt) handleSendMessage(initialPrompt);
    });
  }, []);

  const copyChoice = async ({ text, label }: CopyChoice) => {
    setCopyPicker(null);
    const result = await copyToClipboard(text);
    addMessage({
      role: 'system',
      content: result.ok
        ? `Copied ${label} (${text.length} chars) via ${result.method}.`
        : `Copy failed: ${result.reason}.`,
    });
  };

  const copyReply = (index: number) => {
    const replies = repliesOf(messages);
    if (index > replies.length) {
      addMessage({
        role: 'system',
        content: replies.length === 0 ? 'No replies to copy yet.' : `Only ${replies.length} replies to copy.`,
      });
      return;
    }
    const text = replies[index - 1];
    if (codeBlocksOf(text).length === 0) {
      copyChoice({ text, label: `reply ${index}` });
    } else {
      setCopyPicker({ replies, initialReply: index - 1 });
    }
  };

  const openCopyPicker = () => {
    const replies = repliesOf(messages);
    if (replies.length === 0) {
      addMessage({ role: 'system', content: 'No replies to copy yet.' });
      return;
    }
    setCopyPicker({ replies });
  };


  const handleSendMessage = async (message: string) => {
    if (message.trim() && !isProcessing) {
      setInputValue('');

      if (message.trim().toLowerCase() === 'exit') {
        exit();
        return;
      }
      
      // Handle slash commands
      if (message.startsWith('/')) {
        handleSlashCommand(message, {
          addMessage,
          clearHistory: () => {
            clearHistory();
            clearSessionStats();
          },
          setShowLogin,
          setShowModelSelector,
          toggleReasoning,
          showReasoning,
          sessionStats,
          exit,
          model: agent.getCurrentModel(),
          reasoningEffort,
          setReasoningEffort: (effort: string | null) => {
            agent.setReasoningEffort(effort);
            setReasoningEffortState(effort);
          },
          copyReply,
          openCopyPicker,
        });
        return;
      }
      
      // The agent will handle starting request tracking
      await sendMessage(message);
    }
  };

  const handleApproval = (approved: boolean, autoApproveSession?: boolean) => {
    approveToolExecution(approved, autoApproveSession);
  };

  const handleErrorRetry = () => {
    respondToError(true);
  };

  const handleErrorCancel = () => {
    respondToError(false);
  };

  const handleLogin = (apiKey: string) => {
    setShowLogin(false);
    // Save the API key persistently
    agent.saveApiKey(apiKey);
    addMessage({
      role: 'system',
      content: 'API key saved successfully. You can now start chatting with the assistant.',
    });
    refreshModels();
  };

  const handleLoginCancel = () => {
    setShowLogin(false);
    addMessage({
      role: 'system',
      content: 'Login canceled.',
    });
  };

  const handleModelSelect = (model: string) => {
    setShowModelSelector(false);
    // Clear chat history and session stats when switching models
    clearHistory();
    clearSessionStats();
    // Set the new model on the agent
    agent.setModel(model);
    setReasoningEffortState(agent.getReasoningEffort());
    addMessage({
      role: 'system',
      content: `Switched to model: ${model}. Chat history has been cleared.`,
    });
  };

  const handleModelCancel = () => {
    setShowModelSelector(false);
    addMessage({
      role: 'system',
      content: 'Model selection canceled.',
    });
  };

  return (
    <Box flexDirection="column" height="100%">
      {/* Chat messages area */}
      <Box flexGrow={1} flexDirection="column" paddingX={1}>
        <MessageHistory 
          messages={messages} 
          showReasoning={showReasoning} 
          usageData={{
            prompt_tokens: sessionStats.promptTokens,
            completion_tokens: sessionStats.completionTokens,
            total_tokens: sessionStats.totalTokens,
            total_requests: sessionStats.totalRequests,
            total_time: sessionStats.totalTime,
            queue_time: 0,
            prompt_time: 0,
            completion_time: 0,
          }}
        />
      </Box>

      {/* Token metrics */}
      <TokenMetrics
        isActive={isActive}
        isPaused={isPaused}
        startTime={startTime}
        endTime={endTime}
        pausedTime={pausedTime}
        completionTokens={completionTokens}
      />

      {/* Input area */}
      <Box borderStyle="round" borderColor="white" paddingX={1}>
        {pendingApproval ? (
          <PendingToolApproval
            toolName={pendingApproval.toolName}
            toolArgs={pendingApproval.toolArgs}
            onApprove={() => handleApproval(true, false)}
            onReject={() => handleApproval(false, false)}
            onApproveWithAutoSession={() => handleApproval(true, true)}
          />
        ) : pendingMaxIterations ? (
          <MaxIterationsContinue
            maxIterations={pendingMaxIterations.maxIterations}
            onContinue={() => respondToMaxIterations(true)}
            onStop={() => respondToMaxIterations(false)}
          />
        ) : pendingError ? (
          <ErrorRetry
            error={pendingError.error}
            onRetry={handleErrorRetry}
            onCancel={handleErrorCancel}
          />
        ) : showLogin ? (
          <Login
            onSubmit={handleLogin}
            onCancel={handleLoginCancel}
          />
        ) : showModelSelector ? (
          <ModelSelector
            onSubmit={handleModelSelect}
            onCancel={handleModelCancel}
            currentModel={agent.getCurrentModel?.() || undefined}
          />
        ) : copyPicker ? (
          <CopyPicker
            replies={copyPicker.replies}
            initialReply={copyPicker.initialReply}
            onCopy={copyChoice}
            onCancel={() => setCopyPicker(null)}
          />
        ) : showInput ? (
          <MessageInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSendMessage}
            placeholder="... (Esc to clear, /exit or Ctrl+C to exit)"
            userMessageHistory={userMessageHistory}
          />
        ) : (
          <Box>
            <Text color={MUTED}>Processing...</Text>
          </Box>
        )}
      </Box>

      <StatusLine
        model={agent.getCurrentModel()}
        reasoningEffort={reasoningEffort}
        autoApprove={sessionAutoApprove}
        isProcessing={isProcessing}
        promptTokens={sessionStats.promptTokens}
        completionTokens={sessionStats.completionTokens}
        totalTokens={sessionStats.totalTokens}
        contextTokens={sessionStats.contextTokens}
        rateLimit={agent.getRateLimit()}
      />
    </Box>
  );
}