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

import { detectAvailableVRAM, getSystemInfo, type SystemInfo } from '../utils/system-info.js';
import { getModelMaxContext } from './model-configs.js';

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
 * Mistral/Ollama model specifications
 * Source: ROADMAP.md Phase 5
 */
export const MISTRAL_MODELS = {
  mistral: {
    name: 'mistral',
    size: '7B',
    context: 8192,
    vramMin: 4,
    vramRecommended: 6,
    speed: 5, // out of 5
    quality: 3, // out of 5
    description: 'Fast & lean for quick operations',
    useCases: ['Navigation fichiers', 'Petites éditions', 'Réponses rapides'],
  },
  'mistral-small': {
    name: 'mistral-small',
    size: '22B',
    context: 32768,
    vramMin: 12,
    vramRecommended: 16,
    speed: 4,
    quality: 4,
    description: 'Balanced: excellent quality, good speed',
    useCases: ['Refactors multi-fichiers', 'Analyses approfondies', 'Most tasks'],
  },
  mixtral: {
    name: 'mixtral',
    size: '8x7B MoE',
    context: 32768,
    vramMin: 24,
    vramRecommended: 32,
    speed: 3,
    quality: 5,
    description: 'Powerful for complex refactors',
    useCases: ['Refactors complexes', 'Architecture decisions', 'Parallel subagents'],
  },
  'devstral:24b': {
    name: 'devstral:24b',
    size: '24B',
    context: 128000,
    vramMin: 32,
    vramRecommended: 40,
    speed: 2,
    quality: 5, // Best for agentic coding (SWE-Bench 46.8%)
    description: '🏆 RECOMMENDED: Best for agentic coding & codebase exploration',
    useCases: ['Agentic coding', 'Codebase exploration', 'Multi-file editing', 'SWE tasks'],
  },
} as const;

/**
 * Select optimal model based on VRAM and context size
 *
 * Strategy:
 * - Large context (>32K): devstral (if VRAM >= 32GB)
 * - Medium context (16-32K): mixtral (if VRAM >= 16GB), fallback mistral-small
 * - Small context (8-16K): mistral-small
 * - Tiny context (<8K): mistral
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

  if (debug) {
    console.error(
      `[MODEL-SELECTOR] Selecting model for context=${contextSize} tokens, VRAM=${availableVRAM}GB`
    );
  }

  // Large context needed (>32K tokens)
  if (contextSize > 32000) {
    if (availableVRAM >= MISTRAL_MODELS['devstral:24b'].vramMin) {
      return {
        modelName: 'devstral:24b',
        profile: 'deep',
        maxContext: MISTRAL_MODELS['devstral:24b'].context,
        vramRequired: MISTRAL_MODELS['devstral:24b'].vramMin,
        reason: 'Large context window required (>32K tokens)',
        alternatives: availableVRAM >= MISTRAL_MODELS.mixtral.vramMin ? ['mixtral'] : [],
      };
    }

    // Not enough VRAM for large context
    throw new Error(
      `Insufficient VRAM for context size ${contextSize}. ` +
        `Need ${MISTRAL_MODELS['devstral:24b'].vramMin}GB VRAM for devstral:24b, but only ${availableVRAM}GB available. ` +
        `Consider reducing context size or upgrading hardware.`
    );
  }

  // Medium context (16-32K tokens)
  if (contextSize > 16000) {
    if (availableVRAM >= MISTRAL_MODELS.mixtral.vramMin) {
      return {
        modelName: 'mixtral',
        profile: 'powerful',
        maxContext: MISTRAL_MODELS.mixtral.context,
        vramRequired: MISTRAL_MODELS.mixtral.vramMin,
        reason: 'Medium-large context with high quality requirements',
        alternatives: ['mistral-small'],
      };
    }

    // Fallback to mistral-small
    if (availableVRAM >= MISTRAL_MODELS['mistral-small'].vramMin) {
      return {
        modelName: 'mistral-small',
        profile: 'balanced',
        maxContext: MISTRAL_MODELS['mistral-small'].context,
        vramRequired: MISTRAL_MODELS['mistral-small'].vramMin,
        reason: 'Medium context, VRAM limited (fallback from mixtral)',
        alternatives: [],
      };
    }

    // Not enough VRAM
    throw new Error(
      `Insufficient VRAM for context size ${contextSize}. ` +
        `Need at least ${MISTRAL_MODELS['mistral-small'].vramMin}GB VRAM for mistral-small, but only ${availableVRAM}GB available.`
    );
  }

  // Small context (8-16K tokens)
  if (contextSize > 8000) {
    if (availableVRAM >= MISTRAL_MODELS['mistral-small'].vramMin) {
      return {
        modelName: 'mistral-small',
        profile: 'balanced',
        maxContext: MISTRAL_MODELS['mistral-small'].context,
        vramRequired: MISTRAL_MODELS['mistral-small'].vramMin,
        reason: 'Small-medium context, optimal balance',
        alternatives: availableVRAM >= MISTRAL_MODELS.mixtral.vramMin ? ['mixtral'] : ['mistral'],
      };
    }

    // Fallback to mistral 7B
    return {
      modelName: 'mistral',
      profile: 'fast',
      maxContext: MISTRAL_MODELS.mistral.context,
      vramRequired: MISTRAL_MODELS.mistral.vramMin,
      reason: 'Small context, VRAM limited (fallback)',
      alternatives: [],
    };
  }

  // Tiny context (<8K tokens) - default to fast model
  return {
    modelName: 'mistral',
    profile: 'fast',
    maxContext: MISTRAL_MODELS.mistral.context,
    vramRequired: MISTRAL_MODELS.mistral.vramMin,
    reason: 'Small context, optimized for speed',
    alternatives: availableVRAM >= MISTRAL_MODELS['mistral-small'].vramMin ? ['mistral-small'] : [],
  };
}

/**
 * Select model by profile (user preference)
 *
 * Profiles:
 * - fast: mistral (7B)
 * - balanced: devstral:24b (24B, 128K) [DEFAULT] 🏆
 * - powerful: mixtral (8x7B)
 * - deep: devstral:24b (24B, 128K)
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
    fast: 'mistral',
    balanced: 'devstral:24b', // UPDATED: Best for agentic coding (SWE-Bench 46.8%)
    powerful: 'mixtral',
    deep: 'devstral:24b',
  };

  const targetModel = modelMap[profile];
  const model = MISTRAL_MODELS[targetModel];

  // Check VRAM requirements
  if (availableVRAM < model.vramMin) {
    // Fallback to next lower tier
    const fallbackOrder: ModelProfile[] = ['fast', 'balanced', 'powerful', 'deep'];
    const currentIndex = fallbackOrder.indexOf(profile);

    if (currentIndex > 0) {
      // Try next lower tier (go backwards in array)
      for (let i = currentIndex - 1; i >= 0; i--) {
        const fallbackProfile = fallbackOrder[i];
        const fallbackModel = MISTRAL_MODELS[modelMap[fallbackProfile]];
        if (availableVRAM >= fallbackModel.vramMin) {
          return selectModelByProfile(fallbackProfile, availableVRAM);
        }
      }
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
  contextSize: number = 16384
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
