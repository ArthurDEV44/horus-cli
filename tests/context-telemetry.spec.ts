import { describe, it, expect, beforeEach } from 'bun:test';
import { ContextTelemetry, ContextMetrics } from '../src/utils/context-telemetry';

describe('ContextTelemetry', () => {
  let telemetry: ContextTelemetry;

  beforeEach(() => {
    telemetry = ContextTelemetry.getInstance();
    telemetry.clear(); // Clean slate for each test
  });

  it('should be a singleton', () => {
    const instance1 = ContextTelemetry.getInstance();
    const instance2 = ContextTelemetry.getInstance();
    expect(instance1).toBe(instance2);
  });

  it('should record metrics', () => {
    const metric: ContextMetrics = {
      operation: 'search',
      timestamp: Date.now(),
      duration: 150,
      filesScanned: 42,
      filesMatched: 5,
      tokensEstimated: 2500,
      pattern: '*.ts',
    };

    telemetry.recordMetric(metric);
    const snapshot = telemetry.getSnapshot();

    expect(snapshot.totalOperations).toBe(1);
    expect(snapshot.avgTokensPerOperation).toBe(2500);
    expect(snapshot.avgDuration).toBe(150);
  });

  it('should calculate cache hit rate correctly', () => {
    telemetry.recordMetric({
      operation: 'view',
      timestamp: Date.now(),
      duration: 10,
      tokensEstimated: 500,
      cacheHit: true,
    });

    telemetry.recordMetric({
      operation: 'view',
      timestamp: Date.now(),
      duration: 100,
      tokensEstimated: 500,
      cacheHit: false,
    });

    telemetry.recordMetric({
      operation: 'view',
      timestamp: Date.now(),
      duration: 10,
      tokensEstimated: 500,
      cacheHit: true,
    });

    const snapshot = telemetry.getSnapshot();
    expect(snapshot.cacheHitRate).toBeCloseTo(0.666, 2); // 2/3
  });

  it('should track operation breakdown', () => {
    telemetry.recordMetric({ operation: 'search', timestamp: Date.now(), duration: 100, tokensEstimated: 100 });
    telemetry.recordMetric({ operation: 'search', timestamp: Date.now(), duration: 100, tokensEstimated: 100 });
    telemetry.recordMetric({ operation: 'view', timestamp: Date.now(), duration: 100, tokensEstimated: 100 });
    telemetry.recordMetric({ operation: 'edit', timestamp: Date.now(), duration: 100, tokensEstimated: 100 });

    const snapshot = telemetry.getSnapshot();
    expect(snapshot.operationBreakdown).toEqual({
      search: 2,
      view: 1,
      edit: 1,
    });
  });

  it('should limit history size', () => {
    // Record 1100 metrics (max is 1000)
    for (let i = 0; i < 1100; i++) {
      telemetry.recordMetric({
        operation: 'search',
        timestamp: Date.now(),
        duration: 100,
        tokensEstimated: 100,
      });
    }

    const snapshot = telemetry.getSnapshot();
    expect(snapshot.totalOperations).toBe(1000);
  });

  it('should get last N operations', () => {
    for (let i = 0; i < 50; i++) {
      telemetry.recordMetric({
        operation: 'search',
        timestamp: Date.now(),
        duration: i,
        tokensEstimated: i * 100,
      });
    }

    const snapshot = telemetry.getSnapshot(10);
    expect(snapshot.totalOperations).toBe(10);
    expect(snapshot.recentOperations.length).toBeLessThanOrEqual(10);
  });

  it('should export to JSON', () => {
    telemetry.recordMetric({
      operation: 'search',
      timestamp: Date.now(),
      duration: 150,
      tokensEstimated: 2500,
    });

    const json = telemetry.exportToJSON();
    const parsed = JSON.parse(json);

    expect(parsed.snapshot.totalOperations).toBe(1);
    expect(parsed.allMetrics).toHaveLength(1);
    expect(parsed.exportDate).toBeDefined();
  });

  it('should handle empty metrics gracefully', () => {
    const snapshot = telemetry.getSnapshot();

    expect(snapshot.totalOperations).toBe(0);
    expect(snapshot.avgTokensPerOperation).toBe(0);
    expect(snapshot.avgDuration).toBe(0);
    expect(snapshot.cacheHitRate).toBe(0);
  });
});
