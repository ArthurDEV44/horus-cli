/**
 * System Information Utilities
 *
 * Provides system detection capabilities for optimal model selection.
 *
 * Features:
 * - VRAM detection (NVIDIA, AMD, Apple Silicon)
 * - RAM detection
 * - CPU core count
 * - Platform detection
 *
 * @module system-info
 */

import { execSync } from 'child_process';
import os from 'os';

/**
 * System information snapshot
 */
export interface SystemInfo {
  vram: number;           // GB
  ram: number;            // GB
  cpuCores: number;
  platform: NodeJS.Platform;
  gpuType: 'nvidia' | 'amd' | 'apple' | 'unknown';
  gpuName?: string;
}

/**
 * Detect available VRAM (GPU memory)
 *
 * Strategy:
 * 1. Try nvidia-smi (NVIDIA GPUs)
 * 2. Try rocm-smi (AMD GPUs)
 * 3. Try system_profiler (Apple Silicon)
 * 4. Fallback: estimate from system RAM (conservative 50%)
 *
 * @returns VRAM in GB
 */
export async function detectAvailableVRAM(): Promise<number> {
  // Try NVIDIA first (most common for local LLMs)
  const nvidiaMem = detectNvidiaVRAM();
  if (nvidiaMem > 0) return nvidiaMem;

  // Try AMD
  const amdMem = detectAMDVRAM();
  if (amdMem > 0) return amdMem;

  // Try Apple Silicon
  const appleMem = detectAppleVRAM();
  if (appleMem > 0) return appleMem;

  // Fallback: conservative estimate from RAM
  const totalRAM = os.totalmem() / (1024 ** 3); // GB
  const estimated = Math.floor(totalRAM * 0.5); // 50% of RAM

  if (process.env.HORUS_CONTEXT_DEBUG === 'true') {
    console.error('[SYSTEM-INFO] No GPU detected, estimating VRAM from RAM:', estimated, 'GB');
  }

  return estimated;
}

/**
 * Detect NVIDIA GPU VRAM via nvidia-smi
 * @returns VRAM in GB, or 0 if not available
 */
function detectNvidiaVRAM(): number {
  try {
    // Query free memory in MB
    const output = execSync('nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits', {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'ignore'], // Suppress stderr
    }).trim();

    // Take first GPU if multiple
    const memoryMB = parseInt(output.split('\n')[0], 10);
    const memoryGB = Math.floor(memoryMB / 1024);

    if (process.env.HORUS_CONTEXT_DEBUG === 'true') {
      console.error('[SYSTEM-INFO] NVIDIA VRAM detected:', memoryGB, 'GB');
    }

    return memoryGB;
  } catch {
    return 0;
  }
}

/**
 * Detect AMD GPU VRAM via rocm-smi
 * @returns VRAM in GB, or 0 if not available
 */
function detectAMDVRAM(): number {
  try {
    const output = execSync('rocm-smi --showmeminfo vram --json', {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    // Parse JSON output
    const data = JSON.parse(output);

    // Extract VRAM from first card
    const firstCard = Object.keys(data)[0];
    if (firstCard && data[firstCard]?.VRAM) {
      const memoryMB = parseInt(data[firstCard].VRAM, 10);
      const memoryGB = Math.floor(memoryMB / 1024);

      if (process.env.HORUS_CONTEXT_DEBUG === 'true') {
        console.error('[SYSTEM-INFO] AMD VRAM detected:', memoryGB, 'GB');
      }

      return memoryGB;
    }

    return 0;
  } catch {
    return 0;
  }
}

/**
 * Detect Apple Silicon unified memory
 * @returns VRAM in GB (approximation), or 0 if not Apple Silicon
 */
function detectAppleVRAM(): number {
  try {
    if (os.platform() !== 'darwin') return 0;

    // Check if Apple Silicon (arm64)
    if (os.arch() !== 'arm64') return 0;

    // Use system_profiler to get RAM info
    const output = execSync('sysctl -n hw.memsize', {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    const memoryBytes = parseInt(output, 10);
    const memoryGB = Math.floor(memoryBytes / (1024 ** 3));

    // Apple Silicon uses unified memory
    // Conservative: 60% of total RAM can be used as "VRAM"
    const vramGB = Math.floor(memoryGB * 0.6);

    if (process.env.HORUS_CONTEXT_DEBUG === 'true') {
      console.error('[SYSTEM-INFO] Apple Silicon detected:', vramGB, 'GB unified memory');
    }

    return vramGB;
  } catch {
    return 0;
  }
}

/**
 * Get GPU type
 * @returns GPU type string
 */
export function detectGPUType(): 'nvidia' | 'amd' | 'apple' | 'unknown' {
  // Try NVIDIA
  try {
    execSync('nvidia-smi --version', {
      encoding: 'utf-8',
      timeout: 2000,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return 'nvidia';
  } catch {
    // Not NVIDIA
  }

  // Try AMD
  try {
    execSync('rocm-smi --version', {
      encoding: 'utf-8',
      timeout: 2000,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return 'amd';
  } catch {
    // Not AMD
  }

  // Try Apple Silicon
  if (os.platform() === 'darwin' && os.arch() === 'arm64') {
    return 'apple';
  }

  return 'unknown';
}

/**
 * Get GPU name (if available)
 * @returns GPU name or undefined
 */
export function detectGPUName(): string | undefined {
  const gpuType = detectGPUType();

  switch (gpuType) {
    case 'nvidia': {
      try {
        const output = execSync('nvidia-smi --query-gpu=name --format=csv,noheader', {
          encoding: 'utf-8',
          timeout: 2000,
          stdio: ['pipe', 'pipe', 'ignore'],
        }).trim();
        return output.split('\n')[0];
      } catch {
        return undefined;
      }
    }

    case 'amd': {
      try {
        const output = execSync('rocm-smi --showproductname', {
          encoding: 'utf-8',
          timeout: 2000,
          stdio: ['pipe', 'pipe', 'ignore'],
        }).trim();
        // Parse output (usually multi-line)
        const match = output.match(/GPU\[0\]\s+:\s+(.+)/);
        return match?.[1];
      } catch {
        return undefined;
      }
    }

    case 'apple': {
      try {
        const output = execSync('sysctl -n machdep.cpu.brand_string', {
          encoding: 'utf-8',
          timeout: 2000,
          stdio: ['pipe', 'pipe', 'ignore'],
        }).trim();
        return output;
      } catch {
        return undefined;
      }
    }

    default:
      return undefined;
  }
}

/**
 * Get complete system information
 * @returns SystemInfo object
 */
export async function getSystemInfo(): Promise<SystemInfo> {
  const vram = await detectAvailableVRAM();
  const ram = os.totalmem() / (1024 ** 3); // GB
  const cpuCores = os.cpus().length;
  const platform = os.platform();
  const gpuType = detectGPUType();
  const gpuName = detectGPUName();

  return {
    vram,
    ram,
    cpuCores,
    platform,
    gpuType,
    gpuName,
  };
}

/**
 * Format system info for display
 * @param info SystemInfo object
 * @returns Formatted string
 */
export function formatSystemInfo(info: SystemInfo): string {
  const lines = [
    `Platform: ${info.platform}`,
    `CPU Cores: ${info.cpuCores}`,
    `RAM: ${info.ram.toFixed(1)} GB`,
    `GPU Type: ${info.gpuType}`,
  ];

  if (info.gpuName) {
    lines.push(`GPU Name: ${info.gpuName}`);
  }

  lines.push(`VRAM: ${info.vram} GB`);

  return lines.join('\n');
}
