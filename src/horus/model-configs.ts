/**
 * Model configurations for different AI models
 * Includes context window sizes and other model-specific parameters
 */

export interface ModelConfig {
  /** Maximum context window in tokens */
  maxContextTokens: number;
  /** Model name or pattern */
  modelName: string;
  /** Description */
  description?: string;
}

/**
 * Model configurations based on official documentation and benchmarks
 * Source: MODELE_CODING_BENCHMARKS.md and official model documentation
 */
export const MODEL_CONFIGS: ModelConfig[] = [
  // Mistral 7B Instruct v0.3 AWQ - Best for 16GB VRAM with tool calling
  {
    modelName: "solidrust/Mistral-7B-Instruct-v0.3-AWQ",
    maxContextTokens: 16384, // 16K context (validated on 16GB VRAM)
    description: "AWQ 4-bit quantized, ~4GB VRAM, native tool calling",
  },

  // Devstral Small 2507 AWQ - Needs 24GB+ VRAM
  {
    modelName: "cpatonn/Devstral-Small-2507-AWQ-4bit",
    maxContextTokens: 32768, // 32K context
    description: "AWQ 4-bit quantized, ~13GB VRAM (needs 24GB+ GPU)",
  },

  // Devstral Small 2 - Full precision (needs 28GB+ VRAM)
  {
    modelName: "mistralai/Devstral-Small-2-24B-Instruct-2512",
    maxContextTokens: 384000, // 384K context
    description: "Full precision - Best tool use (SWE-Bench 65.8%)",
  },

  // Mistral 7B - Lightweight alternative
  {
    modelName: "mistralai/Mistral-7B-Instruct-v0.3",
    maxContextTokens: 32768, // 32K context
    description: "Lightweight 7B model with tool calling",
  },

  // Qwen 2.5 Coder 7B - Code-focused
  {
    modelName: "Qwen/Qwen2.5-Coder-7B-Instruct",
    maxContextTokens: 131072, // 128K context
    description: "Code-focused 7B model",
  },

  // Legacy Devstral patterns
  {
    modelName: "devstral",
    maxContextTokens: 128000, // 128K context
    description: "Best open source model for coding agents",
  },

  // DeepSeek Coder V2 - Competitive with GPT-4 Turbo
  {
    modelName: "deepseek-coder-v2",
    maxContextTokens: 163840, // 160K context (MoE architecture)
    description: "Performance comparable to GPT-4 Turbo",
  },

  // Qwen 2.5 Coder - Latest code-specific Qwen
  {
    modelName: "qwen2.5-coder",
    maxContextTokens: 131072, // 128K context
    description: "Latest code-specific model from Qwen",
  },

  // DeepSeek Coder (classic) - Code specialist
  {
    modelName: "deepseek-coder",
    maxContextTokens: 16384, // 16K context (original)
    description: "Classic DeepSeek Coder trained on 2T tokens",
  },

  // Codestral - Mistral AI code model
  {
    modelName: "codestral",
    maxContextTokens: 32768, // 32K context
    description: "Mistral AI's first code model",
  },

  // Qwen 3 Coder - Alibaba's latest agentic model
  {
    modelName: "qwen3-coder",
    maxContextTokens: 131072, // 128K context (long context support)
    description: "Alibaba's performant long context model",
  },

  // GPT-OSS - OpenAI's open model
  {
    modelName: "gpt-oss",
    maxContextTokens: 131072, // 128K context
    description: "OpenAI's open model with tool calling",
  },

  // Qwen2.5-Coder Instruct variants
  {
    modelName: "qwen2.5-coder:instruct",
    maxContextTokens: 131072, // 128K context
    description: "Qwen 2.5 Coder Instruct variant",
  },

  // Generic Qwen models
  {
    modelName: "qwen",
    maxContextTokens: 32768, // 32K context (default for Qwen family)
    description: "Qwen family models",
  },

  // Llama models
  {
    modelName: "llama",
    maxContextTokens: 8192, // 8K context (default for Llama 2)
    description: "Llama family models",
  },

  // CodeLlama
  {
    modelName: "codellama",
    maxContextTokens: 16384, // 16K context
    description: "Meta's CodeLlama models",
  },
];

/**
 * Default context size for unknown models
 */
export const DEFAULT_CONTEXT_TOKENS = 32768; // 32K (safe default)

/**
 * Get the maximum context tokens for a given model
 * @param modelName - The model identifier (e.g., "devstral:24b", "deepseek-coder-v2:16b")
 * @returns Maximum context window size in tokens
 */
export function getModelMaxContext(modelName: string): number {
  if (!modelName) {
    return DEFAULT_CONTEXT_TOKENS;
  }

  // Normalize model name (lowercase, remove version suffixes)
  const normalizedName = modelName.toLowerCase();

  // Find matching configuration (check if model name starts with config name)
  for (const config of MODEL_CONFIGS) {
    if (normalizedName.startsWith(config.modelName.toLowerCase())) {
      return config.maxContextTokens;
    }
  }

  // If no match found, return default
  console.warn(
    `Unknown model "${modelName}", using default context size of ${DEFAULT_CONTEXT_TOKENS} tokens. ` +
    `Consider adding this model to model-configs.ts for optimal performance.`
  );
  return DEFAULT_CONTEXT_TOKENS;
}

/**
 * Get model configuration details
 * @param modelName - The model identifier
 * @returns Model configuration or undefined if not found
 */
export function getModelConfig(modelName: string): ModelConfig | undefined {
  if (!modelName) {
    return undefined;
  }

  const normalizedName = modelName.toLowerCase();

  for (const config of MODEL_CONFIGS) {
    if (normalizedName.startsWith(config.modelName.toLowerCase())) {
      return config;
    }
  }

  return undefined;
}

/**
 * List all supported models with their context sizes
 * @returns Array of model configurations
 */
export function listSupportedModels(): ModelConfig[] {
  return MODEL_CONFIGS;
}
