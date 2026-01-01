import { useState, useMemo, useEffect, useCallback } from "react";
import { useInput } from "ink";
import { HorusAgent, ChatEntry } from "../agent/horus-agent.js";
import { ConfirmationService } from "../utils/confirmation-service.js";
import { useEnhancedInput, Key } from "./use-enhanced-input.js";

import { filterCommandSuggestions } from "../ui/components/command-suggestions.js";
import { loadModelConfig, updateCurrentModel } from "../utils/model-config.js";
import { getHookManager } from "./hook-manager.js";

// Slash commands system
import {
  initializeSlashCommands,
  executeSlashCommand,
  getSlashCommandSuggestions,
  isSlashCommandInput,
  type CommandContext,
  type CommandSuggestion,
} from "../commands/slash/index.js";

interface UseInputHandlerProps {
  agent: HorusAgent;
  chatHistory: ChatEntry[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatEntry[]>>;
  setIsProcessing: (processing: boolean) => void;
  setIsStreaming: (streaming: boolean) => void;
  setTokenCount: (count: number) => void;
  setProcessingTime: (time: number) => void;
  processingStartTime: React.MutableRefObject<number>;
  isProcessing: boolean;
  isStreaming: boolean;
  isConfirmationActive?: boolean;
}

interface LegacyCommandSuggestion {
  command: string;
  description: string;
}

interface ModelOption {
  model: string;
}

export function useInputHandler({
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
  isConfirmationActive = false,
}: UseInputHandlerProps) {
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [showModelSelection, setShowModelSelection] = useState(false);
  const [selectedModelIndex, setSelectedModelIndex] = useState(0);
  const [slashCommandsInitialized, setSlashCommandsInitialized] = useState(false);
  const [autoEditEnabled, setAutoEditEnabled] = useState(() => {
    const confirmationService = ConfirmationService.getInstance();
    const sessionFlags = confirmationService.getSessionFlags();
    return sessionFlags.allOperations;
  });

  // Initialize slash commands system on mount
  useEffect(() => {
    if (!slashCommandsInitialized) {
      initializeSlashCommands(process.cwd())
        .then(() => setSlashCommandsInitialized(true))
        .catch((err) => {
          console.warn('Failed to initialize slash commands:', err);
          setSlashCommandsInitialized(true); // Continue anyway
        });
    }
  }, [slashCommandsInitialized]);

  const handleSpecialKey = (key: Key): boolean => {
    // Don't handle input if confirmation dialog is active
    if (isConfirmationActive) {
      return true; // Prevent default handling
    }

    // Handle shift+tab to toggle auto-edit mode
    if (key.shift && key.tab) {
      const newAutoEditState = !autoEditEnabled;
      setAutoEditEnabled(newAutoEditState);

      const confirmationService = ConfirmationService.getInstance();
      if (newAutoEditState) {
        // Enable auto-edit: set all operations to be accepted
        confirmationService.setSessionFlag("allOperations", true);
      } else {
        // Disable auto-edit: reset session flags
        confirmationService.resetSession();
      }
      return true; // Handled
    }

    // Handle escape key for closing menus
    if (key.escape) {
      if (showCommandSuggestions) {
        setShowCommandSuggestions(false);
        setSelectedCommandIndex(0);
        return true;
      }
      if (showModelSelection) {
        setShowModelSelection(false);
        setSelectedModelIndex(0);
        return true;
      }
      if (isProcessing || isStreaming) {
        agent.abortCurrentOperation();
        setIsProcessing(false);
        setIsStreaming(false);
        setTokenCount(0);
        setProcessingTime(0);
        processingStartTime.current = 0;
        return true;
      }
      return false; // Let default escape handling work
    }

    // Handle command suggestions navigation
    if (showCommandSuggestions) {
      const filteredSuggestions = filterCommandSuggestions(
        commandSuggestions,
        input
      );

      if (filteredSuggestions.length === 0) {
        setShowCommandSuggestions(false);
        setSelectedCommandIndex(0);
        return false; // Continue processing
      } else {
        if (key.upArrow) {
          setSelectedCommandIndex((prev) =>
            prev === 0 ? filteredSuggestions.length - 1 : prev - 1
          );
          return true;
        }
        if (key.downArrow) {
          setSelectedCommandIndex(
            (prev) => (prev + 1) % filteredSuggestions.length
          );
          return true;
        }
        if (key.tab || key.return) {
          const safeIndex = Math.min(
            selectedCommandIndex,
            filteredSuggestions.length - 1
          );
          const selectedCommand = filteredSuggestions[safeIndex];
          const newInput = selectedCommand.command + " ";
          setInput(newInput);
          setCursorPosition(newInput.length);
          setShowCommandSuggestions(false);
          setSelectedCommandIndex(0);
          return true;
        }
      }
    }

    // Handle model selection navigation
    if (showModelSelection) {
      if (key.upArrow) {
        setSelectedModelIndex((prev) =>
          prev === 0 ? availableModels.length - 1 : prev - 1
        );
        return true;
      }
      if (key.downArrow) {
        setSelectedModelIndex((prev) => (prev + 1) % availableModels.length);
        return true;
      }
      if (key.tab || key.return) {
        const selectedModel = availableModels[selectedModelIndex];
        agent.setModel(selectedModel.model);
        updateCurrentModel(selectedModel.model);
        const confirmEntry: ChatEntry = {
          type: "assistant",
          content: `✓ Switched to model: ${selectedModel.model}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, confirmEntry]);
        setShowModelSelection(false);
        setSelectedModelIndex(0);
        return true;
      }
    }

    return false; // Let default handling proceed
  };

  const handleInputSubmit = async (userInput: string) => {
    if (userInput === "exit" || userInput === "quit") {
      process.exit(0);
      return;
    }

    if (userInput.trim()) {
      const directCommandResult = await handleDirectCommand(userInput);
      if (!directCommandResult) {
        await processUserMessage(userInput);
      }
    }
  };

  const handleInputChange = (newInput: string) => {
    // Update command suggestions based on input
    if (newInput.startsWith("/")) {
      setShowCommandSuggestions(true);
      setSelectedCommandIndex(0);
    } else {
      setShowCommandSuggestions(false);
      setSelectedCommandIndex(0);
    }
  };

  const {
    input,
    cursorPosition,
    setInput,
    setCursorPosition,
    clearInput,
    resetHistory,
    handleInput,
  } = useEnhancedInput({
    onSubmit: handleInputSubmit,
    onSpecialKey: handleSpecialKey,
    disabled: isConfirmationActive,
  });

  // Hook up the actual input handling with error boundary
  // In Ink 6.x, useInput needs isActive option - always active to allow Ctrl+C
  useInput((inputChar: string, key: Key) => {
    try {
      handleInput(inputChar, key);
    } catch (error: any) {
      // Debug mode
      if (process.env.DEBUG) {
        console.error('DEBUG - useInput error:', error);
      }

      // Silently ignore EPERM errors from stdin in WSL2
      if (error.code === 'EPERM' && error.syscall === 'read') {
        if (process.env.DEBUG) {
          console.error('DEBUG - EPERM error ignored in useInput');
        }
        return; // Don't rethrow, just return
      }

      // Rethrow other errors
      throw error;
    }
  }, { isActive: true });

  // Update command suggestions when input changes
  useEffect(() => {
    handleInputChange(input);
  }, [input]);

  // Get dynamic command suggestions from slash commands system
  const commandSuggestions: LegacyCommandSuggestion[] = useMemo(() => {
    if (!slashCommandsInitialized) {
      // Fallback suggestions while loading
      return [
        { command: "/help", description: "Show help information" },
        { command: "/clear", description: "Clear chat history" },
        { command: "/models", description: "Switch Horus Model" },
        { command: "/commit", description: "AI commit message" },
        { command: "/exit", description: "Exit the application" },
      ];
    }

    // Get suggestions from slash commands system
    const suggestions = getSlashCommandSuggestions(input);
    return suggestions.map(s => ({
      command: s.command,
      description: s.description,
    }));
  }, [slashCommandsInitialized, input]);

  // Load models from configuration with fallback to defaults
  const availableModels: ModelOption[] = useMemo(() => {
    return loadModelConfig(); // Return directly, interface already matches
  }, []);

  // Helper to add chat entry
  const addChatEntry = useCallback((entry: ChatEntry) => {
    setChatHistory((prev) => [...prev, entry]);
  }, [setChatHistory]);

  const handleDirectCommand = async (input: string): Promise<boolean> => {
    const trimmedInput = input.trim();

    // Check if this is a slash command
    if (isSlashCommandInput(trimmedInput)) {
      // Build command context
      const context: CommandContext = {
        agent,
        chatHistory,
        addChatEntry,
        clearHistory: () => {
          setChatHistory([]);
          setIsProcessing(false);
          setIsStreaming(false);
          setTokenCount(0);
          setProcessingTime(0);
          processingStartTime.current = 0;
        },
        setProcessing: setIsProcessing,
        setStreaming: setIsStreaming,
        cwd: process.cwd(),
        rawArgs: '',
        args: [],
      };

      // Execute slash command
      const result = await executeSlashCommand(trimmedInput, context);

      if (result.handled) {
        // Show error if any
        if (result.error) {
          const errorEntry: ChatEntry = {
            type: 'assistant',
            content: `❌ ${result.error}`,
            timestamp: new Date(),
          };
          addChatEntry(errorEntry);
        }
        // Show message if any
        else if (result.message && !result.continueAsMessage) {
          const msgEntry: ChatEntry = {
            type: 'assistant',
            content: result.message,
            timestamp: new Date(),
          };
          addChatEntry(msgEntry);
        }
        // If command wants to continue as message, return false to process normally
        else if (result.continueAsMessage && result.message) {
          clearInput();
          // Process the expanded prompt as a user message
          await processUserMessage(result.message);
          return true;
        }

        clearInput();
        return true;
      }
    }

    // Legacy: /models with menu (kept for UX)
    if (trimmedInput === "/models") {
      setShowModelSelection(true);
      setSelectedModelIndex(0);
      clearInput();
      return true;
    }

    // Legacy: /commit-and-push alias to /commit --push
    if (trimmedInput === "/commit-and-push") {
      const context: CommandContext = {
        agent,
        chatHistory,
        addChatEntry,
        clearHistory: () => setChatHistory([]),
        setProcessing: setIsProcessing,
        setStreaming: setIsStreaming,
        cwd: process.cwd(),
        rawArgs: '--push',
        args: ['--push'],
      };
      await executeSlashCommand('/commit --push', context);
      clearInput();
      return true;
    }

    // Direct bash commands (ls, pwd, cd, etc.)
    const directBashCommands = [
      "ls",
      "pwd",
      "cd",
      "cat",
      "mkdir",
      "touch",
      "echo",
      "grep",
      "find",
      "cp",
      "mv",
      "rm",
    ];
    const firstWord = trimmedInput.split(" ")[0];

    if (directBashCommands.includes(firstWord)) {
      const userEntry: ChatEntry = {
        type: "user",
        content: trimmedInput,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, userEntry]);

      try {
        const result = await agent.executeBashCommand(trimmedInput);

        const commandEntry: ChatEntry = {
          type: "tool_result",
          content: result.success
            ? result.output || "Command completed"
            : result.error || "Command failed",
          timestamp: new Date(),
          toolCall: {
            id: `bash_${Date.now()}`,
            type: "function",
            function: {
              name: "bash",
              arguments: JSON.stringify({ command: trimmedInput }),
            },
          },
          toolResult: result,
        };
        setChatHistory((prev) => [...prev, commandEntry]);
      } catch (error: any) {
        const errorEntry: ChatEntry = {
          type: "assistant",
          content: `Error executing command: ${error.message}`,
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errorEntry]);
      }

      clearInput();
      return true;
    }

    return false;
  };

  const processUserMessage = async (userInput: string) => {
    // Execute PreSubmit hooks before sending message
    const hookManager = getHookManager();
    const preSubmitResults = await hookManager.executeHooks("PreSubmit", {
      message: userInput,
    });

    // Log hook results if any ran (even if they failed with continue mode)
    if (preSubmitResults.length > 0) {
      const hookSummary = preSubmitResults.map(r =>
        `${r.success ? '✓' : '⚠'} ${r.name}: ${r.success ? 'passed' : r.error || 'failed'}`
      ).join('\n');

      const hookEntry: ChatEntry = {
        type: 'assistant',
        content: `PreSubmit hooks:\n${hookSummary}`,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, hookEntry]);
    }

    // Check if any blocking hook failed
    if (hookManager.hasBlockingFailure(preSubmitResults)) {
      const failedHook = preSubmitResults.find(r => r.blocked);
      const errorEntry: ChatEntry = {
        type: 'assistant',
        content: `❌ PreSubmit hook "${failedHook?.name}" blocked the message: ${failedHook?.error}`,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, errorEntry]);
      return; // Don't process the message
    }

    const userEntry: ChatEntry = {
      type: "user",
      content: userInput,
      timestamp: new Date(),
    };
    setChatHistory((prev) => [...prev, userEntry]);

    setIsProcessing(true);
    clearInput();

    try {
      setIsStreaming(true);
      let streamingEntry: ChatEntry | null = null;

      for await (const chunk of agent.processUserMessageStream(userInput)) {
        switch (chunk.type) {
          case "content":
            if (chunk.content) {
              if (!streamingEntry) {
                const newStreamingEntry = {
                  type: "assistant" as const,
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

          case "token_count":
            if (chunk.tokenCount !== undefined) {
              setTokenCount(chunk.tokenCount);
            }
            break;

          case "tool_calls":
            if (chunk.toolCalls) {
              // Stop streaming for the current assistant message
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

              // Add individual tool call entries to show tools are being executed
              chunk.toolCalls.forEach((toolCall) => {
                const toolCallEntry: ChatEntry = {
                  type: "tool_call",
                  content: "Executing...",
                  timestamp: new Date(),
                  toolCall: toolCall,
                };
                setChatHistory((prev) => [...prev, toolCallEntry]);
              });
            }
            break;

          case "tool_result":
            if (chunk.toolCall && chunk.toolResult) {
              setChatHistory((prev) =>
                prev.map((entry) => {
                  if (entry.isStreaming) {
                    return { ...entry, isStreaming: false };
                  }
                  // Update the existing tool_call entry with the result
                  if (
                    entry.type === "tool_call" &&
                    entry.toolCall?.id === chunk.toolCall?.id
                  ) {
                    return {
                      ...entry,
                      type: "tool_result",
                      content: chunk.toolResult.success
                        ? chunk.toolResult.output || "Success"
                        : chunk.toolResult.error || "Error occurred",
                      toolResult: chunk.toolResult,
                    };
                  }
                  return entry;
                })
              );
              streamingEntry = null;
            }
            break;

          case "done":
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
        type: "assistant",
        content: `Error: ${error.message}`,
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, errorEntry]);
      setIsStreaming(false);
    }

    setIsProcessing(false);
    processingStartTime.current = 0;
  };


  return {
    input,
    cursorPosition,
    showCommandSuggestions,
    selectedCommandIndex,
    showModelSelection,
    selectedModelIndex,
    commandSuggestions,
    availableModels,
    agent,
    autoEditEnabled,
  };
}
