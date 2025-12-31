/**
 * Scanner module for /init command - Version simplifiée
 * Scans package.json, tsconfig.json, git, and existing HORUS.md
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import type { ScanResult, PackageJson, TsConfig, InitConfig } from "./types.js";

// ============================================================================
// Package.json Scanner
// ============================================================================

/**
 * Scans and parses package.json
 */
export function scanPackageJson(cwd: string): {
  name: string;
  version: string;
  scripts: ScanResult["scripts"];
  isESM: boolean;
  keyDependencies: string[];
} {
  const pkgPath = join(cwd, "package.json");

  if (!existsSync(pkgPath)) {
    return {
      name: "unknown",
      version: "0.0.0",
      scripts: {},
      isESM: false,
      keyDependencies: [],
    };
  }

  try {
    const content = readFileSync(pkgPath, "utf-8");
    const pkg: PackageJson = JSON.parse(content);

    // Extraire les scripts pertinents
    const scripts: ScanResult["scripts"] = {};
    if (pkg.scripts) {
      if (pkg.scripts.dev) scripts.dev = `${getPackageManager(cwd)} run dev`;
      if (pkg.scripts.build) scripts.build = `${getPackageManager(cwd)} run build`;
      if (pkg.scripts.test) scripts.test = `${getPackageManager(cwd)} test`;
      if (pkg.scripts.lint) scripts.lint = `${getPackageManager(cwd)} run lint`;
    }

    // Détecter les dépendances clés
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
    const keyDependencies = detectKeyDependencies(allDeps);

    return {
      name: pkg.name || "unknown",
      version: pkg.version || "0.0.0",
      scripts,
      isESM: pkg.type === "module",
      keyDependencies,
    };
  } catch {
    return {
      name: "unknown",
      version: "0.0.0",
      scripts: {},
      isESM: false,
      keyDependencies: [],
    };
  }
}

/**
 * Détecte le package manager utilisé
 */
function getPackageManager(cwd: string): string {
  if (existsSync(join(cwd, "bun.lock")) || existsSync(join(cwd, "bun.lockb"))) {
    return "bun";
  }
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (existsSync(join(cwd, "yarn.lock"))) {
    return "yarn";
  }
  return "npm";
}

/**
 * Détecte les dépendances clés (frameworks, outils)
 */
function detectKeyDependencies(deps: Record<string, string>): string[] {
  const keyPackages = [
    "react",
    "vue",
    "svelte",
    "angular",
    "next",
    "express",
    "fastify",
    "nestjs",
    "commander",
    "ink",
    "typescript",
    "vitest",
    "jest",
    "bun",
  ];

  return Object.keys(deps).filter((dep) =>
    keyPackages.some((key) => dep.includes(key))
  );
}

// ============================================================================
// TypeScript Config Scanner
// ============================================================================

/**
 * Scans and parses tsconfig.json
 */
export function scanTsConfig(cwd: string): {
  hasTypeScript: boolean;
  esTarget?: string;
  strictMode: boolean;
} {
  const tsconfigPath = join(cwd, "tsconfig.json");

  if (!existsSync(tsconfigPath)) {
    return {
      hasTypeScript: false,
      strictMode: false,
    };
  }

  try {
    const content = readFileSync(tsconfigPath, "utf-8");
    // Supprimer les commentaires JSON (// et /* */)
    const cleanContent = content
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const tsconfig: TsConfig = JSON.parse(cleanContent);

    return {
      hasTypeScript: true,
      esTarget: tsconfig.compilerOptions?.target,
      strictMode: tsconfig.compilerOptions?.strict === true,
    };
  } catch {
    // tsconfig existe mais erreur de parsing
    return {
      hasTypeScript: true,
      strictMode: false,
    };
  }
}

// ============================================================================
// Git Metadata Scanner
// ============================================================================

/**
 * Scans git metadata (branch, remote)
 */
export function scanGitMetadata(cwd: string): {
  gitBranch?: string;
  gitRemote?: string;
} {
  // Vérifier si c'est un repo git
  if (!existsSync(join(cwd, ".git"))) {
    return {};
  }

  try {
    // Récupérer la branche courante
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    // Récupérer l'URL du remote
    let remote: string | undefined;
    try {
      remote = execSync("git remote get-url origin", {
        cwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
    } catch {
      // Pas de remote configuré
    }

    return {
      gitBranch: branch,
      gitRemote: remote,
    };
  } catch {
    return {};
  }
}

// ============================================================================
// Existing HORUS.md Scanner
// ============================================================================

/**
 * Checks if HORUS.md exists and returns its content
 */
export function scanExistingHorusMd(
  cwd: string,
  targetFile: string
): string | null {
  const horusPath = join(cwd, targetFile);

  if (!existsSync(horusPath)) {
    return null;
  }

  try {
    return readFileSync(horusPath, "utf-8");
  } catch {
    return null;
  }
}

// ============================================================================
// Main Scanner - Orchestrateur
// ============================================================================

/**
 * Scans the repository and returns all metadata
 */
export function scanRepository(config: InitConfig): ScanResult {
  const { cwd, targetFile, includeGit } = config;

  // Scan package.json
  const pkgData = scanPackageJson(cwd);

  // Scan tsconfig.json
  const tsData = scanTsConfig(cwd);

  // Scan git metadata (optional)
  const gitData = includeGit ? scanGitMetadata(cwd) : {};

  // Check existing HORUS.md
  const existingHorusMd = scanExistingHorusMd(cwd, targetFile);

  // Détecter la commande d'installation
  const packageManager = getPackageManager(cwd);
  const scripts = {
    install: `${packageManager} install`,
    ...pkgData.scripts,
  };

  return {
    projectName: pkgData.name,
    version: pkgData.version,
    scripts,
    hasTypeScript: tsData.hasTypeScript,
    isESM: pkgData.isESM,
    esTarget: tsData.esTarget,
    strictMode: tsData.strictMode,
    gitBranch: gitData.gitBranch,
    gitRemote: gitData.gitRemote,
    existingHorusMd,
    keyDependencies: pkgData.keyDependencies,
  };
}
