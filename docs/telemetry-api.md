# Context Telemetry API

## Overview

The Context Telemetry system tracks all context-related operations (search, view, edit, create) to provide performance insights and enable optimization.

## Usage

### Basic Recording

```typescript
import { ContextTelemetry } from '../utils/context-telemetry';

const telemetry = ContextTelemetry.getInstance();

// Record a search operation
telemetry.recordMetric({
  operation: 'search',
  timestamp: Date.now(),
  duration: 150,
  filesScanned: 42,
  filesMatched: 5,
  tokensEstimated: 2500,
  pattern: '*.ts',
  strategy: 'agentic-search',
});
```

### Getting Snapshots

```typescript
// Get full snapshot
const snapshot = telemetry.getSnapshot();
console.log(`Avg tokens: ${snapshot.avgTokensPerOperation}`);
console.log(`Cache hit rate: ${snapshot.cacheHitRate * 100}%`);

// Get last 10 operations only
const recent = telemetry.getSnapshot(10);
```

### Exporting for Benchmarks

```typescript
// Export to file
telemetry.exportToJSON('benchmarks/baseline.json');

// Get JSON string
const json = telemetry.exportToJSON();
```

### Debug Mode

Set environment variable to enable logging:

```bash
export HORUS_CONTEXT_DEBUG=true
horus "your command"
```

Output:
```
[CONTEXT] 🔍 search | 150ms | ~2500 tokens
[CONTEXT] 👁️ view | 45ms | ~1200 tokens | 💾 cache hit
```

## Integration Guide

### In Tools

```typescript
// src/tools/search.ts
import { ContextTelemetry } from '../utils/context-telemetry';

class SearchTool {
  async execute(args: any): Promise<ToolResult> {
    const telemetry = ContextTelemetry.getInstance();
    const startTime = Date.now();

    // ... execute search ...

    telemetry.recordMetric({
      operation: 'search',
      timestamp: startTime,
      duration: Date.now() - startTime,
      filesScanned: allFiles.length,
      filesMatched: matchedFiles.length,
      tokensEstimated: estimateTokens(matchedFiles),
      pattern: args.pattern,
    });

    return result;
  }
}
```

## Metrics Reference

### ContextMetrics Interface

| Field | Type | Description |
|-------|------|-------------|
| operation | 'search' \| 'view' \| 'edit' \| 'create' | Operation type |
| timestamp | number | Unix timestamp (ms) |
| duration | number | Operation duration (ms) |
| filesScanned | number | Files examined (search only) |
| filesMatched | number | Files matched (search only) |
| filesRead | number | Files read (view only) |
| tokensEstimated | number | Estimated tokens consumed |
| pattern | string | Search pattern |
| filePath | string | File path (view/edit) |
| strategy | string | Strategy used ('agentic-search', 'cached', 'subagent') |
| cacheHit | boolean | Whether cache was hit |

### TelemetrySnapshot Interface

| Field | Type | Description |
|-------|------|-------------|
| totalOperations | number | Total recorded operations |
| avgTokensPerOperation | number | Average tokens per operation |
| avgDuration | number | Average duration (ms) |
| cacheHitRate | number | Cache hit rate (0-1) |
| operationBreakdown | Record<string, number> | Count by operation type |
| recentOperations | ContextMetrics[] | Last 10 operations |
