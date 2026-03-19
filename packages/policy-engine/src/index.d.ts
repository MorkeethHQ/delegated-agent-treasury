import type { ActionPlan, EvaluationResult, Policy } from '../../shared/src/index.js';
export interface EvaluatePlanOptions {
    spentToday?: number;
}
export declare function evaluatePlan(policy: Policy, plan: ActionPlan, options?: EvaluatePlanOptions): EvaluationResult;
