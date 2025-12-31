import React, { useMemo } from "react";
import { Box, Text } from "ink";

interface CommandSuggestion {
  command: string;
  description: string;
  scope?: 'builtin' | 'project' | 'user';
}

interface CommandSuggestionsProps {
  suggestions: CommandSuggestion[];
  input: string;
  selectedIndex: number;
  isVisible: boolean;
}

export const MAX_SUGGESTIONS = 10;

export function filterCommandSuggestions<T extends { command: string }>(
  suggestions: T[],
  input: string
): T[] {
  const lowerInput = input.toLowerCase();
  return suggestions
    .filter((s) => s.command.toLowerCase().startsWith(lowerInput))
    .slice(0, MAX_SUGGESTIONS);
}

/**
 * Get scope indicator icon
 */
function getScopeIcon(scope?: string): string {
  switch (scope) {
    case 'project': return '📁';
    case 'user': return '👤';
    default: return '⚡';
  }
}

export function CommandSuggestions({
  suggestions,
  input,
  selectedIndex,
  isVisible,
}: CommandSuggestionsProps) {
  if (!isVisible) return null;

  const filteredSuggestions = useMemo(
    () => filterCommandSuggestions(suggestions, input),
    [suggestions, input]
  );

  if (filteredSuggestions.length === 0) return null;

  return (
    <Box marginTop={1} flexDirection="column">
      {filteredSuggestions.map((suggestion, index) => (
        <Box key={index} paddingLeft={1}>
          <Text color="gray" dimColor>
            {getScopeIcon(suggestion.scope)}{' '}
          </Text>
          <Text
            color={index === selectedIndex ? "black" : "cyan"}
            backgroundColor={index === selectedIndex ? "cyan" : undefined}
            bold={index === selectedIndex}
          >
            {suggestion.command}
          </Text>
          <Box marginLeft={1}>
            <Text color="gray">{suggestion.description}</Text>
          </Box>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ↑↓ navigate • Enter/Tab select • Esc cancel
        </Text>
      </Box>
    </Box>
  );
}