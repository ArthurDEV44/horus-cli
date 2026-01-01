/**
 * Model Selector
 *
 * Adaptive model selection based on:
 * - Available VRAM
 * - Context size requirements
 * - Task complexity
 *
 * Implements the strategy defined in ROADMAP.md Phase 5.
 *
 * @module model-selector
 */

import { detectAvailableVRAM } from '../utils/system-info.js';

/**
 * Model profile for different use cases
 */
export type ModelProfile = 'fast' | 'balanced' | 'powerful' | 'deep';

/**
 * Model recommendation with metadata
 */
export interface ModelRecommendation {
  modelName: string;
  profile: ModelProfile;
  maxContext: number;
  vramRequired: number; // GB
  reason: string;
  alternatives?: string[];
}

/**
 * Mistral/vLLM model specifications
 * Models served via vLLM with --tool-call-parser mistral
 * Optimized for GPUs with 16GB VRAM (RTX 4070/4080/3090)
 */
export const MISTRAL_MODELS = {
  'solidrust/Mistral-7B-Instruct-v0.3-AWQ': {
    name: 'solidrust/Mistral-7B-Instruct-v0.3-AWQ',
    size: '7B AWQ 4-bit',
    context: 16384, // 16K context (validated on 16GB VRAM)
    vramMin: 4,
    vramRecommended: 8,
    speed: 5,
    quality: 4,
    description: '🏆 RECOMMENDED: AWQ 4-bit for 16GB VRAM with tool calling',
    useCases: ['Agentic coding', 'Tool calling', 'Fast responses'],
  },
  'cpatonn/Devstral-Small-2507-AWQ-4bit': {
    name: 'cpatonn/Devstral-Small-2507-AWQ-4bit',
    size: '24B AWQ 4-bit',
    context: 32768, // 32K context
    vramMin: 13,
    vramRecommended: 24,
    speed: 4,
    quality: 5,
    description: 'Devstral AWQ 4-bit (needs 24GB+ VRAM)',
    useCases: ['Agentic coding', 'Tool calling', 'Codebase exploration'],
  },
  'Qwen/Qwen2.5-Coder-7B-Instruct': {
    name: 'Qwen/Qwen2.5-Coder-7B-Instruct',
    size: '7B',
    context: 131072, // 128K context
    vramMin: 8,
    vramRecommended: 14,
    speed: 5,
    quality: 4,
    description: 'Code-focused 7B model',
    useCases: ['Code generation', 'Refactoring', 'Analysis'],
  },
  'mistralai/Devstral-Small-2-24B-Instruct-2512': {
    name: 'mistralai/Devstral-Small-2-24B-Instruct-2512',
    size: '24B',
    context: 384000, // 384K context
    vramMin: 28,
    vramRecommended: 48,
    speed: 3,
    quality: 5, // SWE-Bench 65.8%
    description: 'Full precision (needs 28GB+ VRAM)',
    useCases: ['Large context', 'Complex tasks', 'Production'],
  },
} as const;

/**
 * Select optimal model based on VRAM and context size
 *
 * With vLLM, model selection is simplified - Devstral Small 2 handles most cases
 * with its 384K context window and excellent tool calling support.
 *
 * @param contextSize - Required context size in tokens
 * @param availableVRAM - Available VRAM in GB
 * @returns ModelRecommendation
 */
export function selectOptimalModel(
  contextSize: number,
  availableVRAM: number
): ModelRecommendation {
  const debug = process.env.HORUS_CONTEXT_DEBUG === 'true';

  // Default: Mistral 7B AWQ 4-bit for 16GB VRAM (recommended)
  const defaultModel = 'solidrust/Mistral-7B-Instruct-v0.3-AWQ';
  const defaultConfig = MISTRAL_MODELS[defaultModel];

  if (debug) {
    console.error(
      `[MODEL-SELECTOR] Selecting model for context=${contextSize} tokens, VRAM=${availableVRAM}GB`
    );
  }

  // Mistral 7B AWQ fits in 4-8GB VRAM with 16K context
  if (availableVRAM >= defaultConfig.vramMin) {
    return {
      modelName: defaultModel,
      profile: 'balanced',
      maxContext: defaultConfig.context,
      vramRequired: defaultConfig.vramMin,
      reason: 'Mistral 7B AWQ - optimal for 16GB VRAM with tool calling',
      alternatives: Object.keys(MISTRAL_MODELS).filter(m => m !== defaultModel),
    };
  }

  // Not enough VRAM (need at least 4GB)
  throw new Error(
    `Insufficient VRAM. Need at least ${defaultConfig.vramMin}GB VRAM, but only ${availableVRAM}GB available.`
  );
}

/**
 * Select model by profile (user preference)
 *
 * Profiles (all map to vLLM-served models):
 * - fast: Mistral 7B AWQ [DEFAULT] (best for 16GB VRAM with tool calling)
 * - balanced: Mistral 7B AWQ (same as fast, best balance)
 * - powerful: Devstral Small 2507 AWQ (needs 24GB+ VRAM)
 * - deep: Devstral Small 2 full precision (needs 28GB+ VRAM)
 *
 * @param profile - User-selected profile
 * @param availableVRAM - Available VRAM in GB
 * @returns ModelRecommendation
 */
export function selectModelByProfile(
  profile: ModelProfile,
  availableVRAM: number
): ModelRecommendation {
  const modelMap: Record<ModelProfile, keyof typeof MISTRAL_MODELS> = {
    fast: 'solidrust/Mistral-7B-Instruct-v0.3-AWQ',
    balanced: 'solidrust/Mistral-7B-Instruct-v0.3-AWQ',
    powerful: 'cpatonn/Devstral-Small-2507-AWQ-4bit',
    deep: 'mistralai/Devstral-Small-2-24B-Instruct-2512',
  };

  const targetModel = modelMap[profile];
  const model = MISTRAL_MODELS[targetModel];

  // Check VRAM requirements
  if (availableVRAM < model.vramMin) {
    // Fallback to Mistral 7B AWQ (fits any GPU with 4GB+ VRAM)
    const fallbackModel = 'solidrust/Mistral-7B-Instruct-v0.3-AWQ';
    const fallbackConfig = MISTRAL_MODELS[fallbackModel];

    if (availableVRAM >= fallbackConfig.vramMin) {
      return {
        modelName: fallbackConfig.name,
        profile: 'fast',
        maxContext: fallbackConfig.context,
        vramRequired: fallbackConfig.vramMin,
        reason: `Fallback from ${model.name} (${profile}) due to VRAM limit`,
        alternatives: [],
      };
    }

    throw new Error(
      `Insufficient VRAM for profile "${profile}". ` +
        `Need ${model.vramMin}GB VRAM for ${model.name}, but only ${availableVRAM}GB available.`
    );
  }

  return {
    modelName: model.name,
    profile,
    maxContext: model.context,
    vramRequired: model.vramMin,
    reason: `User-selected profile: ${profile}`,
    alternatives: [],
  };
}

/**
 * Get recommended model based on system info (async)
 *
 * This is the main entry point for automatic model selection.
 *
 * @param contextSize - Optional context size hint (default: 16K)
 * @returns ModelRecommendation
 */
export async function getRecommendedModel(
  contextSize = 16384
): Promise<ModelRecommendation> {
  const vram = await detectAvailableVRAM();
  return selectOptimalModel(contextSize, vram);
}

/**
 * Get all model specifications
 * @returns Record of model specs
 */
export function getAllModelSpecs() {
  return MISTRAL_MODELS;
}

/**
 * Format model recommendation for display
 *
 * @param recommendation - ModelRecommendation
 * @returns Formatted string
 */
export function formatRecommendation(recommendation: ModelRecommendation): string {
  const model = MISTRAL_MODELS[recommendation.modelName as keyof typeof MISTRAL_MODELS];

  if (!model) {
    return `Model: ${recommendation.modelName}\nReason: ${recommendation.reason}`;
  }

  const lines = [
    `Model: ${model.name} (${model.size})`,
    `Profile: ${recommendation.profile}`,
    `Context Window: ${recommendation.maxContext.toLocaleString()} tokens`,
    `VRAM Required: ${recommendation.vramRequired} GB`,
    `Speed: ${'⚡'.repeat(model.speed)} (${model.speed}/5)`,
    `Quality: ${'⭐'.repeat(model.quality)} (${model.quality}/5)`,
    `Reason: ${recommendation.reason}`,
  ];

  if (model.useCases.length > 0) {
    lines.push(`Use Cases: ${model.useCases.join(', ')}`);
  }

  if (recommendation.alternatives && recommendation.alternatives.length > 0) {
    lines.push(`Alternatives: ${recommendation.alternatives.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Compare two models
 *
 * @param modelA - First model name
 * @param modelB - Second model name
 * @returns Comparison string
 */
export function compareModels(modelA: string, modelB: string): string {
  const specA = MISTRAL_MODELS[modelA as keyof typeof MISTRAL_MODELS];
  const specB = MISTRAL_MODELS[modelB as keyof typeof MISTRAL_MODELS];

  if (!specA || !specB) {
    return 'One or both models not found in Mistral model specs.';
  }

  const lines = [
    `Comparing ${specA.name} vs ${specB.name}`,
    '',
    `Size: ${specA.size} vs ${specB.size}`,
    `Context: ${specA.context.toLocaleString()} vs ${specB.context.toLocaleString()} tokens`,
    `VRAM: ${specA.vramMin}GB vs ${specB.vramMin}GB`,
    `Speed: ${specA.speed}/5 vs ${specB.speed}/5`,
    `Quality: ${specA.quality}/5 vs ${specB.quality}/5`,
  ];

  return lines.join('\n');
}
