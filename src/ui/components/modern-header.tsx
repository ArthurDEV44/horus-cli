import React from 'react';
import { Box, Text } from 'ink';
import { DesignSystem as DS } from '../theme/design-system.js';
import { getModelMaxContext } from '../../horus/model-configs.js';

interface ModernHeaderProps {
  model: string;
  autoEditEnabled: boolean;
  mcpServersCount?: number;
  isProcessing?: boolean;
}

/**
 * Modern, minimalist header component
 * Displays key information in a clean, organized layout
 */
export const ModernHeader: React.FC<ModernHeaderProps> = ({
  model,
  autoEditEnabled,
  mcpServersCount = 0,
  isProcessing = false,
}) => {
  const maxContext = getModelMaxContext(model);
  const contextFormatted = DS.Formatters.formatContext(maxContext);

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Top border */}
      <Box>
        <Text color="gray" dimColor>
          {DS.Borders.rounded.topLeft}
          {DS.Borders.rounded.top.repeat(78)}
          {DS.Borders.rounded.topRight}
        </Text>
      </Box>

      {/* Header content */}
      <Box flexDirection="row" justifyContent="space-between">
        {/* Left side: Model info */}
        <Box flexDirection="row">
          <Text color="gray" dimColor>{DS.Borders.rounded.left} </Text>
          <Box flexDirection="row">
            <Text color="cyan" bold>{DS.Icons.model} </Text>
            <Text color="white" bold>{model}</Text>
            <Text color="gray" dimColor> • </Text>
            <Text color="magenta">{DS.Icons.context} </Text>
            <Text color="white">{contextFormatted}</Text>
          </Box>
        </Box>

        {/* Right side: Status indicators */}
        <Box flexDirection="row">
          {/* Auto-edit status */}
          <Box marginRight={2}>
            <Text color={autoEditEnabled ? 'green' : 'gray'}>
              {autoEditEnabled ? DS.Icons.success : DS.Icons.pending}
            </Text>
            <Text color={autoEditEnabled ? 'green' : 'gray'}> auto-edit</Text>
          </Box>

          {/* MCP servers */}
          {mcpServersCount > 0 && (
            <Box marginRight={2}>
              <Text color="blue">{DS.Icons.tool}</Text>
              <Text color="white"> {mcpServersCount} MCP</Text>
            </Box>
          )}

          {/* Processing indicator */}
          {isProcessing && (
            <Box marginRight={1}>
              <Text color="cyan">{DS.Icons.processing}</Text>
              <Text color="cyan"> processing</Text>
            </Box>
          )}

          <Text color="gray" dimColor> {DS.Borders.rounded.right}</Text>
        </Box>
      </Box>

      {/* Bottom border */}
      <Box>
        <Text color="gray" dimColor>
          {DS.Borders.rounded.bottomLeft}
          {DS.Borders.rounded.bottom.repeat(78)}
          {DS.Borders.rounded.bottomRight}
        </Text>
      </Box>
    </Box>
  );
};
