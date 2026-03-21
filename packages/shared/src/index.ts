export type AgentRole = 'proposer' | 'executor' | 'auditor' | 'admin';

export interface AgentProfile {
  agentId: string;
  role: AgentRole;
  name: string;
  capabilities: string[];
  walletAddress?: string;
  description?: string;
}

export type ActionType = 'transfer' | 'swap' | 'contract_call';

export interface Policy {
  policyId: string;
  agentId: string;
  currency: string;
  maxPerAction: number;
  dailyCap: number;
  approvalThreshold: number;
  allowedDestinations: string[];
  deniedDestinations: string[];
  loggingRequired: boolean;
  requireVerifiedIdentity?: boolean;
  // Swap-specific controls (separate from transfer caps)
  maxSwapPerAction?: number;
  maxSlippageBps?: number;  // e.g. 50 = 0.5%
}

export interface ActionPlan {
  planId: string;
  agentId: string;
  type: ActionType;
  amount: number;
  destination: string;
  reason: string;
  requestedAt?: string;
}

export type EvaluationDecision = 'approved' | 'approval_required' | 'denied';

export interface EvaluationResult {
  decision: EvaluationDecision;
  reasons: string[];
  appliedRules: string[];
}

export interface ApprovalRequest {
  approvalId: string;
  planId: string;
  agentId: string;
  plan: ActionPlan;
  evaluation: EvaluationResult;
  status: 'pending' | 'approved' | 'denied';
  createdAt: string;
  respondedAt?: string;
  respondedBy?: string;
}

export type AuditEventType =
  | 'plan_submitted'
  | 'plan_evaluated'
  | 'approval_requested'
  | 'approval_granted'
  | 'approval_denied'
  | 'execution_result';

export interface AuditEvent<T = Record<string, unknown>> {
  id: string;
  type: AuditEventType;
  timestamp: string;
  payload: T;
}

export * from './yield-strategy.js';
export * from './trading.js';
