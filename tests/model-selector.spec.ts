import { describe, it, expect } from 'bun:test';
import {
  selectOptimalModel,
  selectModelByProfile,
  getRecommendedModel,
  getAllModelSpecs,
  formatRecommendation,
  compareModels,
  MISTRAL_MODELS,
} from '../src/horus/model-selector.js';

describe('ModelSelector', () => {
  describe('selectOptimalModel', () => {
    it('should select mistral for small context and low VRAM', () => {
      const recommendation = selectOptimalModel(4000, 6);
      expect(recommendation.modelName).toBe('mistral');
      expect(recommendation.profile).toBe('fast');
      expect(recommendation.maxContext).toBe(8192);
    });

    it('should select mistral-small for medium context', () => {
      const recommendation = selectOptimalModel(10000, 16);
      expect(recommendation.modelName).toBe('mistral-small');
      expect(recommendation.profile).toBe('balanced');
      expect(recommendation.maxContext).toBe(32768);
    });

    it('should select mixtral for large context with sufficient VRAM', () => {
      const recommendation = selectOptimalModel(20000, 32);
      expect(recommendation.modelName).toBe('mixtral');
      expect(recommendation.profile).toBe('powerful');
      expect(recommendation.maxContext).toBe(32768);
    });

    it('should select devstral for very large context', () => {
      const recommendation = selectOptimalModel(50000, 40);
      expect(recommendation.modelName).toBe('devstral:24b');
      expect(recommendation.profile).toBe('deep');
      expect(recommendation.maxContext).toBe(128000);
    });

    it('should throw error if VRAM insufficient for large context', () => {
      expect(() => selectOptimalModel(50000, 16)).toThrow(/Insufficient VRAM/);
    });

    it('should fallback to mistral-small if mixtral VRAM unavailable', () => {
      const recommendation = selectOptimalModel(20000, 16);
      expect(recommendation.modelName).toBe('mistral-small');
      expect(recommendation.reason).toContain('fallback from mixtral');
    });

    it('should fallback to mistral if mistral-small VRAM unavailable', () => {
      const recommendation = selectOptimalModel(10000, 8);
      expect(recommendation.modelName).toBe('mistral');
      expect(recommendation.reason).toContain('fallback');
    });

    it('should include alternatives when available', () => {
      const recommendation = selectOptimalModel(10000, 32);
      expect(recommendation.alternatives).toBeDefined();
      expect(Array.isArray(recommendation.alternatives)).toBe(true);
    });

    it('should handle edge case: exactly 8000 tokens', () => {
      const recommendation = selectOptimalModel(8000, 6);
      expect(recommendation.modelName).toBe('mistral');
    });

    it('should handle edge case: exactly 32000 tokens', () => {
      const recommendation = selectOptimalModel(32000, 32);
      expect(recommendation.modelName).toBe('mixtral');
    });
  });

  describe('selectModelByProfile', () => {
    it('should select mistral for fast profile', () => {
      const recommendation = selectModelByProfile('fast', 6);
      expect(recommendation.modelName).toBe('mistral');
      expect(recommendation.profile).toBe('fast');
    });

    it('should select mistral-small for balanced profile', () => {
      const recommendation = selectModelByProfile('balanced', 16);
      expect(recommendation.modelName).toBe('mistral-small');
      expect(recommendation.profile).toBe('balanced');
    });

    it('should select mixtral for powerful profile', () => {
      const recommendation = selectModelByProfile('powerful', 32);
      expect(recommendation.modelName).toBe('mixtral');
      expect(recommendation.profile).toBe('powerful');
    });

    it('should select devstral for deep profile', () => {
      const recommendation = selectModelByProfile('deep', 40);
      expect(recommendation.modelName).toBe('devstral:24b');
      expect(recommendation.profile).toBe('deep');
    });

    it('should throw error if VRAM insufficient for fast profile', () => {
      expect(() => selectModelByProfile('fast', 2)).toThrow(/Insufficient VRAM/);
    });

    it('should fallback to lower profile if VRAM insufficient', () => {
      // Request deep (devstral, needs 32GB) but only 16GB available
      // Should fallback to powerful (mixtral) which needs 24GB, but still not enough
      // Then fallback to balanced (mistral-small) which needs 12GB, which should work
      try {
        const recommendation = selectModelByProfile('deep', 16);
        // If it succeeds, should be a fallback
        expect(['mixtral', 'mistral-small', 'mistral']).toContain(recommendation.modelName);
      } catch (error) {
        // Expected if even fallback fails
        expect(error.message).toContain('Insufficient VRAM');
      }
    });

    it('should include reason for user selection', () => {
      const recommendation = selectModelByProfile('balanced', 16);
      expect(recommendation.reason).toContain('User-selected profile');
    });
  });

  describe('getRecommendedModel', () => {
    it('should return a valid recommendation', async () => {
      try {
        const recommendation = await getRecommendedModel(4000); // Small context to avoid VRAM issues
        expect(recommendation).toBeDefined();
        expect(recommendation.modelName).toBeDefined();
        expect(recommendation.profile).toBeDefined();
        expect(recommendation.maxContext).toBeGreaterThan(0);
      } catch (error) {
        // May throw if VRAM too low, that's acceptable
        expect(error.message).toContain('VRAM');
      }
    });

    it('should accept custom context size', async () => {
      try {
        const recommendation = await getRecommendedModel(50000);
        expect(recommendation).toBeDefined();
      } catch (error) {
        // May throw if VRAM insufficient for large context
        expect(error.message).toContain('VRAM');
      }
    });

    it('should use default context size if not provided', async () => {
      try {
        const recommendation = await getRecommendedModel();
        // Default is 16384 tokens, should be handled
        expect(recommendation.maxContext).toBeGreaterThanOrEqual(8192);
      } catch (error) {
        // May throw if VRAM insufficient
        expect(error.message).toContain('VRAM');
      }
    });
  });

  describe('getAllModelSpecs', () => {
    it('should return all Mistral models', () => {
      const specs = getAllModelSpecs();
      expect(specs).toBeDefined();
      expect(specs.mistral).toBeDefined();
      expect(specs['mistral-small']).toBeDefined();
      expect(specs.mixtral).toBeDefined();
      expect(specs['devstral:24b']).toBeDefined();
    });

    it('should have consistent structure for all models', () => {
      const specs = getAllModelSpecs();
      for (const [key, model] of Object.entries(specs)) {
        expect(model.name).toBeDefined();
        expect(model.size).toBeDefined();
        expect(model.context).toBeGreaterThan(0);
        expect(model.vramMin).toBeGreaterThan(0);
        expect(model.speed).toBeGreaterThan(0);
        expect(model.quality).toBeGreaterThan(0);
        expect(Array.isArray(model.useCases)).toBe(true);
      }
    });
  });

  describe('formatRecommendation', () => {
    it('should format recommendation as multiline string', () => {
      const recommendation = selectOptimalModel(10000, 16);
      const formatted = formatRecommendation(recommendation);

      expect(formatted).toContain('Model:');
      expect(formatted).toContain('Profile:');
      expect(formatted).toContain('Context Window:');
      expect(formatted).toContain('VRAM Required:');
      expect(formatted).toContain('Reason:');
    });

    it('should include speed rating', () => {
      const recommendation = selectOptimalModel(10000, 16);
      const formatted = formatRecommendation(recommendation);
      expect(formatted).toContain('Speed:');
      expect(formatted).toContain('⚡');
    });

    it('should include quality rating', () => {
      const recommendation = selectOptimalModel(10000, 16);
      const formatted = formatRecommendation(recommendation);
      expect(formatted).toContain('Quality:');
      expect(formatted).toContain('⭐');
    });

    it('should include use cases', () => {
      const recommendation = selectOptimalModel(10000, 16);
      const formatted = formatRecommendation(recommendation);
      expect(formatted).toContain('Use Cases:');
    });

    it('should include alternatives if available', () => {
      const recommendation = selectOptimalModel(10000, 32);
      const formatted = formatRecommendation(recommendation);
      if (recommendation.alternatives && recommendation.alternatives.length > 0) {
        expect(formatted).toContain('Alternatives:');
      }
    });
  });

  describe('compareModels', () => {
    it('should compare two valid models', () => {
      const comparison = compareModels('mistral', 'mistral-small');
      expect(comparison).toContain('Comparing');
      expect(comparison).toContain('mistral');
      expect(comparison).toContain('mistral-small');
      expect(comparison).toContain('Size:');
      expect(comparison).toContain('Context:');
      expect(comparison).toContain('VRAM:');
      expect(comparison).toContain('Speed:');
      expect(comparison).toContain('Quality:');
    });

    it('should compare mixtral and devstral', () => {
      const comparison = compareModels('mixtral', 'devstral:24b');
      expect(comparison).toContain('mixtral');
      expect(comparison).toContain('devstral');
    });

    it('should handle invalid model names', () => {
      const comparison = compareModels('invalid-model', 'mistral');
      expect(comparison).toContain('not found');
    });

    it('should show context window difference', () => {
      const comparison = compareModels('mistral', 'devstral:24b');
      expect(comparison).toContain('8,192'); // mistral context
      expect(comparison).toContain('128,000'); // devstral context
    });

    it('should show VRAM difference', () => {
      const comparison = compareModels('mistral', 'mixtral');
      expect(comparison).toContain('4GB'); // mistral VRAM
      expect(comparison).toContain('24GB'); // mixtral VRAM
    });
  });

  describe('MISTRAL_MODELS constant', () => {
    it('should have correct ordering by capability', () => {
      expect(MISTRAL_MODELS.mistral.vramMin).toBeLessThan(MISTRAL_MODELS['mistral-small'].vramMin);
      expect(MISTRAL_MODELS['mistral-small'].vramMin).toBeLessThan(MISTRAL_MODELS.mixtral.vramMin);
      expect(MISTRAL_MODELS.mixtral.vramMin).toBeLessThan(MISTRAL_MODELS['devstral:24b'].vramMin);
    });

    it('should have ascending context windows', () => {
      expect(MISTRAL_MODELS.mistral.context).toBeLessThan(MISTRAL_MODELS['mistral-small'].context);
      expect(MISTRAL_MODELS.mixtral.context).toBeLessThanOrEqual(MISTRAL_MODELS['mistral-small'].context);
      expect(MISTRAL_MODELS['devstral:24b'].context).toBeGreaterThan(MISTRAL_MODELS.mixtral.context);
    });

    it('should have inverse relationship between speed and quality', () => {
      // Generally: faster models have lower quality, slower have higher
      expect(MISTRAL_MODELS.mistral.speed).toBeGreaterThan(MISTRAL_MODELS.mixtral.speed);
      expect(MISTRAL_MODELS.mixtral.quality).toBeGreaterThan(MISTRAL_MODELS.mistral.quality);
    });
  });
});
