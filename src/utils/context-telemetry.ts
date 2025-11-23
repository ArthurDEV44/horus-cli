/**
 * Context Telemetry System
 * Tracks context operations for performance monitoring and optimization
 */

export interface ContextMetrics {
  // Operation identification
  operation: 'search' | 'view' | 'edit' | 'create' | 'verification';
  timestamp: number;

  // Performance metrics
  duration: number;              // milliseconds
  filesScanned?: number;         // for search operations
  filesMatched?: number;         // for search operations
  filesRead?: number;            // for view operations
  tokensEstimated: number;       // estimated tokens consumed

  // Context information
  pattern?: string;              // search pattern
  filePath?: string;             // file path for view/edit
  strategy?: string;             // 'agentic-search' | 'cached' | 'subagent'

  // Cache metrics
  cacheHit?: boolean;
  cacheHitRate?: number;
}

export interface TelemetrySnapshot {
  totalOperations: number;
  avgTokensPerOperation: number;
  avgDuration: number;
  cacheHitRate: number;
  operationBreakdown: Record<string, number>;
  recentOperations: ContextMetrics[];
}

/**
 * Singleton telemetry collector
 */
export class ContextTelemetry {
  private static instance: ContextTelemetry;
  private metrics: ContextMetrics[] = [];
  private maxHistorySize = 1000; // Keep last 1000 operations

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): ContextTelemetry {
    if (!ContextTelemetry.instance) {
      ContextTelemetry.instance = new ContextTelemetry();
    }
    return ContextTelemetry.instance;
  }

  /**
   * Record a context operation metric
   */
  recordMetric(metric: ContextMetrics): void {
    this.metrics.push({
      ...metric,
      timestamp: metric.timestamp || Date.now(),
    });

    // Trim history if too large
    if (this.metrics.length > this.maxHistorySize) {
      this.metrics = this.metrics.slice(-this.maxHistorySize);
    }

    // Emit to debug console if enabled
    if (process.env.HORUS_CONTEXT_DEBUG === 'true') {
      this.logMetric(metric);
    }
  }

  /**
   * Get snapshot of current telemetry state
   */
  getSnapshot(lastN?: number): TelemetrySnapshot {
    const recentMetrics = lastN
      ? this.metrics.slice(-lastN)
      : this.metrics;

    if (recentMetrics.length === 0) {
      return {
        totalOperations: 0,
        avgTokensPerOperation: 0,
        avgDuration: 0,
        cacheHitRate: 0,
        operationBreakdown: {},
        recentOperations: [],
      };
    }

    const totalTokens = recentMetrics.reduce((sum, m) => sum + m.tokensEstimated, 0);
    const totalDuration = recentMetrics.reduce((sum, m) => sum + m.duration, 0);
    const cacheHits = recentMetrics.filter(m => m.cacheHit === true).length;
    const cacheableOps = recentMetrics.filter(m => m.cacheHit !== undefined).length;

    const operationBreakdown = recentMetrics.reduce((acc, m) => {
      acc[m.operation] = (acc[m.operation] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalOperations: recentMetrics.length,
      avgTokensPerOperation: Math.round(totalTokens / recentMetrics.length),
      avgDuration: Math.round(totalDuration / recentMetrics.length),
      cacheHitRate: cacheableOps > 0 ? cacheHits / cacheableOps : 0,
      operationBreakdown,
      recentOperations: recentMetrics.slice(-10), // Last 10
    };
  }

  /**
   * Clear all metrics (useful for testing)
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Export metrics to JSON for benchmarking
   */
  exportToJSON(filepath?: string): string {
    const data = JSON.stringify({
      exportDate: new Date().toISOString(),
      snapshot: this.getSnapshot(),
      allMetrics: this.metrics,
    }, null, 2);

    if (filepath) {
      const fs = require('fs');
      const path = require('path');
      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filepath, data, 'utf-8');
    }

    return data;
  }

  private logMetric(metric: ContextMetrics): void {
    const emoji = {
      search: '🔍',
      view: '👁️',
      edit: '✏️',
      create: '📝',
    }[metric.operation] || '•';

    console.error(
      `[CONTEXT] ${emoji} ${metric.operation} | ` +
      `${metric.duration}ms | ` +
      `~${metric.tokensEstimated} tokens` +
      (metric.cacheHit ? ' | 💾 cache hit' : '')
    );
  }
}
