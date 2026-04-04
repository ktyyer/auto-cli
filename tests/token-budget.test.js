import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TOTAL_BUDGET,
  PHASE_QUOTAS,
  BUDGET_STATUS,
  createBudget,
  consumeTokens,
  getBudgetStatus,
  getPhaseStatus,
  canAfford,
  getBudgetSummary,
  dynamicRebalance,
  TokenBudgetManager
} from '../src/budget/token-budget.js';

describe('createBudget', () => {
  it('should create budget with defaults', () => {
    const budget = createBudget();

    expect(budget.totalBudget).toBe(DEFAULT_TOTAL_BUDGET);
    expect(budget.totalConsumed).toBe(0);
    expect(budget.history).toHaveLength(0);
    expect(Object.isFrozen(budget)).toBe(true);
  });

  it('should allocate phases proportionally', () => {
    const budget = createBudget({ totalBudget: 100000 });

    expect(budget.phaseAllocations.discover.allocated).toBe(10000);
    expect(budget.phaseAllocations.reason.allocated).toBe(25000);
    expect(budget.phaseAllocations.execute.allocated).toBe(45000);
    expect(budget.phaseAllocations.verify.allocated).toBe(10000);
  });

  it('should accept custom total budget', () => {
    const budget = createBudget({ totalBudget: 50000 });
    expect(budget.totalBudget).toBe(50000);
  });
});

describe('consumeTokens', () => {
  it('should track consumption immutably', () => {
    const budget = createBudget({ totalBudget: 100000 });
    const updated = consumeTokens(budget, 'discover', 5000, 'scan');

    expect(updated.totalConsumed).toBe(5000);
    expect(updated.phaseAllocations.discover.consumed).toBe(5000);
    expect(updated.history).toHaveLength(1);
    expect(updated.history[0].tokens).toBe(5000);
    expect(updated.history[0].label).toBe('scan');

    // Original unchanged
    expect(budget.totalConsumed).toBe(0);
  });

  it('should accumulate multiple consumptions', () => {
    let budget = createBudget({ totalBudget: 100000 });
    budget = consumeTokens(budget, 'discover', 3000);
    budget = consumeTokens(budget, 'discover', 2000);

    expect(budget.totalConsumed).toBe(5000);
    expect(budget.phaseAllocations.discover.consumed).toBe(5000);
    expect(budget.history).toHaveLength(2);
  });

  it('should throw for unknown phase', () => {
    const budget = createBudget();
    expect(() => consumeTokens(budget, 'unknown', 100)).toThrow('未知阶段');
  });
});

describe('getBudgetStatus', () => {
  it('should return OK for low usage', () => {
    const budget = createBudget({ totalBudget: 100000 });
    const updated = consumeTokens(budget, 'discover', 10000);
    expect(getBudgetStatus(updated)).toBe(BUDGET_STATUS.OK);
  });

  it('should return WARNING at 75%', () => {
    const budget = createBudget({ totalBudget: 100000 });
    const updated = consumeTokens(budget, 'execute', 76000);
    expect(getBudgetStatus(updated)).toBe(BUDGET_STATUS.WARNING);
  });

  it('should return CRITICAL at 90%', () => {
    const budget = createBudget({ totalBudget: 100000 });
    const updated = consumeTokens(budget, 'execute', 91000);
    expect(getBudgetStatus(updated)).toBe(BUDGET_STATUS.CRITICAL);
  });

  it('should return EXHAUSTED at 100%', () => {
    const budget = createBudget({ totalBudget: 100000 });
    const updated = consumeTokens(budget, 'execute', 100000);
    expect(getBudgetStatus(updated)).toBe(BUDGET_STATUS.EXHAUSTED);
  });
});

describe('getPhaseStatus', () => {
  it('should return phase allocation details', () => {
    const budget = createBudget({ totalBudget: 100000 });
    const updated = consumeTokens(budget, 'discover', 5000);
    const status = getPhaseStatus(updated, 'discover');

    expect(status.allocated).toBe(10000);
    expect(status.consumed).toBe(5000);
    expect(status.remaining).toBe(5000);
    expect(status.ratio).toBe(0.5);
    expect(status.status).toBe(BUDGET_STATUS.OK);
  });

  it('should return null for unknown phase', () => {
    const budget = createBudget();
    expect(getPhaseStatus(budget, 'unknown')).toBeNull();
  });
});

describe('canAfford', () => {
  it('should return true when budget available', () => {
    const budget = createBudget({ totalBudget: 100000 });
    expect(canAfford(budget, 'discover', 5000)).toBe(true);
  });

  it('should return true when phase budget exceeded but total budget allows borrowing', () => {
    const budget = createBudget({ totalBudget: 100000 });
    // discover has 10000 allocated, but dynamic borrowing allows it
    expect(canAfford(budget, 'discover', 15000)).toBe(true);
  });

  it('should return false when total budget is exhausted', () => {
    const budget = consumeTokens(createBudget({ totalBudget: 100000 }), 'execute', 100000);
    expect(canAfford(budget, 'discover', 1000)).toBe(false);
  });

  it('should return false for unknown phase', () => {
    const budget = createBudget();
    expect(canAfford(budget, 'unknown', 100)).toBe(false);
  });
});

describe('getBudgetSummary', () => {
  it('should return formatted summary string', () => {
    let budget = createBudget({ totalBudget: 100000 });
    budget = consumeTokens(budget, 'discover', 5000);

    const summary = getBudgetSummary(budget);
    expect(summary).toContain('Token 预算');
    expect(summary).toContain('5%');
    expect(summary).toContain('discover');
  });
});

describe('TokenBudgetManager', () => {
  it('should wrap pure functions with state', () => {
    const mgr = new TokenBudgetManager({ totalBudget: 100000 });

    const { status } = mgr.consume('discover', 5000, 'scan');
    expect(status).toBe(BUDGET_STATUS.OK);

    expect(mgr.getStatus()).toBe(BUDGET_STATUS.OK);
    expect(mgr.canAfford('discover', 3000)).toBe(true);
    expect(mgr.getSnapshot().totalConsumed).toBe(5000);
  });

  it('should track phase status', () => {
    const mgr = new TokenBudgetManager({ totalBudget: 100000 });
    mgr.consume('execute', 40000);

    const phaseStatus = mgr.getPhaseStatus('execute');
    expect(phaseStatus.consumed).toBe(40000);
    expect(phaseStatus.remaining).toBe(5000);
  });

  it('should return summary string', () => {
    const mgr = new TokenBudgetManager({ totalBudget: 100000 });
    mgr.consume('discover', 1000);

    const summary = mgr.getSummary();
    expect(typeof summary).toBe('string');
    expect(summary).toContain('Token 预算');
  });
});

describe('dynamicRebalance', () => {
  it('should redistribute surplus from completed phase', () => {
    let budget = createBudget({ totalBudget: 100000 });
    // discover only used 2000 out of 10000
    budget = consumeTokens(budget, 'discover', 2000, 'quick scan');

    const rebalanced = dynamicRebalance(budget, {
      completedPhase: 'discover',
      upcomingPhases: ['execute', 'verify'],
      redistributeRatio: 0.5
    });

    // discover surplus = 10000 - 2000 = 8000
    // redistributable = 8000 * 0.5 = 4000
    // per phase = 4000 / 2 = 2000
    expect(rebalanced.phaseAllocations.execute.allocated).toBe(
      budget.phaseAllocations.execute.allocated + 2000
    );
    expect(rebalanced.phaseAllocations.verify.allocated).toBe(
      budget.phaseAllocations.verify.allocated + 2000
    );
  });

  it('should return same budget when no surplus', () => {
    let budget = createBudget({ totalBudget: 100000 });
    budget = consumeTokens(budget, 'discover', 10000, 'full scan');

    const rebalanced = dynamicRebalance(budget, {
      completedPhase: 'discover',
      upcomingPhases: ['execute']
    });

    expect(rebalanced).toBe(budget); // no change
  });

  it('should return same budget for unknown phase', () => {
    const budget = createBudget({ totalBudget: 100000 });

    const rebalanced = dynamicRebalance(budget, {
      completedPhase: 'unknown-phase',
      upcomingPhases: ['execute']
    });

    expect(rebalanced).toBe(budget);
  });

  it('should return same budget when no upcoming phases', () => {
    let budget = createBudget({ totalBudget: 100000 });
    budget = consumeTokens(budget, 'discover', 2000);

    const rebalanced = dynamicRebalance(budget, {
      completedPhase: 'discover',
      upcomingPhases: []
    });

    expect(rebalanced).toBe(budget);
  });

  it('should record rebalance in history', () => {
    let budget = createBudget({ totalBudget: 100000 });
    budget = consumeTokens(budget, 'discover', 2000);

    const rebalanced = dynamicRebalance(budget, {
      completedPhase: 'discover',
      upcomingPhases: ['execute']
    });

    const lastHistoryEntry = rebalanced.history[rebalanced.history.length - 1];
    expect(lastHistoryEntry.label).toContain('dynamic-rebalance');
  });
});

describe('canAfford with dynamic borrowing', () => {
  it('should allow borrowing from other phases when total budget allows', () => {
    let budget = createBudget({ totalBudget: 100000 });
    // Use up all discover budget
    budget = consumeTokens(budget, 'discover', 10000);
    // Try to afford more than discover has left (0) but total has remaining
    // Phase remaining = 10000 - 10000 = 0, but total remaining = 90000
    // With dynamic borrowing: should return true
    expect(canAfford(budget, 'discover', 1000)).toBe(true);
  });

  it('should deny when total budget is exhausted', () => {
    let budget = createBudget({ totalBudget: 100000 });
    budget = consumeTokens(budget, 'execute', 100000);

    expect(canAfford(budget, 'discover', 1000)).toBe(false);
  });
});

describe('TokenBudgetManager.rebalance', () => {
  it('should expose rebalance method', () => {
    const mgr = new TokenBudgetManager({ totalBudget: 100000 });
    mgr.consume('discover', 2000, 'quick scan');

    const result = mgr.rebalance({
      completedPhase: 'discover',
      upcomingPhases: ['execute'],
      redistributeRatio: 0.5
    });

    expect(result).toHaveProperty('budget');
    expect(result).toHaveProperty('redistributed');
  });
});
