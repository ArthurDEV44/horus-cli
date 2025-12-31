/**
 * Init module exports - Version simplifiée
 * Provides documentation generation functionality for Horus CLI
 */

// Types
export type {
  InitConfig,
  InitResult,
  ScanResult,
  PackageJson,
  TsConfig,
} from "./types.js";

// Scanner
export {
  scanPackageJson,
  scanTsConfig,
  scanGitMetadata,
  scanExistingHorusMd,
  scanRepository,
} from "./scanner.js";

// Generator
export { generateHorusMd, writeHorusMd } from "./generator.js";
