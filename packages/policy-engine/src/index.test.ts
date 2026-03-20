import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { evaluatePlan } from './index.js';
import type { ActionPlan, Policy } from '../../shared/src/index.js';

const basePolicy: Policy = {
  policyId: 'test-policy',
  agentId: 'bagel',
  currency: 'USD',
  maxPerAction: 100,
  dailyCap: 500,
  approvalThreshold: 75,
  allowedDestinations: ['0xAllowed1', '0xAllowed2'],
  deniedDestinations: ['0xDenied1'],
  loggingRequired: true,
};

function plan(overrides: Partial<ActionPlan> = {}): ActionPlan {
  return {
    planId: 'test-plan',
    agentId: 'bagel',
    type: 'transfer',
    amount: 50,
    destination: '0xAllowed1',
    reason: 'test',
    ...overrides,
  };
}

describe('evaluatePlan', () => {
  test('approves plan within policy', () => {
    const result = evaluatePlan(basePolicy, plan());
    assert.equal(result.decision, 'approved');
    assert.deepEqual(result.appliedRules, ['within_policy']);
  });

  test('denies wrong agent', () => {
    const result = evaluatePlan(basePolicy, plan({ agentId: 'rogue' }));
    assert.equal(result.decision, 'denied');
    assert.ok(result.appliedRules.includes('agent_match'));
  });

  test('denies explicitly denied destination', () => {
    const result = evaluatePlan(basePolicy, plan({ destination: '0xDenied1' }));
    assert.equal(result.decision, 'denied');
    assert.ok(result.appliedRules.includes('denied_destination'));
  });

  test('denies destination not in allowlist', () => {
    const result = evaluatePlan(basePolicy, plan({ destination: '0xUnknown' }));
    assert.equal(result.decision, 'denied');
    assert.ok(result.appliedRules.includes('allowed_destination'));
  });

  test('allows any destination when allowlist is empty', () => {
    const openPolicy = { ...basePolicy, allowedDestinations: [] };
    const result = evaluatePlan(openPolicy, plan({ destination: '0xAnywhere' }));
    assert.equal(result.decision, 'approved');
  });

  test('denies amount exceeding max per action', () => {
    const result = evaluatePlan(basePolicy, plan({ amount: 150 }));
    assert.equal(result.decision, 'denied');
    assert.ok(result.appliedRules.includes('max_per_action'));
  });

  test('denies when daily cap would be exceeded', () => {
    const result = evaluatePlan(basePolicy, plan({ amount: 50 }), { spentToday: 480 });
    assert.equal(result.decision, 'denied');
    assert.ok(result.appliedRules.includes('daily_cap'));
  });

  test('requires approval when amount meets threshold', () => {
    const result = evaluatePlan(basePolicy, plan({ amount: 75 }));
    assert.equal(result.decision, 'approval_required');
    assert.ok(result.appliedRules.includes('approval_threshold'));
  });

  test('requires approval at exactly threshold', () => {
    const result = evaluatePlan(basePolicy, plan({ amount: 75 }));
    assert.equal(result.decision, 'approval_required');
  });

  test('approves just below threshold', () => {
    const result = evaluatePlan(basePolicy, plan({ amount: 74 }));
    assert.equal(result.decision, 'approved');
  });

  test('denied rules take priority over approval_required', () => {
    // amount exceeds max_per_action (hard deny) AND meets threshold (soft)
    const result = evaluatePlan(basePolicy, plan({ amount: 150 }));
    assert.equal(result.decision, 'denied');
  });

  test('defaults spentToday to 0', () => {
    const result = evaluatePlan(basePolicy, plan({ amount: 50 }));
    assert.equal(result.decision, 'approved');
  });
});
