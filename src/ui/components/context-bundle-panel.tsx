import React from "react";
import { Box, Text } from "ink";
import type { ContextBundle, ContextMetadata } from "../../types/context.js";

interface ContextBundlePanelProps {
  bundle: ContextBundle;
  compact?: boolean;
}

/**
 * Ink component for displaying live context bundle information
 * Shows which files/sources were selected, tokens used, strategy, etc.
 */
export const ContextBundlePanel: React.FC<ContextBundlePanelProps> = ({
  bundle,
  compact = false,
}) => {
  if (bundle.sources.length === 0) {
    return null; // Don't show if no sources
  }

  const metadata = bundle.metadata;

  // Compact mode - single line summary
  if (compact) {
    return (
      <Box>
        <Text dimColor>
          📦 {bundle.sources.length} files | {metadata.tokensUsed.toLocaleString()} tokens | {metadata.strategy}
          {metadata.cacheHits > 0 && ` | ${metadata.cacheHits}/${bundle.sources.length} cached`}
        </Text>
      </Box>
    );
  }

  // Full mode - detailed panel
  const getCacheColor = (hits: number, total: number): string => {
    const rate = total > 0 ? hits / total : 0;
    if (rate > 0.5) return "green";
    if (rate > 0.2) return "yellow";
    return "red";
  };

  const getStrategyEmoji = (strategy: string): string => {
    const emojiMap: Record<string, string> = {
      "agentic-search": "🔍",
      "cached": "💾",
      "subagents": "🤖",
      "enhanced-search": "⚡",
    };
    return emojiMap[strategy] || "📦";
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingY={0}>
      <Box paddingX={2} paddingTop={1}>
        <Text bold color="cyan">
          {getStrategyEmoji(metadata.strategy)} Context Bundle
        </Text>
      </Box>

      <Box flexDirection="column" paddingX={2} paddingBottom={1}>
        <Box>
          <Text dimColor>Strategy: </Text>
          <Text color="cyan">{metadata.strategy}</Text>
        </Box>
        <Box>
          <Text dimColor>Files:    </Text>
          <Text color="yellow">
            {metadata.filesRead}/{metadata.filesScanned}
          </Text>
        </Box>
        <Box>
          <Text dimColor>Tokens:   </Text>
          <Text color="yellow">{metadata.tokensUsed.toLocaleString()}</Text>
        </Box>
        <Box>
          <Text dimColor>Duration: </Text>
          <Text color="yellow">{metadata.duration}ms</Text>
        </Box>

        {metadata.cacheHits > 0 && (
          <Box>
            <Text dimColor>Cache:    </Text>
            <Text color={getCacheColor(metadata.cacheHits, bundle.sources.length)}>
              {metadata.cacheHits}/{bundle.sources.length} hits
            </Text>
          </Box>
        )}
      </Box>

      {bundle.sources.length > 0 && (
        <Box flexDirection="column" paddingX={2} paddingBottom={1}>
          <Text bold dimColor>Sources (top 5):</Text>
          <Box flexDirection="column" paddingLeft={2}>
            {bundle.sources.slice(0, 5).map((src, i) => (
              <Text key={i} dimColor>
                {i + 1}. {src.path} ({src.tokens} tokens)
              </Text>
            ))}
            {bundle.sources.length > 5 && (
              <Text dimColor>   ... and {bundle.sources.length - 5} more</Text>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

/**
 * Minimal inline context bundle component for embedding in chat
 */
export const ContextBundleInline: React.FC<{ bundle: ContextBundle }> = ({ bundle }) => {
  if (bundle.sources.length === 0) {
    return null;
  }

  return (
    <Box>
      <Text dimColor>
        📦 {bundle.sources.length} files ({bundle.metadata.tokensUsed.toLocaleString()} tokens) via {bundle.metadata.strategy}
      </Text>
    </Box>
  );
};

interface LiveContextMetricsProps {
  model: string;
  maxContext: number;
  currentUsage: number;
  cacheStats?: {
    size: number;
    hits: number;
    misses: number;
    totalTokensSaved: number;
  };
}

/**
 * Live context metrics panel
 * Shows model, context window, usage, cache performance
 */
export const LiveContextMetrics: React.FC<LiveContextMetricsProps> = ({
  model,
  maxContext,
  currentUsage,
  cacheStats,
}) => {
  const usagePercent = (currentUsage / maxContext) * 100;
  const getUsageColor = (percent: number): string => {
    if (percent > 80) return "red";
    if (percent > 60) return "yellow";
    return "green";
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingY={0}>
      <Box paddingX={2} paddingTop={1}>
        <Text bold color="blue">🔧 Context Metrics</Text>
      </Box>

      <Box flexDirection="column" paddingX={2} paddingBottom={1}>
        <Box>
          <Text dimColor>Model:         </Text>
          <Text color="cyan">{model}</Text>
        </Box>
        <Box>
          <Text dimColor>Context Window:</Text>
          <Text color="yellow"> {maxContext.toLocaleString()} tokens</Text>
        </Box>
        <Box>
          <Text dimColor>Current Usage: </Text>
          <Text color={getUsageColor(usagePercent)}>
            {currentUsage.toLocaleString()} tokens ({usagePercent.toFixed(1)}%)
          </Text>
        </Box>

        {cacheStats && (
          <>
            <Box paddingTop={1}>
              <Text bold dimColor>Cache Performance:</Text>
            </Box>
            <Box>
              <Text dimColor>  Size:        </Text>
              <Text color="yellow">{cacheStats.size} entries</Text>
            </Box>
            <Box>
              <Text dimColor>  Hit Rate:    </Text>
              <Text color="green">
                {cacheStats.hits}/{cacheStats.hits + cacheStats.misses} (
                {((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100).toFixed(1)}%)
              </Text>
            </Box>
            <Box>
              <Text dimColor>  Tokens Saved:</Text>
              <Text color="green"> {cacheStats.totalTokensSaved.toLocaleString()}</Text>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};
