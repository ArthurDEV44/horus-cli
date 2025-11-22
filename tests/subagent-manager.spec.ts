/**
 * Tests for SubagentManager
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { detectParallelizableTask } from '../src/context/subagent-manager.js';

describe('SubagentManager', () => {
  describe('detectParallelizableTask', () => {
    it('should return null for non-parallelizable queries', () => {
      const query = 'Explain how this function works';
      const files = ['src/utils/helper.ts'];

      const result = detectParallelizableTask(query, files);
      expect(result).toBeNull();
    });

    it('should return null when less than 3 files', () => {
      const query = 'Refactor all files';
      const files = ['src/file1.ts', 'src/file2.ts'];

      const result = detectParallelizableTask(query, files);
      expect(result).toBeNull();
    });

    it('should detect "all files" pattern in English', () => {
      const query = 'Refactor all files to use async/await';
      const files = [
        'src/file1.ts',
        'src/file2.ts',
        'src/file3.ts',
        'src/file4.ts',
        'src/file5.ts',
        'src/file6.ts',
      ];

      const result = detectParallelizableTask(query, files);
      expect(result).not.toBeNull();
      expect(result?.length).toBe(3); // Should split into 3 batches
    });

    it('should detect "tous les fichiers" pattern in French', () => {
      const query = 'Améliorer tous les fichiers TypeScript';
      const files = [
        'src/file1.ts',
        'src/file2.ts',
        'src/file3.ts',
        'src/file4.ts',
      ];

      const result = detectParallelizableTask(query, files);
      expect(result).not.toBeNull();
      expect(result?.length).toBeGreaterThan(0);
    });

    it('should detect "all *.ts" pattern', () => {
      const query = 'Add error handling to all *.ts files';
      const files = [
        'src/file1.ts',
        'src/file2.ts',
        'src/file3.ts',
      ];

      const result = detectParallelizableTask(query, files);
      expect(result).not.toBeNull();
    });

    it('should split files into batches of ~equal size', () => {
      const query = 'Refactor all files';
      const files = Array.from({ length: 9 }, (_, i) => `src/file${i + 1}.ts`);

      const result = detectParallelizableTask(query, files);
      expect(result).not.toBeNull();
      expect(result?.length).toBe(3);

      // Each batch should have 3 files (9 / 3 = 3)
      result?.forEach(task => {
        expect(task.files.length).toBe(3);
      });
    });

    it('should handle uneven file distribution', () => {
      const query = 'Refactor all files';
      const files = Array.from({ length: 10 }, (_, i) => `src/file${i + 1}.ts`);

      const result = detectParallelizableTask(query, files);
      expect(result).not.toBeNull();
      expect(result?.length).toBe(3);

      // First batch: 4 files, next two: 3 files each (10 / 3 = 3.33 -> ceil = 4)
      expect(result?.[0].files.length).toBe(4);
      expect(result?.[1].files.length).toBe(4);
      expect(result?.[2].files.length).toBe(2);
    });

    it('should set default tools whitelist', () => {
      const query = 'Refactor all files';
      const files = [
        'src/file1.ts',
        'src/file2.ts',
        'src/file3.ts',
      ];

      const result = detectParallelizableTask(query, files);
      expect(result).not.toBeNull();

      result?.forEach(task => {
        expect(task.tools).toContain('view_file');
        expect(task.tools).toContain('str_replace_editor');
        expect(task.tools).toContain('replace_lines');
        expect(task.tools).toContain('create_file');
      });
    });

    it('should preserve original instruction in each subtask', () => {
      const query = 'Add JSDoc comments to all functions';
      const files = [
        'src/file1.ts',
        'src/file2.ts',
        'src/file3.ts',
      ];

      const result = detectParallelizableTask(query, files);
      expect(result).not.toBeNull();

      result?.forEach(task => {
        expect(task.instruction).toBe(query);
      });
    });

    it('should detect "every file" pattern', () => {
      const query = 'Update every file in the project';
      const files = [
        'src/file1.ts',
        'src/file2.ts',
        'src/file3.ts',
      ];

      const result = detectParallelizableTask(query, files);
      expect(result).not.toBeNull();
    });
  });

  describe('SubagentManager integration scenarios', () => {
    it('should handle edge case: exactly 3 files', () => {
      const query = 'Refactor all files';
      const files = ['file1.ts', 'file2.ts', 'file3.ts'];

      const result = detectParallelizableTask(query, files);
      expect(result).not.toBeNull();
      expect(result?.length).toBe(3);

      // Each batch should have 1 file
      result?.forEach(task => {
        expect(task.files.length).toBe(1);
      });
    });

    it('should handle edge case: large number of files', () => {
      const query = 'Add copyright header to all files';
      const files = Array.from({ length: 100 }, (_, i) => `src/file${i + 1}.ts`);

      const result = detectParallelizableTask(query, files);
      expect(result).not.toBeNull();
      expect(result?.length).toBe(3);

      // Should distribute files across 3 batches
      const totalFiles = result?.reduce((sum, task) => sum + task.files.length, 0);
      expect(totalFiles).toBe(100);
    });
  });
});
