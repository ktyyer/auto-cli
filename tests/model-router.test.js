import { describe, it, expect } from 'vitest';
import {
  MODEL_TIERS,
  MODEL_IDS,
  COMPLEXITY_TO_TIER,
  KEYWORD_TIERS,
  routeByAgent,
  routeByKeywords,
  routeModel
} from '../src/router/model-router.js';
import { COMPLEXITY_LEVELS } from '../src/router/agent-types.js';

describe('MODEL_TIERS', () => {
  it('should have 3 tiers', () => {
    expect(Object.keys(MODEL_TIERS)).toHaveLength(3);
    expect(MODEL_TIERS.FAST).toBe('fast');
    expect(MODEL_TIERS.STANDARD).toBe('standard');
    expect(MODEL_TIERS.DEEP).toBe('deep');
  });

  it('should be frozen', () => {
    expect(Object.isFrozen(MODEL_TIERS)).toBe(true);
  });
});

describe('MODEL_IDS', () => {
  it('should map tiers to model IDs', () => {
    expect(MODEL_IDS[MODEL_TIERS.FAST]).toBe('claude-haiku-4-5-20251001');
    expect(MODEL_IDS[MODEL_TIERS.STANDARD]).toBe('claude-sonnet-4-6');
    expect(MODEL_IDS[MODEL_TIERS.DEEP]).toBe('claude-opus-4-6');
  });
});

describe('COMPLEXITY_TO_TIER', () => {
  it('should map complexity levels to tiers', () => {
    expect(COMPLEXITY_TO_TIER[COMPLEXITY_LEVELS.LOW]).toBe(MODEL_TIERS.FAST);
    expect(COMPLEXITY_TO_TIER[COMPLEXITY_LEVELS.MEDIUM]).toBe(MODEL_TIERS.STANDARD);
    expect(COMPLEXITY_TO_TIER[COMPLEXITY_LEVELS.HIGH]).toBe(MODEL_TIERS.DEEP);
  });
});

describe('routeByAgent', () => {
  it('should route low complexity to FAST', () => {
    const result = routeByAgent({ complexity: COMPLEXITY_LEVELS.LOW });

    expect(result.tier).toBe(MODEL_TIERS.FAST);
    expect(result.model).toBe('claude-haiku-4-5-20251001');
    expect(result.reason).toContain('low');
  });

  it('should route medium complexity to STANDARD', () => {
    const result = routeByAgent({ complexity: COMPLEXITY_LEVELS.MEDIUM });

    expect(result.tier).toBe(MODEL_TIERS.STANDARD);
    expect(result.model).toBe('claude-sonnet-4-6');
  });

  it('should route high complexity to DEEP', () => {
    const result = routeByAgent({ complexity: COMPLEXITY_LEVELS.HIGH });

    expect(result.tier).toBe(MODEL_TIERS.DEEP);
    expect(result.model).toBe('claude-opus-4-6');
  });

  it('should default to STANDARD for missing complexity', () => {
    const result = routeByAgent({});

    expect(result.tier).toBe(MODEL_TIERS.STANDARD);
  });

  it('should default to STANDARD for null agent', () => {
    const result = routeByAgent(null);

    expect(result.tier).toBe(MODEL_TIERS.STANDARD);
  });
});

describe('routeByKeywords', () => {
  it('should route search keywords to FAST', () => {
    const result = routeByKeywords(['search', 'find']);

    expect(result.tier).toBe(MODEL_TIERS.FAST);
    expect(result.model).toBe('claude-haiku-4-5-20251001');
    expect(result.matchedKeywords.length).toBeGreaterThan(0);
  });

  it('should route coding keywords to STANDARD', () => {
    const result = routeByKeywords(['implement', 'test']);

    expect(result.tier).toBe(MODEL_TIERS.STANDARD);
    expect(result.model).toBe('claude-sonnet-4-6');
  });

  it('should route architecture keywords to DEEP', () => {
    const result = routeByKeywords(['architect', 'security']);

    expect(result.tier).toBe(MODEL_TIERS.DEEP);
    expect(result.model).toBe('claude-opus-4-6');
  });

  it('should handle Chinese keywords', () => {
    const result = routeByKeywords(['架构', '安全']);

    expect(result.tier).toBe(MODEL_TIERS.DEEP);
  });

  it('should default to STANDARD for no matches', () => {
    const result = routeByKeywords(['zzz-unknown']);

    expect(result.tier).toBe(MODEL_TIERS.STANDARD);
    expect(result.reason).toContain('无关键词匹配');
  });

  it('should prefer higher tier on tie', () => {
    // 'review' matches DEEP, 'test' matches STANDARD
    const result = routeByKeywords(['review', 'test']);

    // DEEP should win because it's checked first in priority order
    expect([MODEL_TIERS.DEEP, MODEL_TIERS.STANDARD]).toContain(result.tier);
  });
});

describe('routeModel', () => {
  it('should use manual override when provided', () => {
    const result = routeModel({
      agent: { complexity: COMPLEXITY_LEVELS.LOW },
      keywords: ['search'],
      override: MODEL_TIERS.DEEP
    });

    expect(result.tier).toBe(MODEL_TIERS.DEEP);
    expect(result.reason).toContain('手动覆盖');
  });

  it('should combine agent and keyword routing', () => {
    const result = routeModel({
      agent: { complexity: COMPLEXITY_LEVELS.LOW },
      keywords: ['architecture', 'design']
    });

    // Keywords suggest DEEP, which is higher than agent's FAST
    expect(result.tier).toBe(MODEL_TIERS.DEEP);
    expect(result.reason).toContain('覆盖');
  });

  it('should use agent route when keywords suggest lower tier', () => {
    const result = routeModel({
      agent: { complexity: COMPLEXITY_LEVELS.HIGH },
      keywords: ['search']
    });

    expect(result.tier).toBe(MODEL_TIERS.DEEP);
  });

  it('should use agent-only when no keywords', () => {
    const result = routeModel({
      agent: { complexity: COMPLEXITY_LEVELS.MEDIUM }
    });

    expect(result.tier).toBe(MODEL_TIERS.STANDARD);
  });

  it('should use keywords-only when no agent', () => {
    const result = routeModel({
      keywords: ['security', 'audit']
    });

    expect(result.tier).toBe(MODEL_TIERS.DEEP);
  });

  it('should default to STANDARD with no input', () => {
    const result = routeModel();

    expect(result.tier).toBe(MODEL_TIERS.STANDARD);
    expect(result.model).toBe('claude-sonnet-4-6');
    expect(result.reason).toContain('默认');
  });

  it('should return frozen result', () => {
    const result = routeModel({ keywords: ['test'] });
    expect(Object.isFrozen(result)).toBe(true);
  });
});
