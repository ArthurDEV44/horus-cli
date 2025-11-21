import React from "react";
import { Box, Text } from "ink";
import { ContextTelemetry, TelemetrySnapshot } from "../../utils/context-telemetry.js";

interface ContextStatusPanelProps {
  lastN?: number;
  compact?: boolean;
}

/**
 * Ink component for displaying context telemetry status
 * Can be embedded in the main chat interface or used standalone
 */
export const ContextStatusPanel: React.FC<ContextStatusPanelProps> = ({
  lastN = 10,
  compact = false,
}) => {
  const telemetry = ContextTelemetry.getInstance();
  const snapshot = telemetry.getSnapshot(lastN);

  if (snapshot.totalOperations === 0) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Text color="yellow">⚠️  No telemetry data available</Text>
        <Text dimColor>   Run some operations first to collect data</Text>
      </Box>
    );
  }

  // Compact mode - single line summary
  if (compact) {
    return (
      <Box>
        <Text dimColor>
          📊 {snapshot.totalOperations} ops | ~{snapshot.avgTokensPerOperation} tok/op | {snapshot.avgDuration}ms avg
          {snapshot.cacheHitRate > 0 && ` | ${(snapshot.cacheHitRate * 100).toFixed(0)}% cached`}
        </Text>
      </Box>
    );
  }

  // Full mode - detailed panel
  const getOperationEmoji = (op: string): string => {
    const emojiMap: Record<string, string> = {
      search: "🔍",
      view: "👁️",
      edit: "✏️",
      create: "📝",
    };
    return emojiMap[op] || "•";
  };

  const getCacheColor = (rate: number): string => {
    if (rate > 0.5) return "green";
    if (rate > 0.2) return "yellow";
    return "red";
  };

  return (
    <Box flexDirection="column" paddingY={1} borderStyle="round" borderColor="cyan">
      <Box paddingX={2}>
        <Text bold color="cyan">📊 Context Telemetry Status</Text>
      </Box>

      <Box flexDirection="column" paddingX={2} paddingTop={1}>
        <Text bold>Overview:</Text>
        <Box flexDirection="column" paddingLeft={2}>
          <Text>
            Total Operations: <Text color="green">{snapshot.totalOperations}</Text>
          </Text>
          <Text>
            Avg Tokens/Op:    <Text color="yellow">{snapshot.avgTokensPerOperation}</Text>
          </Text>
          <Text>
            Avg Duration:     <Text color="yellow">{snapshot.avgDuration}ms</Text>
          </Text>
          <Text>
            Cache Hit Rate:   <Text color={getCacheColor(snapshot.cacheHitRate)}>
              {(snapshot.cacheHitRate * 100).toFixed(1)}%
            </Text>
          </Text>
        </Box>
      </Box>

      {Object.keys(snapshot.operationBreakdown).length > 0 && (
        <Box flexDirection="column" paddingX={2} paddingTop={1}>
          <Text bold>Operation Breakdown:</Text>
          <Box flexDirection="column" paddingLeft={2}>
            {Object.entries(snapshot.operationBreakdown).map(([op, count]) => (
              <Text key={op}>
                {getOperationEmoji(op)} {op.padEnd(10)} <Text color="green">{count}</Text>
              </Text>
            ))}
          </Box>
        </Box>
      )}

      {snapshot.recentOperations.length > 0 && (
        <Box flexDirection="column" paddingX={2} paddingTop={1}>
          <Text bold>Recent Operations (last {lastN}):</Text>
          <Box flexDirection="column" paddingLeft={2}>
            {snapshot.recentOperations.map((metric, idx) => (
              <Text key={idx}>
                {idx + 1}. {getOperationEmoji(metric.operation)} {metric.operation} | {metric.duration}ms | ~{metric.tokensEstimated} tokens
                {metric.cacheHit && <Text color="green"> [cached]</Text>}
              </Text>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

/**
 * Minimal inline status component for embedding in chat
 */
export const ContextStatusInline: React.FC = () => {
  const telemetry = ContextTelemetry.getInstance();
  const snapshot = telemetry.getSnapshot();

  if (snapshot.totalOperations === 0) {
    return null;
  }

  return (
    <Box>
      <Text dimColor>
        📊 {snapshot.totalOperations} ops | ~{snapshot.avgTokensPerOperation} tok/op
      </Text>
    </Box>
  );
};
