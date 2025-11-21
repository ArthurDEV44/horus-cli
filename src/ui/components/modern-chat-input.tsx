import React from 'react';
import { Box, Text } from 'ink';
import { DesignSystem as DS } from '../theme/design-system.js';

interface ModernChatInputProps {
  input: string;
  cursorPosition: number;
  isProcessing?: boolean;
  isStreaming?: boolean;
  placeholder?: string;
}

/**
 * Modern chat input component
 * Clean, minimal input field with cursor indicator
 */
export const ModernChatInput: React.FC<ModernChatInputProps> = ({
  input,
  cursorPosition,
  isProcessing = false,
  isStreaming = false,
  placeholder = 'Ask anything...',
}) => {
  const isDisabled = isProcessing || isStreaming;

  // Split input at cursor position
  const beforeCursor = input.substring(0, cursorPosition);
  const atCursor = input[cursorPosition] || ' ';
  const afterCursor = input.substring(cursorPosition + 1);

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Input container with border */}
      <Box flexDirection="row">
        <Text color={isDisabled ? 'gray' : 'cyan'}>
          {DS.Icons.arrow.right}
        </Text>
        <Text color="white"> </Text>

        {/* Input content or placeholder */}
        {input.length === 0 ? (
          <Text color="gray" dimColor>
            {placeholder}
          </Text>
        ) : (
          <Box flexDirection="row">
            <Text color="white">{beforeCursor}</Text>
            <Text color="white" inverse>
              {atCursor}
            </Text>
            <Text color="white">{afterCursor}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};
