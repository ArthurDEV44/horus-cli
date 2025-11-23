import { ContextOrchestrator } from "../../context/orchestrator.js";
import type { ContextRequest, ContextBundle } from "../../types/context.js";

/**
 * GatherPhase - Handles the GATHER phase of the gather-act-verify loop
 *
 * Responsibilities:
 * - Orchestrate context gathering
 * - Handle errors gracefully
 * - Provide debug logging
 */
export class GatherPhase {
  constructor(private orchestrator: ContextOrchestrator) {}

  /**
   * Gather relevant context for the user's request
   * Returns null if gathering fails (non-blocking)
   */
  async gather(
    request: ContextRequest,
    debug: boolean
  ): Promise<ContextBundle | null> {
    try {
      if (debug) {
        console.error("[GatherPhase] Gathering context with request:", {
          intent: request.intent,
          budget: request.budget,
        });
      }

      const contextBundle = await this.orchestrator.gather(request);

      if (debug && contextBundle.sources.length > 0) {
        console.error("[GatherPhase] Context gathered:", {
          sources: contextBundle.sources.length,
          tokens: contextBundle.metadata.tokensUsed,
          cacheHits: contextBundle.metadata.cacheHits,
          strategy: contextBundle.metadata.strategy,
        });
      }

      return contextBundle;
    } catch (error) {
      console.error("[GatherPhase] Context gathering failed:", error);
      // Return null to continue without context optimization
      return null;
    }
  }

  /**
   * Get cache statistics from the orchestrator
   */
  getCacheStats() {
    return this.orchestrator.getCacheStats();
  }

  /**
   * Clear the context cache
   */
  clearCache() {
    this.orchestrator.clearCache();
  }
}
