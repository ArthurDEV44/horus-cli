import React from 'react';
import { Box } from 'ink';
import { ChatEntry } from '../../agent/horus-agent.js';
import { ModernMessage } from './modern-message.js';

interface ModernChatHistoryProps {
  entries: ChatEntry[];
  isConfirmationActive?: boolean;
}

/**
 * Modern chat history component
 * Renders all messages in a clean, organized manner
 */
export const ModernChatHistory: React.FC<ModernChatHistoryProps> = ({
  entries,
  isConfirmationActive = false,
}) => {
  if (entries.length === 0 && !isConfirmationActive) {
    return null;
  }

  return (
    <Box flexDirection="column">
      {entries.map((entry, index) => (
        <ModernMessage
          key={`${entry.type}-${entry.timestamp.getTime()}-${index}`}
          entry={entry}
          isLast={index === entries.length - 1}
        />
      ))}
    </Box>
  );
};
