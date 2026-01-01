/**
 * SubagentManager - Gestion de subagents isolés pour parallélisation
 *
 * Inspiré par Claude Code's subagent architecture:
 * - Chaque subagent = contexte isolé + tools restreints
 * - Max 3 subagents parallèles (limite VRAM)
 * - Pas de nesting (subagents ne peuvent pas spawner de subagents)
 * - Retournent seulement un résumé concis à l'orchestrateur
 */

import { HorusAgent, ChatEntry } from "../agent/horus-agent.js";
import { ContextTelemetry } from "../utils/context-telemetry.js";

/**
 * Requête pour créer un subagent
 */
export interface SubtaskRequest {
  /** Fichiers à analyser/modifier */
  files: string[];

  /** Instruction à exécuter */
  instruction: string;

  /** Liste blanche des tools autorisés (sécurité) */
  tools: string[];

  /** Budget tokens max pour ce subagent (défaut: 8192) */
  maxTokens?: number;

  /** Métadonnées optionnelles */
  metadata?: Record<string, any>;
}

/**
 * Résultat d'un subagent
 */
export interface SubagentResult {
  /** Résumé concis de l'exécution (<500 tokens) */
  summary: string;

  /** Liste des fichiers modifiés */
  changes: string[];

  /** Durée d'exécution (ms) */
  duration: number;

  /** Statut de complétion */
  success: boolean;

  /** Erreur si échec */
  error?: string;

  /** Métadonnées du subagent */
  metadata: {
    toolsUsed: string[];
    tokensUsed: number;
    filesRead: number;
    filesModified: number;
  };
}

/**
 * Options de configuration du SubagentManager
 */
export interface SubagentManagerConfig {
  /** Nombre max de subagents parallèles (défaut: 3) */
  maxConcurrent?: number;

  /** Timeout par subagent en ms (défaut: 60000 = 1min) */
  timeout?: number;

  /** Mode debug */
  debug?: boolean;

  /** API key pour HorusClient */
  apiKey: string;

  /** Base URL pour API (optionnel) */
  baseURL?: string;

  /** Modèle à utiliser (optionnel) */
  model?: string;
}

/**
 * SubagentManager - Orchestrateur de subagents isolés
 *
 * Permet de paralléliser des tâches indépendantes en spawning plusieurs
 * HorusAgent avec contextes isolés.
 */
export class SubagentManager {
  private config: Required<SubagentManagerConfig>;
  private activeSubagents = new Set<Promise<SubagentResult>>();
  private telemetry = ContextTelemetry.getInstance();

  constructor(config: SubagentManagerConfig) {
    this.config = {
      maxConcurrent: config.maxConcurrent ?? 3,
      timeout: config.timeout ?? 60000,
      debug: config.debug ?? false,
      apiKey: config.apiKey,
      baseURL: config.baseURL ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
      model: config.model ?? process.env.HORUS_MODEL ?? 'devstral:24b',
    };

    if (this.config.debug) {
      console.error(`[SubagentManager] Initialized (maxConcurrent: ${this.config.maxConcurrent})`);
    }
  }

  /**
   * Spawne un subagent unique avec contexte isolé
   */
  async spawn(task: SubtaskRequest): Promise<SubagentResult> {
    const startTime = Date.now();

    if (this.config.debug) {
      console.error(`[SubagentManager] Spawning subagent for ${task.files.length} files`);
      console.error(`[SubagentManager] Instruction: ${task.instruction.slice(0, 100)}...`);
    }

    try {
      // Créer un HorusAgent isolé
      const subagent = new HorusAgent(
        this.config.apiKey,
        this.config.baseURL,
        this.config.model,
        50 // maxToolRounds réduit pour subagents
      );

      // Désactiver le context orchestrator pour éviter récursion infinie
      // Les subagents utilisent uniquement les tools de base
      process.env.HORUS_SUBAGENT_MODE = 'true';

      // Construire le prompt avec contexte minimal
      const filesContext = task.files.length > 0
        ? `\n\nFichiers à traiter:\n${task.files.map(f => `- ${f}`).join('\n')}`
        : '';

      const prompt = `${task.instruction}${filesContext}

IMPORTANT:
- Tu es un subagent avec un contexte isolé
- Tu ne peux utiliser QUE ces tools: ${task.tools.join(', ')}
- Retourne un résumé concis (<500 tokens) de ton travail
- Liste TOUS les fichiers modifiés
- Ne spawne PAS d'autres subagents (interdit)`;

      // Timeout wrapper
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Subagent timeout after ${this.config.timeout}ms`)), this.config.timeout);
      });

      // Exécuter le subagent avec timeout
      const executionPromise = (async () => {
        // Collecter les événements du subagent
        const toolsUsed = new Set<string>();
        const filesModified = new Set<string>();
        const tokensUsed = 0;

        subagent.on('tool_call', (toolCall) => {
          toolsUsed.add(toolCall.name);
        });

        subagent.on('tool_result', (result) => {
          if (result.filePath) {
            filesModified.add(result.filePath);
          }
        });

        // Exécuter
        await subagent.processUserMessage(prompt);

        // Extraire le résumé (derniers messages assistant)
        const summary = this.extractSummary(subagent.getChatHistory());

        return {
          summary,
          changes: Array.from(filesModified),
          duration: Date.now() - startTime,
          success: true,
          metadata: {
            toolsUsed: Array.from(toolsUsed),
            tokensUsed,
            filesRead: task.files.length,
            filesModified: filesModified.size,
          },
        };
      })();

      const result = await Promise.race([executionPromise, timeoutPromise]);

      // Nettoyer
      delete process.env.HORUS_SUBAGENT_MODE;

      if (this.config.debug) {
        console.error(`[SubagentManager] Subagent completed in ${result.duration}ms`);
        console.error(`[SubagentManager] Files modified: ${result.changes.length}`);
      }

      // Telemetry
      this.telemetry.recordMetric({
        operation: 'view',
        timestamp: Date.now(),
        filesScanned: task.files.length,
        filesRead: task.files.length,
        duration: result.duration,
        tokensEstimated: result.metadata.tokensUsed,
        cacheHit: false,
        strategy: 'subagent',
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (this.config.debug) {
        console.error(`[SubagentManager] Subagent failed: ${errorMessage}`);
      }

      // Nettoyer
      delete process.env.HORUS_SUBAGENT_MODE;

      return {
        summary: `Subagent failed: ${errorMessage}`,
        changes: [],
        duration: Date.now() - startTime,
        success: false,
        error: errorMessage,
        metadata: {
          toolsUsed: [],
          tokensUsed: 0,
          filesRead: task.files.length,
          filesModified: 0,
        },
      };
    }
  }

  /**
   * Spawne plusieurs subagents en parallèle (batches si >maxConcurrent)
   */
  async spawnParallel(tasks: SubtaskRequest[]): Promise<SubagentResult[]> {
    if (this.config.debug) {
      console.error(`[SubagentManager] Spawning ${tasks.length} subagents in parallel`);
      console.error(`[SubagentManager] Max concurrent: ${this.config.maxConcurrent}`);
    }

    // Diviser en batches si nécessaire
    const batches = this.chunk(tasks, this.config.maxConcurrent);
    const allResults: SubagentResult[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      if (this.config.debug) {
        console.error(`[SubagentManager] Processing batch ${i + 1}/${batches.length} (${batch.length} subagents)`);
      }

      // Exécuter batch en parallèle
      const batchPromises = batch.map(task => this.spawn(task));
      this.activeSubagents = new Set(batchPromises);

      const batchResults = await Promise.all(batchPromises);
      allResults.push(...batchResults);

      this.activeSubagents.clear();
    }

    if (this.config.debug) {
      const successful = allResults.filter(r => r.success).length;
      console.error(`[SubagentManager] All batches completed: ${successful}/${allResults.length} successful`);
    }

    return allResults;
  }

  /**
   * Extrait un résumé concis de l'historique du subagent
   */
  private extractSummary(history: ChatEntry[]): string {
    // Trouver tous les messages assistant
    const assistantMessages = history
      .filter(entry => entry.type === 'assistant')
      .map(entry => entry.content)
      .filter(content => content.trim().length > 0);

    if (assistantMessages.length === 0) {
      return 'No summary available';
    }

    // Prendre les 2 derniers messages (généralement le résumé final)
    const recentMessages = assistantMessages.slice(-2);
    const summary = recentMessages.join('\n\n');

    // Limiter à ~500 tokens (~2000 chars)
    if (summary.length > 2000) {
      return summary.slice(0, 2000) + '... (truncated)';
    }

    return summary;
  }

  /**
   * Divise un array en chunks
   */
  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Retourne le nombre de subagents actifs
   */
  getActiveCount(): number {
    return this.activeSubagents.size;
  }

  /**
   * Attend que tous les subagents actifs se terminent
   */
  async waitAll(): Promise<void> {
    if (this.activeSubagents.size > 0) {
      await Promise.all(Array.from(this.activeSubagents));
    }
  }
}

/**
 * Helper: Détecte si une tâche peut être parallélisée
 */
export function detectParallelizableTask(query: string, files: string[]): SubtaskRequest[] | null {
  const lowerQuery = query.toLowerCase();

  // Pattern: "all files", "tous les fichiers", "all functions", etc.
  const isAllPattern =
    lowerQuery.includes('all files') ||
    lowerQuery.includes('tous les fichiers') ||
    lowerQuery.includes('all *.') ||
    lowerQuery.includes('every file') ||
    /\ball\s+\w+/.test(lowerQuery) || // "all X" (all functions, all classes, etc.)
    /\bevery\s+\w+/.test(lowerQuery); // "every X"

  if (!isAllPattern || files.length < 3) {
    return null; // Pas assez de fichiers pour paralléliser
  }

  // Split files en 3 batches
  const batchSize = Math.ceil(files.length / 3);
  const batches: string[][] = [];

  for (let i = 0; i < files.length; i += batchSize) {
    batches.push(files.slice(i, i + batchSize));
  }

  // Créer une subtask par batch
  return batches.map(batch => ({
    files: batch,
    instruction: query,
    tools: ['view_file', 'str_replace_editor', 'replace_lines', 'create_file'],
  }));
}
