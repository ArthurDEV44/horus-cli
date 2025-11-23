import { describe, it, expect } from 'bun:test';
import {
  detectAvailableVRAM,
  detectGPUType,
  getSystemInfo,
  formatSystemInfo,
} from '../src/utils/system-info.js';

describe('SystemInfo', () => {
  describe('detectAvailableVRAM', () => {
    it('should return a positive number', async () => {
      const vram = await detectAvailableVRAM();
      expect(vram).toBeGreaterThan(0);
      expect(typeof vram).toBe('number');
    });

    it('should return an integer', async () => {
      const vram = await detectAvailableVRAM();
      expect(Math.floor(vram)).toBe(vram);
    });

    it('should not exceed 256GB (sanity check)', async () => {
      const vram = await detectAvailableVRAM();
      expect(vram).toBeLessThanOrEqual(256);
    });
  });

  describe('detectGPUType', () => {
    it('should return a valid GPU type', () => {
      const gpuType = detectGPUType();
      expect(['nvidia', 'amd', 'apple', 'unknown']).toContain(gpuType);
    });

    it('should return consistent results', () => {
      const gpuType1 = detectGPUType();
      const gpuType2 = detectGPUType();
      expect(gpuType1).toBe(gpuType2);
    });
  });

  describe('getSystemInfo', () => {
    it('should return complete system info', async () => {
      const info = await getSystemInfo();

      expect(info).toBeDefined();
      expect(info.vram).toBeGreaterThan(0);
      expect(info.ram).toBeGreaterThan(0);
      expect(info.cpuCores).toBeGreaterThan(0);
      expect(info.platform).toBeDefined();
      expect(['nvidia', 'amd', 'apple', 'unknown']).toContain(info.gpuType);
    });

    it('should have consistent CPU cores', async () => {
      const info = await getSystemInfo();
      expect(info.cpuCores).toBeGreaterThanOrEqual(1);
      expect(info.cpuCores).toBeLessThanOrEqual(256); // Sanity check
    });

    it('should have valid platform', async () => {
      const info = await getSystemInfo();
      expect(['linux', 'darwin', 'win32', 'freebsd', 'openbsd']).toContain(info.platform);
    });
  });

  describe('formatSystemInfo', () => {
    it('should format system info as multiline string', async () => {
      const info = await getSystemInfo();
      const formatted = formatSystemInfo(info);

      expect(formatted).toContain('Platform:');
      expect(formatted).toContain('CPU Cores:');
      expect(formatted).toContain('RAM:');
      expect(formatted).toContain('GPU Type:');
      expect(formatted).toContain('VRAM:');
    });

    it('should include GPU name if available', async () => {
      const info = await getSystemInfo();
      const formatted = formatSystemInfo(info);

      if (info.gpuName) {
        expect(formatted).toContain('GPU Name:');
        expect(formatted).toContain(info.gpuName);
      }
    });

    it('should format VRAM as integer', async () => {
      const info = await getSystemInfo();
      const formatted = formatSystemInfo(info);

      const vramMatch = formatted.match(/VRAM: (\d+) GB/);
      expect(vramMatch).toBeTruthy();

      if (vramMatch) {
        const vram = parseInt(vramMatch[1], 10);
        expect(vram).toBe(info.vram);
      }
    });
  });
});
