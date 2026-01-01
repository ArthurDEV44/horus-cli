import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { HorusAgent, ChatEntry } from '../../agent/horus-agent.js';
import { useInputHandler } from '../../hooks/use-input-handler.js';
import { CommandSuggestions } from './command-suggestions.js';
import { ModelSelection } from './model-selection.js';
import ConfirmationDialog from './confirmation-dialog.js';
import {
  ConfirmationService,
  ConfirmationOptions,
} from '../../utils/confirmation-service.js';
import ApiKeyInput from './api-key-input.js';
import cfonts from 'cfonts';

// Modern components
import { ModernHeader } from './modern-header.js';
import { ModernStatusBar } from './modern-status-bar.js';
import { ModernLoadingSpinner } from './modern-loading-spinner.js';
import { ModernChatHistory } from './modern-chat-history.js';
import { ModernChatInput } from './modern-chat-input.js';
import { DesignSystem as DS } from '../theme/design-system.js';
import { getMCPManager } from '../../horus/tools.js';

interface ModernChatInterfaceProps {
  agent?: HorusAgent;
  initialMessage?: string;
}

// Main chat component with modern UI
function ModernChatInterfaceWithAgent({
  agent,
  initialMessage,
}: {
  agent: HorusAgent;
  initialMessage?: string;
}) {
  const [chatHistory, setChatHistory] = useState<ChatEntry[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTime, setProcessingTime] = useState(0);
  const [tokenCount, setTokenCount] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [confirmationOptions, setConfirmationOptions] =
    useState<ConfirmationOptions | null>(null);
  const scrollRef = useRef<any>(null);
  const processingStartTime = useRef<number>(0);

  const confirmationService = ConfirmationService.getInstance();

  const {
    input,
    cursorPosition,
    showCommandSuggestions,
    selectedCommandIndex,
    showModelSelection,
    selectedModelIndex,
    commandSuggestions,
    availableModels,
    autoEditEnabled,
    operationMode,
  } = useInputHandler({
    agent,
    chatHistory,
    setChatHistory,
    setIsProcessing,
    setIsStreaming,
    setTokenCount,
    setProcessingTime,
    processingStartTime,
    isProcessing,
    isStreaming,
    isConfirmationActive: !!confirmationOptions,
  });

  // Get MCP servers count
  const mcpManager = getMCPManager();
  const mcpServersCount = mcpManager ? mcpManager.getTools().length : 0;

  useEffect(() => {
    // Clear console
    const isWindows = process.platform === 'win32';
    const isPowerShell =
      process.env.ComSpec?.toLowerCase().includes('powershell') ||
      process.env.PSModulePath !== undefined;

    if (!isWindows || !isPowerShell) {
      console.clear();
    }

    // Add top padding
    console.log('    ');

    // Generate logo
    try {
      const logoOutput = cfonts.render('HORUS', {
        font: '3d',
        align: 'left',
        colors: ['blue', 'cyan'],
        space: true,
        maxLength: '0',
        gradient: ['#0038ff', '#00d9ff', '#00f0ff'],
        independentGradient: false,
        transitionGradient: true,
        env: 'node',
      });

      // Add horizontal margin
      if (logoOutput && logoOutput.string) {
        const logoLines = logoOutput.string.split('\n');
        logoLines.forEach((line: string) => {
          if (line.trim()) {
            console.log(' ' + line);
          } else {
            console.log(line);
          }
        });
      }

      console.log(' '); // Spacing after logo
    } catch {
      console.log('   HORUS'); // Fallback if cfonts fails
      console.log(' ');
    }

    setChatHistory([]);
  }, []);

  // Process initial message
  useEffect(() => {
    if (initialMessage && agent) {
      const userEntry: ChatEntry = {
        type: 'user',
        content: initialMessage,
        timestamp: new Date(),
      };
      setChatHistory([userEntry]);

      const processInitialMessage = async () => {
        setIsProcessing(true);
        setIsStreaming(true);

        try {
          let streamingEntry: ChatEntry | null = null;
          for await (const chunk of agent.processUserMessageStream(initialMessage)) {
            switch (chunk.type) {
              case 'content':
                if (chunk.content) {
                  if (!streamingEntry) {
                    const newStreamingEntry = {
                      type: 'assistant' as const,
                      content: chunk.content,
                      timestamp: new Date(),
                      isStreaming: true,
                    };
                    setChatHistory((prev) => [...prev, newStreamingEntry]);
                    streamingEntry = newStreamingEntry;
                  } else {
                    setChatHistory((prev) =>
                      prev.map((entry, idx) =>
                        idx === prev.length - 1 && entry.isStreaming
                          ? { ...entry, content: entry.content + chunk.content }
                          : entry
                      )
                    );
                  }
                }
                break;
              case 'token_count':
                if (chunk.tokenCount !== undefined) {
                  setTokenCount(chunk.tokenCount);
                }
                break;
              case 'tool_calls':
                if (chunk.toolCalls) {
                  setChatHistory((prev) =>
                    prev.map((entry) =>
                      entry.isStreaming
                        ? {
                            ...entry,
                            isStreaming: false,
                            toolCalls: chunk.toolCalls,
                          }
                        : entry
                    )
                  );
                  streamingEntry = null;

                  chunk.toolCalls.forEach((toolCall) => {
                    const toolCallEntry: ChatEntry = {
                      type: 'tool_call',
                      content: 'Executing...',
                      timestamp: new Date(),
                      toolCall: toolCall,
                    };
                    setChatHistory((prev) => [...prev, toolCallEntry]);
                  });
                }
                break;
              case 'tool_result':
                if (chunk.toolCall && chunk.toolResult) {
                  setChatHistory((prev) =>
                    prev.map((entry) => {
                      if (entry.isStreaming) {
                        return { ...entry, isStreaming: false };
                      }
                      if (
                        entry.type === 'tool_call' &&
                        entry.toolCall?.id === chunk.toolCall?.id
                      ) {
                        return {
                          ...entry,
                          type: 'tool_result',
                          content: chunk.toolResult.success
                            ? chunk.toolResult.output || 'Success'
                            : chunk.toolResult.error || 'Error occurred',
                          toolResult: chunk.toolResult,
                        };
                      }
                      return entry;
                    })
                  );
                  streamingEntry = null;
                }
                break;
              case 'done':
                if (streamingEntry) {
                  setChatHistory((prev) =>
                    prev.map((entry) =>
                      entry.isStreaming ? { ...entry, isStreaming: false } : entry
                    )
                  );
                }
                setIsStreaming(false);
                break;
            }
          }
        } catch (error: any) {
          const errorEntry: ChatEntry = {
            type: 'assistant',
            content: `Error: ${error.message}`,
            timestamp: new Date(),
          };
          setChatHistory((prev) => [...prev, errorEntry]);
          setIsStreaming(false);
        }

        setIsProcessing(false);
        processingStartTime.current = 0;
      };

      processInitialMessage();
    }
  }, [initialMessage, agent]);

  useEffect(() => {
    const handleConfirmationRequest = (options: ConfirmationOptions) => {
      setConfirmationOptions(options);
    };

    confirmationService.on('confirmation-requested', handleConfirmationRequest);

    return () => {
      confirmationService.off(
        'confirmation-requested',
        handleConfirmationRequest
      );
    };
  }, [confirmationService]);

  useEffect(() => {
    if (!isProcessing && !isStreaming) {
      setProcessingTime(0);
      return;
    }

    if (processingStartTime.current === 0) {
      processingStartTime.current = Date.now();
    }

    const interval = setInterval(() => {
      setProcessingTime(
        Math.floor((Date.now() - processingStartTime.current) / 1000)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [isProcessing, isStreaming]);

  const handleConfirmation = (dontAskAgain?: boolean) => {
    confirmationService.confirmOperation(true, dontAskAgain);
    setConfirmationOptions(null);
  };

  const handleRejection = (feedback?: string) => {
    confirmationService.rejectOperation(feedback);
    setConfirmationOptions(null);

    setIsProcessing(false);
    setIsStreaming(false);
    setTokenCount(0);
    setProcessingTime(0);
    processingStartTime.current = 0;
  };

  return (
    <Box flexDirection="column" paddingX={2}>
      {/* Modern Header */}
      <ModernHeader
        model={agent.getCurrentModel()}
        autoEditEnabled={autoEditEnabled}
        mcpServersCount={mcpServersCount}
        isProcessing={isProcessing || isStreaming}
        operationMode={operationMode}
      />

      {/* Welcome tips (only when no chat history) */}
      {chatHistory.length === 0 && !confirmationOptions && (
        <Box flexDirection="column" marginBottom={2}>
          <Text color="white" bold>
            {DS.Icons.info} Getting Started
          </Text>
          <Box marginTop={1} flexDirection="column" marginLeft={2}>
            <Text color="gray">• Ask questions or request code changes in natural language</Text>
            <Text color="gray">• Type / to see available slash commands</Text>
            <Text color="gray">• Use /help for full documentation</Text>
            <Text color="gray">• Press Shift+Tab to cycle modes (normal → auto → plan)</Text>
            <Text color="gray">• Create custom commands in .horus/commands/</Text>
          </Box>
        </Box>
      )}

      {/* Chat history */}
      <Box flexDirection="column" ref={scrollRef} marginBottom={1}>
        <ModernChatHistory
          entries={chatHistory}
          isConfirmationActive={!!confirmationOptions}
        />
      </Box>

      {/* Confirmation dialog */}
      {confirmationOptions && (
        <ConfirmationDialog
          operation={confirmationOptions.operation}
          filename={confirmationOptions.filename}
          showVSCodeOpen={confirmationOptions.showVSCodeOpen}
          content={confirmationOptions.content}
          onConfirm={handleConfirmation}
          onReject={handleRejection}
        />
      )}

      {!confirmationOptions && (
        <>
          {/* Loading spinner */}
          <ModernLoadingSpinner
            isActive={isProcessing || isStreaming}
            processingTime={processingTime}
            tokenCount={tokenCount}
          />

          {/* Chat input */}
          <ModernChatInput
            input={input}
            cursorPosition={cursorPosition}
            isProcessing={isProcessing}
            isStreaming={isStreaming}
          />

          {/* Status bar */}
          <ModernStatusBar
            processingTime={processingTime}
            tokenCount={tokenCount}
            isProcessing={isProcessing || isStreaming}
          />

          {/* Command suggestions */}
          <CommandSuggestions
            suggestions={commandSuggestions}
            input={input}
            selectedIndex={selectedCommandIndex}
            isVisible={showCommandSuggestions}
          />

          {/* Model selection */}
          <ModelSelection
            models={availableModels}
            selectedIndex={selectedModelIndex}
            isVisible={showModelSelection}
            currentModel={agent.getCurrentModel()}
          />
        </>
      )}
    </Box>
  );
}

// Main component that handles API key input or chat interface
export default function ModernChatInterface({
  agent,
  initialMessage,
}: ModernChatInterfaceProps) {
  const [currentAgent, setCurrentAgent] = useState<HorusAgent | null>(
    agent || null
  );

  const handleApiKeySet = (newAgent: HorusAgent) => {
    setCurrentAgent(newAgent);
  };

  if (!currentAgent) {
    return <ApiKeyInput onApiKeySet={handleApiKeySet} />;
  }

  return (
    <ModernChatInterfaceWithAgent
      agent={currentAgent}
      initialMessage={initialMessage}
    />
  );
}
