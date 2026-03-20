import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { appendAuditEvent } from '../../../packages/audit-log/src/index.js';
import { evaluatePlan } from '../../../packages/policy-engine/src/index.js';
import {
  loadApprovals,
  createApproval,
  getApproval,
  listApprovals,
  respondToApproval,
} from '../../../packages/approval-store/src/index.js';
import type { ActionPlan, AuditEvent, Policy } from '../../../packages/shared/src/index.js';

const root = process.cwd();
const policyPath = resolve(root, 'config', 'sample-policy.json');
const auditLogPath = resolve(root, 'data', 'audit-events.jsonl');
const approvalsPath = resolve(root, 'data', 'approvals.json');

async function readJsonFile<T>(path: string): Promise<T> {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as T;
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(JSON.stringify(body, null, 2));
}

function parseBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function auditLog(type: AuditEvent['type'], payload: Record<string, unknown>): Promise<void> {
  const event: AuditEvent = {
    id: randomUUID(),
    type,
    timestamp: new Date().toISOString(),
    payload,
  };
  await appendAuditEvent(auditLogPath, event);
}

async function readAuditEvents(): Promise<AuditEvent[]> {
  try {
    const raw = await readFile(auditLogPath, 'utf8');
    return raw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AuditEvent)
      .reverse();
  } catch {
    return [];
  }
}

// --- Route handlers ---

async function handleEvaluate(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await parseBody(req);
  const plan = JSON.parse(body) as ActionPlan;
  const policy = await readJsonFile<Policy>(policyPath);

  await auditLog('plan_submitted', { plan });

  const result = evaluatePlan(policy, plan, { spentToday: 0 });
  await auditLog('plan_evaluated', { plan, result });

  // Auto-create approval request if needed
  if (result.decision === 'approval_required') {
    const approval = createApproval(plan, result);
    await auditLog('approval_requested', { approval });
    return sendJson(res, 200, { result, approval });
  }

  return sendJson(res, 200, { result });
}

async function handleListApprovals(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(_req.url!, `http://localhost`);
  const status = url.searchParams.get('status') as 'pending' | 'approved' | 'denied' | null;
  const items = listApprovals(status ? { status } : undefined);
  return sendJson(res, 200, { approvals: items });
}

async function handleGetApproval(approvalId: string, res: ServerResponse): Promise<void> {
  const approval = getApproval(approvalId);
  if (!approval) return sendJson(res, 404, { error: 'Approval not found' });
  return sendJson(res, 200, { approval });
}

async function handleRespondApproval(
  approvalId: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const body = await parseBody(req);
  const { decision, respondedBy } = JSON.parse(body) as {
    decision: 'approved' | 'denied';
    respondedBy?: string;
  };

  if (decision !== 'approved' && decision !== 'denied') {
    return sendJson(res, 400, { error: 'Decision must be "approved" or "denied"' });
  }

  const approval = respondToApproval(approvalId, decision, respondedBy);
  if (!approval) {
    return sendJson(res, 404, { error: 'Approval not found or already resolved' });
  }

  const auditType = decision === 'approved' ? 'approval_granted' : 'approval_denied';
  await auditLog(auditType, { approval });

  return sendJson(res, 200, { approval });
}

async function handleAuditEvents(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const events = await readAuditEvents();
  return sendJson(res, 200, { events });
}

async function handleGetPolicy(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const policy = await readJsonFile<Policy>(policyPath);
  return sendJson(res, 200, { policy });
}

// --- Router ---

const server = createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, '');
  }

  const url = req.url ?? '';

  try {
    // Health
    if (req.method === 'GET' && url === '/health') {
      return sendJson(res, 200, { ok: true, service: 'synthesis-api' });
    }

    // Evaluate plan
    if (req.method === 'POST' && url === '/plans/evaluate') {
      return await handleEvaluate(req, res);
    }

    // Policy
    if (req.method === 'GET' && url === '/policy') {
      return await handleGetPolicy(req, res);
    }

    // List approvals
    if (req.method === 'GET' && url.startsWith('/approvals')) {
      const match = url.match(/^\/approvals\/([^/?]+)$/);
      if (match) {
        return await handleGetApproval(match[1], res);
      }
      return await handleListApprovals(req, res);
    }

    // Respond to approval
    if (req.method === 'POST' && url.match(/^\/approvals\/[^/]+\/respond$/)) {
      const approvalId = url.split('/')[2];
      return await handleRespondApproval(approvalId, req, res);
    }

    // Audit events
    if (req.method === 'GET' && url === '/audit') {
      return await handleAuditEvents(req, res);
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    return sendJson(res, 400, {
      error: 'Invalid request',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// --- Start ---

async function start(): Promise<void> {
  await loadApprovals(approvalsPath);
  const port = Number(process.env.PORT ?? 3001);
  server.listen(port, () => {
    console.log(`Synthesis API listening on http://localhost:${port}`);
  });
}

start();
