import type { ActionPlan, EvaluationResult, Policy } from '../../shared/src/index.js';

export interface EvaluatePlanOptions {
  spentToday?: number;
  recipientVerified?: boolean;
}

export function evaluatePlan(
  policy: Policy,
  plan: ActionPlan,
  options: EvaluatePlanOptions = {},
): EvaluationResult {
  const reasons: string[] = [];
  const appliedRules: string[] = [];
  const spentToday = options.spentToday ?? 0;

  if (plan.agentId !== policy.agentId) {
    appliedRules.push('agent_match');
    return {
      decision: 'denied',
      reasons: ['Plan agent does not match policy agent.'],
      appliedRules,
    };
  }

  // Destination checks only apply to transfers, not swaps
  if (plan.type !== 'swap') {
    if (policy.deniedDestinations.includes(plan.destination)) {
      appliedRules.push('denied_destination');
      return {
        decision: 'denied',
        reasons: ['Destination is explicitly denied by policy.'],
        appliedRules,
      };
    }

    if (
      policy.allowedDestinations.length > 0 &&
      !policy.allowedDestinations.includes(plan.destination)
    ) {
      appliedRules.push('allowed_destination');
      return {
        decision: 'denied',
        reasons: ['Destination is not in the allowed destination list.'],
        appliedRules,
      };
    }
  }

  if (plan.amount > policy.maxPerAction) {
    reasons.push('Amount exceeds max per action.');
    appliedRules.push('max_per_action');
  }

  if (spentToday + plan.amount > policy.dailyCap) {
    reasons.push('Amount would exceed daily cap.');
    appliedRules.push('daily_cap');
  }

  if (plan.amount >= policy.approvalThreshold) {
    reasons.push('Amount meets or exceeds approval threshold.');
    appliedRules.push('approval_threshold');
  }

  // ERC-8004 trust-gated identity check
  if (
    policy.requireVerifiedIdentity &&
    options.recipientVerified !== undefined &&
    !options.recipientVerified
  ) {
    reasons.push('Recipient does not have verified ERC-8004 identity.');
    appliedRules.push('unverified_identity');
  }

  if (reasons.length === 0) {
    return {
      decision: 'approved',
      reasons: ['Plan is within policy.'],
      appliedRules: ['within_policy'],
    };
  }

  if (appliedRules.includes('max_per_action') || appliedRules.includes('daily_cap')) {
    return {
      decision: 'denied',
      reasons,
      appliedRules,
    };
  }

  return {
    decision: 'approval_required',
    reasons,
    appliedRules,
  };
}
