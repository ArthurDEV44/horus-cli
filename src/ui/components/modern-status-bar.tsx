import React from 'react';
import { Box, Text } from 'ink';
import { DesignSystem as DS } from '../theme/design-system.js';

interface ModernStatusBarProps {
  processingTime?: number;
  tokenCount?: number;
  isProcessing?: boolean;
  helpText?: string;
}

/**
 * Modern status bar component
 * Shows processing stats and helpful information
 */
export const ModernStatusBar: React.FC<ModernStatusBarProps> = ({
  processingTime = 0,
  tokenCount = 0,
  isProcessing = false,
  helpText = 'Ctrl+C to clear • /help for commands • /models to switch',
}) => {
  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Stats bar (only when processing or has stats) */}
      {(isProcessing || tokenCount > 0 || processingTime > 0) && (
        <Box flexDirection="row" marginBottom={0.5}>
          <Text color="gray" dimColor>├ </Text>

          {/* Processing time */}
          {processingTime > 0 && (
            <Box marginRight={2}>
              <Text color="cyan">{DS.Icons.clock} </Text>
              <Text color="white">{DS.Formatters.formatTime(processingTime)}</Text>
            </Box>
          )}

          {/* Token count */}
          {tokenCount > 0 && (
            <Box marginRight={2}>
              <Text color="magenta">{DS.Icons.token} </Text>
              <Text color="white">{DS.Formatters.formatNumber(tokenCount)}</Text>
              <Text color="gray"> tokens</Text>
            </Box>
          )}

          {/* Processing indicator */}
          {isProcessing && (
            <Box>
              <Text color="cyan">{DS.Icons.processing} </Text>
              <Text color="cyan">processing...</Text>
            </Box>
          )}
        </Box>
      )}

      {/* Help text bar */}
      <Box flexDirection="row">
        <Text color="gray" dimColor>└ </Text>
        <Text color="gray" dimColor>{helpText}</Text>
      </Box>
    </Box>
  );
};
