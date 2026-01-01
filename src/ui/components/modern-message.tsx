import React from 'react';
import { Box, Text } from 'ink';
import { DesignSystem as DS } from '../theme/design-system.js';
import { ChatEntry } from '../../agent/horus-agent.js';
import { MarkdownRenderer } from '../utils/markdown-renderer.js';

interface ModernMessageProps {
  entry: ChatEntry;
  isLast?: boolean;
}

/**
 * Modern message component with elegant styling
 * Differentiates between user, assistant, and tool messages
 */
export const ModernMessage: React.FC<ModernMessageProps> = ({
  entry,
  isLast: _isLast = false,
}) => {
  // User message
  if (entry.type === 'user') {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Box flexDirection="row">
          <Text color="green" bold>
            {DS.Icons.arrow.right} You
          </Text>
        </Box>
        <Box flexDirection="row" marginLeft={2}>
          <Text color="white">{entry.content}</Text>
        </Box>
      </Box>
    );
  }

  // Assistant message
  if (entry.type === 'assistant') {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Box flexDirection="row">
          <Text color="cyan" bold>
            {DS.Icons.brain} Horus
          </Text>
          {entry.isStreaming && (
            <Text color="cyan"> {DS.Icons.processing}</Text>
          )}
        </Box>
        <Box flexDirection="column" marginLeft={2}>
          <MarkdownRenderer content={entry.content} />
        </Box>
      </Box>
    );
  }

  // Tool call message
  if (entry.type === 'tool_call' && entry.toolCall) {
    const toolName = entry.toolCall.function.name;
    let args: any = {};
    try {
      args = JSON.parse(entry.toolCall.function.arguments);
    } catch {
      // Ignore JSON parse errors
    }

    return (
      <Box flexDirection="column" marginBottom={1}>
        <Box flexDirection="row">
          <Text color="yellow">
            {DS.Icons.tool} {toolName}
          </Text>
          <Text color="gray"> {DS.Icons.processing} executing...</Text>
        </Box>
        {/* Show args for file operations */}
        {(toolName === 'view_file' || toolName === 'create_file' || toolName === 'str_replace_editor') && args.path && (
          <Box flexDirection="row" marginLeft={2}>
            <Text color="gray" dimColor>
              {DS.Icons.file} {args.path}
            </Text>
          </Box>
        )}
        {toolName === 'bash' && args.command && (
          <Box flexDirection="row" marginLeft={2}>
            <Text color="gray" dimColor>
              $ {args.command}
            </Text>
          </Box>
        )}
      </Box>
    );
  }

  // Tool result message
  if (entry.type === 'tool_result' && entry.toolCall && entry.toolResult) {
    const toolName = entry.toolCall.function.name;
    const success = entry.toolResult.success;

    return (
      <Box flexDirection="column" marginBottom={1}>
        <Box flexDirection="row">
          <Text color={success ? 'green' : 'red'}>
            {success ? DS.Icons.success : DS.Icons.error} {toolName}
          </Text>
          <Text color="gray"> {success ? 'completed' : 'failed'}</Text>
        </Box>
        {/* Show truncated output/error */}
        {entry.content && (
          <Box flexDirection="column" marginLeft={2}>
            <Text color={success ? 'gray' : 'red'} dimColor>
              {DS.Formatters.truncate(entry.content, 200)}
            </Text>
          </Box>
        )}
      </Box>
    );
  }

  return null;
};
