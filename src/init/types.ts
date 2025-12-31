/**
 * Types for the /init command - Version simplifiée
 * Focus sur les données essentielles pour générer un HORUS.md concis
 */

// ============================================================================
// Configuration
// ============================================================================

export interface InitConfig {
  /** Target file to generate (default: HORUS.md) */
  targetFile: string;
  /** Force overwrite if file exists */
  force: boolean;
  /** Include git metadata */
  includeGit: boolean;
  /** Verbose output */
  verbose: boolean;
  /** Working directory */
  cwd: string;
}

// ============================================================================
// Scan Result - Simplifié
// ============================================================================

export interface ScanResult {
  /** Project name from package.json */
  projectName: string;
  /** Project version */
  version: string;
  /** npm/bun scripts disponibles */
  scripts: {
    install?: string;
    dev?: string;
    build?: string;
    test?: string;
    lint?: string;
  };
  /** Est-ce un projet TypeScript? */
  hasTypeScript: boolean;
  /** ESM ou CommonJS */
  isESM: boolean;
  /** Target ES (ES2022, etc.) */
  esTarget?: string;
  /** Strict mode enabled */
  strictMode: boolean;
  /** Git branch courante */
  gitBranch?: string;
  /** Remote URL du repo */
  gitRemote?: string;
  /** Contenu existant de HORUS.md (null si n'existe pas) */
  existingHorusMd: string | null;
  /** Dépendances clés détectées */
  keyDependencies: string[];
}

// ============================================================================
// Init Result
// ============================================================================

export interface InitResult {
  /** Fichier créé ou mis à jour */
  created: boolean;
  /** Chemin du fichier */
  filePath: string;
  /** Nombre de lignes */
  linesWritten: number;
  /** Message de succès */
  message: string;
}

// ============================================================================
// Package.json simplifié
// ============================================================================

export interface PackageJson {
  name?: string;
  version?: string;
  type?: "module" | "commonjs";
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

// ============================================================================
// tsconfig.json simplifié
// ============================================================================

export interface TsConfig {
  compilerOptions?: {
    module?: string;
    target?: string;
    strict?: boolean;
    moduleResolution?: string;
  };
}
