import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { appendAuditEvent } from '../../../packages/audit-log/src/index.js';
import { evaluatePlan } from '../../../packages/policy-engine/src/index.js';
import type { ActionPlan, AuditEvent, Policy } from '../../../packages/shared/src/index.js';

const root = process.cwd();
const policyPath = resolve(root, 'config', 'sample-policy.json');
const auditLogPath = resolve(root, 'data', 'audit-events.jsonl');

async function readJsonFile<T>(path: string): Promise<T> {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as T;
}

function sendJson(res: any, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body, null, 2));
}

const server = createServer(async (req, res) => {
  if (!req.url) {
    return sendJson(res, 400, { error: 'Missing URL' });
  }

  if (req.method === 'GET' && req.url === '/health') {
    return sendJson(res, 200, { ok: true, service: 'synthesis-api' });
  }

  if (req.method === 'POST' && req.url === '/plans/evaluate') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const plan = JSON.parse(body) as ActionPlan;
        const policy = await readJsonFile<Policy>(policyPath);
        const result = evaluatePlan(policy, plan, { spentToday: 0 });

        const event: AuditEvent = {
          id: randomUUID(),
          type: 'plan_evaluated',
          timestamp: new Date().toISOString(),
          payload: {
            plan,
            result,
          },
        };

        await appendAuditEvent(auditLogPath, event);
        return sendJson(res, 200, result);
      } catch (error) {
        return sendJson(res, 400, {
          error: 'Invalid request',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });
    return;
  }

  return sendJson(res, 404, { error: 'Not found' });
});

const port = Number(process.env.PORT ?? 3001);
server.listen(port, () => {
  console.log(`Synthesis API listening on http://localhost:${port}`);
});
