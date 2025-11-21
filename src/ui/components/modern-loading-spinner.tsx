import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { DesignSystem as DS } from '../theme/design-system.js';

interface ModernLoadingSpinnerProps {
  isActive: boolean;
  processingTime?: number;
  tokenCount?: number;
  message?: string;
}

// Sophisticated loading messages
const loadingMessages = [
  'Analyzing code patterns',
  'Understanding context',
  'Synthesizing response',
  'Processing request',
  'Evaluating options',
  'Generating solution',
  'Optimizing output',
  'Reviewing changes',
];

/**
 * Modern loading spinner with elegant animations
 * Minimal, subtle, and informative
 */
export const ModernLoadingSpinner: React.FC<ModernLoadingSpinnerProps> = ({
  isActive,
  processingTime = 0,
  tokenCount = 0,
  message,
}) => {
  const [frame, setFrame] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  // Spinner animation (slower, more elegant)
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % DS.Animations.spinnerFrames.length);
    }, 200); // Smooth rotation

    return () => clearInterval(interval);
  }, [isActive]);

  // Message rotation (slower, less distracting)
  useEffect(() => {
    if (!isActive) return;

    setMessageIndex(Math.floor(Math.random() * loadingMessages.length));

    const interval = setInterval(() => {
      setMessageIndex(Math.floor(Math.random() * loadingMessages.length));
    }, 5000); // Change message every 5 seconds

    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  const currentMessage = message || loadingMessages[messageIndex];

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Main loading indicator */}
      <Box flexDirection="row">
        <Text color="cyan" bold>
          {DS.Animations.spinnerFrames[frame]}
        </Text>
        <Text color="white"> {currentMessage}</Text>
        <Text color="gray">...</Text>
      </Box>

      {/* Stats (optional, shown if available) */}
      {(processingTime > 0 || tokenCount > 0) && (
        <Box flexDirection="row" marginLeft={2} marginTop={0.5}>
          <Text color="gray" dimColor>├─ </Text>

          {processingTime > 0 && (
            <>
              <Text color="gray">{DS.Icons.clock} </Text>
              <Text color="white">{DS.Formatters.formatTime(processingTime)}</Text>
            </>
          )}

          {tokenCount > 0 && (
            <>
              <Text color="gray"> • {DS.Icons.token} </Text>
              <Text color="white">{DS.Formatters.formatNumber(tokenCount)}</Text>
              <Text color="gray"> tokens</Text>
            </>
          )}
        </Box>
      )}

      {/* Hint */}
      <Box flexDirection="row" marginLeft={2} marginTop={0.5}>
        <Text color="gray" dimColor>
          └─ Press Esc to interrupt
        </Text>
      </Box>
    </Box>
  );
};
