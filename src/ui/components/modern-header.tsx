import React from 'react';
import { Box, Text } from 'ink';
import { DesignSystem as DS } from '../theme/design-system.js';
import { getModelMaxContext } from '../../horus/model-configs.js';
import type { OperationMode } from '../../utils/planning-mode-service.js';

interface ModernHeaderProps {
  model: string;
  autoEditEnabled: boolean;
  mcpServersCount?: number;
  isProcessing?: boolean;
  operationMode?: OperationMode;
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
  operationMode = 'normal',
}) => {
  const maxContext = getModelMaxContext(model);
  const contextFormatted = DS.Formatters.formatContext(maxContext);

  // Mode indicator configuration
  const getModeIndicator = () => {
    switch (operationMode) {
      case 'planning':
        return { icon: '◇', label: 'plan', color: 'magenta' as const };
      case 'auto-edit':
        return { icon: DS.Icons.success, label: 'auto', color: 'green' as const };
      default:
        return { icon: DS.Icons.pending, label: 'normal', color: 'gray' as const };
    }
  };

  const modeIndicator = getModeIndicator();

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
          {/* Mode indicator */}
          <Box marginRight={2}>
            <Text color={modeIndicator.color}>
              {modeIndicator.icon}
            </Text>
            <Text color={modeIndicator.color}> {modeIndicator.label}</Text>
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
