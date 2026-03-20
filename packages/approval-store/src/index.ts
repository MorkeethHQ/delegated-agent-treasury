import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ActionPlan, ApprovalRequest, EvaluationResult } from '../../shared/src/index.js';

const approvals = new Map<string, ApprovalRequest>();

let persistPath: string | null = null;

export function configurePersistence(path: string): void {
  persistPath = path;
}

async function persist(): Promise<void> {
  if (!persistPath) return;
  await mkdir(dirname(persistPath), { recursive: true });
  const data = JSON.stringify(Array.from(approvals.values()), null, 2);
  await writeFile(persistPath, data, 'utf8');
}

export async function loadApprovals(path: string): Promise<void> {
  configurePersistence(path);
  try {
    const raw = await readFile(path, 'utf8');
    const items = JSON.parse(raw) as ApprovalRequest[];
    for (const item of items) {
      approvals.set(item.approvalId, item);
    }
  } catch {
    // File doesn't exist yet — that's fine
  }
}

export function createApproval(
  plan: ActionPlan,
  evaluation: EvaluationResult,
): ApprovalRequest {
  const approval: ApprovalRequest = {
    approvalId: randomUUID(),
    planId: plan.planId,
    agentId: plan.agentId,
    plan,
    evaluation,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  approvals.set(approval.approvalId, approval);
  void persist();
  return approval;
}

export function getApproval(approvalId: string): ApprovalRequest | undefined {
  return approvals.get(approvalId);
}

export function listApprovals(filter?: { status?: ApprovalRequest['status'] }): ApprovalRequest[] {
  const all = Array.from(approvals.values());
  if (filter?.status) {
    return all.filter((a) => a.status === filter.status);
  }
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function respondToApproval(
  approvalId: string,
  decision: 'approved' | 'denied',
  respondedBy?: string,
): ApprovalRequest | null {
  const approval = approvals.get(approvalId);
  if (!approval || approval.status !== 'pending') return null;

  approval.status = decision;
  approval.respondedAt = new Date().toISOString();
  approval.respondedBy = respondedBy;
  void persist();
  return approval;
}
