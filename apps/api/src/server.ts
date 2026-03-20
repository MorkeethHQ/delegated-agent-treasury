import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { parseEther, type Address } from 'viem';
import { appendAuditEvent } from '../../../packages/audit-log/src/index.js';
import { evaluatePlan } from '../../../packages/policy-engine/src/index.js';
import {
  loadApprovals,
  createApproval,
  getApproval,
  listApprovals,
  respondToApproval,
} from '../../../packages/approval-store/src/index.js';
import { createExecutor, type Executor } from '../../../packages/executor/src/index.js';
import { verifyCounterpartyIdentity } from '../../../packages/executor/src/erc8004.js';
import type { ActionPlan, AuditEvent, Policy, DistributionPlan } from '../../../packages/shared/src/index.js';
import { loadStrategy, computeDistribution } from '../../../packages/strategy-engine/src/index.js';
import {
  getQuote,
  getIndicativeQuote,
  executeSwap,
  TOKENS,
} from '../../../packages/trading-engine/src/index.js';
import { createSynthesisGateway } from '../../../packages/x402-gateway/src/index.js';

const root = process.cwd();
const policyPath = resolve(root, 'config', 'sample-policy.json');
const strategyPath = resolve(root, 'config', 'sample-yield-strategy.json');
const tradingStrategiesPath = resolve(root, 'config', 'sample-trading-strategies.json');
const auditLogPath = resolve(root, 'data', 'audit-events.jsonl');
const approvalsPath = resolve(root, 'data', 'approvals.json');

// --- x402 Payment Gateway ---

const x402 = createSynthesisGateway();

// --- Executor (optional — only if contract env vars are set) ---

let executor: Executor | null = null;

function initExecutor(): void {
  const treasury = process.env.TREASURY_ADDRESS;
  const wsteth = process.env.WSTETH_ADDRESS;
  const rpc = process.env.RPC_URL ?? process.env.BASE_SEPOLIA_RPC;
  const agentKey = process.env.AGENT_PRIVATE_KEY;

  if (treasury && wsteth && rpc && agentKey) {
    executor = createExecutor({
      treasuryAddress: treasury as Address,
      wstETHAddress: wsteth as Address,
      rpcUrl: rpc,
      agentPrivateKey: agentKey as `0x${string}`,
      ownerPrivateKey: process.env.OWNER_PRIVATE_KEY as `0x${string}` | undefined,
      chain: (process.env.CHAIN as 'base-sepolia' | 'base') ?? 'base-sepolia',
    });
    console.log(`Executor initialized — agent: ${executor.agentAddress}`);
  } else {
    console.log('Executor not configured (missing env vars) — running in API-only mode');
  }
}

// --- Helpers ---

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
  res.end(JSON.stringify(body, (_key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
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

  // ERC-8004 trust-gated identity verification
  let recipientVerified: boolean | undefined;
  if (policy.requireVerifiedIdentity) {
    const identity = await verifyCounterpartyIdentity(plan.destination);
    recipientVerified = identity.verified;
    if (!identity.verified) {
      console.log(`[ERC-8004] Recipient ${plan.destination} is not verified`);
    } else {
      console.log(`[ERC-8004] Recipient ${plan.destination} verified — agent #${identity.agentId}`);
    }
  }

  const result = evaluatePlan(policy, plan, { spentToday: 0, recipientVerified });
  await auditLog('plan_evaluated', { plan, result, recipientVerified });

  // Auto-execute if approved and executor is available
  if (result.decision === 'approved' && executor) {
    try {
      const tx = await executor.spendYield(
        plan.destination as Address,
        parseEther(String(plan.amount)),
      );
      await auditLog('execution_result', { plan, result, tx });
      return sendJson(res, 200, { result, execution: tx });
    } catch (error) {
      await auditLog('execution_result', {
        plan,
        result,
        error: error instanceof Error ? error.message : String(error),
      });
      return sendJson(res, 200, { result, executionError: error instanceof Error ? error.message : String(error) });
    }
  }

  // Create approval request if needed
  if (result.decision === 'approval_required') {
    const approval = await createApproval(plan, result);
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

  const approval = await respondToApproval(approvalId, decision, respondedBy);
  if (!approval) {
    return sendJson(res, 404, { error: 'Approval not found or already resolved' });
  }

  const auditType = decision === 'approved' ? 'approval_granted' : 'approval_denied';
  await auditLog(auditType, { approval });

  // Execute on-chain if approved and executor available
  if (decision === 'approved' && executor) {
    try {
      const tx = await executor.spendYield(
        approval.plan.destination as Address,
        parseEther(String(approval.plan.amount)),
      );
      await auditLog('execution_result', { approval, tx });
      return sendJson(res, 200, { approval, execution: tx });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await auditLog('execution_result', { approval, error: msg });
      return sendJson(res, 200, { approval, executionError: msg });
    }
  }

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

async function handleVerifyIdentity(address: string, res: ServerResponse): Promise<void> {
  const identity = await verifyCounterpartyIdentity(address);
  return sendJson(res, 200, { address, identity });
}

async function handleTreasuryState(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!executor) {
    return sendJson(res, 503, { error: 'Executor not configured — set contract env vars' });
  }
  const state = await executor.treasuryState();
  return sendJson(res, 200, { treasury: state });
}

// --- Strategy handlers ---

async function handleGetStrategy(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const strategy = await loadStrategy(strategyPath);
    return sendJson(res, 200, { strategy });
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleStrategyPreview(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const strategy = await loadStrategy(strategyPath);
    const reqUrl = new URL(req.url ?? '', `http://${req.headers.host}`);
    const yieldParam = reqUrl.searchParams.get('yield');
    const capParam = reqUrl.searchParams.get('perTxCap');

    let availableYield: number;
    let perTxCap: number;

    if (yieldParam && capParam) {
      // Use query params for dry-run preview (works without executor)
      availableYield = parseFloat(yieldParam);
      perTxCap = parseFloat(capParam);
    } else if (executor) {
      // Use live treasury state
      const state = await executor.treasuryState();
      availableYield = parseFloat(state.availableYield.formatted);
      perTxCap = parseFloat(state.perTxCap.formatted);
    } else {
      return sendJson(res, 503, { error: 'Provide ?yield=X&perTxCap=Y or configure executor' });
    }

    const plan = computeDistribution(strategy, availableYield, perTxCap);
    return sendJson(res, 200, { plan });
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleStrategyDistribute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!executor) {
    return sendJson(res, 503, { error: 'Executor not configured — set contract env vars' });
  }

  try {
    const strategy = await loadStrategy(strategyPath);
    const state = await executor.treasuryState();
    const availableYield = parseFloat(state.availableYield.formatted);
    const perTxCap = parseFloat(state.perTxCap.formatted);
    const plan = computeDistribution(strategy, availableYield, perTxCap);

    if (plan.items.length === 0) {
      return sendJson(res, 200, { plan, results: [], message: 'No items to distribute' });
    }

    const policy = await readJsonFile<Policy>(policyPath);
    const results: Array<{ bucketId: string; decision: string; execution?: unknown; error?: string }> = [];

    for (const item of plan.items) {
      const actionPlan: ActionPlan = {
        planId: `strategy-${item.bucketId}-${Date.now()}`,
        agentId: strategy.agentId,
        type: 'transfer',
        amount: item.amount,
        destination: item.destination,
        reason: `Yield distribution [${strategy.strategyId}] bucket "${item.bucketLabel}" (${item.percentage}%)`,
      };

      await auditLog('plan_submitted', { plan: actionPlan });

      let recipientVerified: boolean | undefined;
      if (policy.requireVerifiedIdentity) {
        const identity = await verifyCounterpartyIdentity(actionPlan.destination);
        recipientVerified = identity.verified;
      }

      const evalResult = evaluatePlan(policy, actionPlan, { spentToday: 0, recipientVerified });
      await auditLog('plan_evaluated', { plan: actionPlan, result: evalResult });

      if (evalResult.decision === 'approved' && executor) {
        try {
          const tx = await executor.spendYield(
            actionPlan.destination as Address,
            parseEther(String(actionPlan.amount)),
          );
          await auditLog('execution_result', { plan: actionPlan, result: evalResult, tx });
          results.push({ bucketId: item.bucketId, decision: evalResult.decision, execution: tx });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          await auditLog('execution_result', { plan: actionPlan, result: evalResult, error: msg });
          results.push({ bucketId: item.bucketId, decision: evalResult.decision, error: msg });
        }
      } else if (evalResult.decision === 'approval_required') {
        const approval = await createApproval(actionPlan, evalResult);
        await auditLog('approval_requested', { approval });
        results.push({ bucketId: item.bucketId, decision: evalResult.decision });
      } else {
        results.push({ bucketId: item.bucketId, decision: evalResult.decision });
      }
    }

    return sendJson(res, 200, { plan, results });
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

// --- Swap / Trading handlers ---

async function handleSwapQuote(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const reqUrl = new URL(req.url ?? '', `http://${req.headers.host}`);
  const tokenIn = reqUrl.searchParams.get('tokenIn');
  const tokenOut = reqUrl.searchParams.get('tokenOut');
  const amount = reqUrl.searchParams.get('amount');

  if (!tokenIn || !tokenOut || !amount) {
    return sendJson(res, 400, { error: 'Missing required query params: tokenIn, tokenOut, amount' });
  }

  try {
    const quote = await getIndicativeQuote(tokenIn, tokenOut, amount);
    return sendJson(res, 200, { quote });
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleSwapExecute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const body = await parseBody(req);
    const { agentId, tokenOut, amount, reason, dryRun = true } = JSON.parse(body) as {
      agentId: string;
      tokenOut: string;
      amount: string;
      strategy?: string;
      reason: string;
      dryRun?: boolean;
    };

    if (!agentId || !tokenOut || !amount || !reason) {
      return sendJson(res, 400, { error: 'Missing required fields: agentId, tokenOut, amount, reason' });
    }

    // Default tokenIn is wstETH
    const tokenIn = TOKENS.wstETH.address;

    // Evaluate through policy engine
    const policy = await readJsonFile<Policy>(policyPath);
    const plan: ActionPlan = {
      planId: `swap-${Date.now()}`,
      agentId,
      type: 'swap',
      amount: 0, // policy uses number; we pass 0 and rely on the swap amount
      destination: tokenOut,
      reason,
    };

    await auditLog('plan_submitted', { plan, swapDetails: { tokenIn, tokenOut, amount, dryRun } });

    const evalResult = evaluatePlan(policy, plan, { spentToday: 0 });
    await auditLog('plan_evaluated', { plan, result: evalResult });

    if (evalResult.decision === 'denied') {
      return sendJson(res, 403, { result: evalResult, message: 'Swap denied by policy engine' });
    }

    if (evalResult.decision === 'approval_required') {
      const approval = await createApproval(plan, evalResult);
      await auditLog('approval_requested', { approval });
      return sendJson(res, 200, { result: evalResult, approval, message: 'Swap requires approval' });
    }

    // Approved — get quote and optionally execute
    const swapperAddress = executor?.agentAddress ?? '0x0000000000000000000000000000000000000000';
    const swapResult = await executeSwap(tokenIn, tokenOut, amount, swapperAddress, dryRun);
    await auditLog('execution_result', { plan, result: evalResult, swap: swapResult });

    return sendJson(res, 200, { result: evalResult, swap: swapResult });
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleSwapTokens(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  return sendJson(res, 200, { tokens: TOKENS, chainId: 8453, chain: 'base' });
}

async function handleSwapStrategies(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const strategies = await readJsonFile<unknown>(tradingStrategiesPath);
    return sendJson(res, 200, strategies);
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

// --- x402 Pricing handler ---

async function handleX402Pricing(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const pricing = x402.getPricingTable();
  return sendJson(res, 200, {
    x402: {
      enabled: x402.enabled,
      protocol: 'https://x402.org',
      version: 1,
      network: 'base',
      chainId: 8453,
      asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      assetSymbol: 'USDC',
      payTo: '0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6',
    },
    endpoints: pricing,
    freeEndpoints: [
      'GET /health',
      'GET /policy',
      'GET /treasury',
      'GET /swap/tokens',
      'GET /audit',
      'GET /x402/pricing',
    ],
    usage: {
      description: 'Send requests with X-PAYMENT header containing a base64-encoded signed USDC TransferWithAuthorization payload. Requests without payment receive HTTP 402 with payment instructions.',
      docs: 'https://x402.org',
    },
  });
}

// --- Router ---

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    // Include x-payment in allowed headers for CORS preflight
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, PUT, PATCH, OPTIONS',
      'access-control-allow-headers': 'content-type, x-payment',
      'access-control-expose-headers': 'x-payment-required, x-payment-response',
    });
    res.end();
    return;
  }

  const url = req.url ?? '';

  try {
    // x402 payment gating — check before routing to paid endpoints
    const handled = await x402.handlePaymentGating(req, res);
    if (handled) return;

    // --- x402 pricing endpoint (always free) ---
    if (req.method === 'GET' && url === '/x402/pricing') {
      return await handleX402Pricing(req, res);
    }

    if (req.method === 'GET' && url === '/health') {
      return sendJson(res, 200, {
        ok: true,
        service: 'synthesis-api',
        executor: executor ? 'connected' : 'not configured',
        x402: x402.enabled ? 'enabled' : 'disabled',
      });
    }

    if (req.method === 'POST' && url === '/plans/evaluate') {
      return await handleEvaluate(req, res);
    }

    if (req.method === 'GET' && url === '/policy') {
      return await handleGetPolicy(req, res);
    }

    if (req.method === 'GET' && url === '/treasury') {
      return await handleTreasuryState(req, res);
    }

    if (req.method === 'GET' && url === '/strategy') {
      return await handleGetStrategy(req, res);
    }

    if (req.method === 'GET' && (url === '/strategy/preview' || url.startsWith('/strategy/preview?'))) {
      return await handleStrategyPreview(req, res);
    }

    if (req.method === 'POST' && url === '/strategy/distribute') {
      return await handleStrategyDistribute(req, res);
    }

    if (req.method === 'GET' && url.startsWith('/verify/')) {
      const address = url.split('/verify/')[1]?.split('?')[0];
      if (address) {
        return await handleVerifyIdentity(address, res);
      }
    }

    if (req.method === 'GET' && url.startsWith('/approvals')) {
      const match = url.match(/^\/approvals\/([^/?]+)$/);
      if (match) {
        return await handleGetApproval(match[1], res);
      }
      return await handleListApprovals(req, res);
    }

    if (req.method === 'POST' && url.match(/^\/approvals\/[^/]+\/respond$/)) {
      const approvalId = url.split('/')[2];
      return await handleRespondApproval(approvalId, req, res);
    }

    if (req.method === 'GET' && url === '/audit') {
      return await handleAuditEvents(req, res);
    }

    // --- Swap / Trading routes ---

    if (req.method === 'GET' && url.startsWith('/swap/quote')) {
      return await handleSwapQuote(req, res);
    }

    if (req.method === 'POST' && url === '/swap/execute') {
      return await handleSwapExecute(req, res);
    }

    if (req.method === 'GET' && url === '/swap/tokens') {
      return await handleSwapTokens(req, res);
    }

    if (req.method === 'GET' && url === '/swap/strategies') {
      return await handleSwapStrategies(req, res);
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
  initExecutor();
  const port = Number(process.env.PORT ?? 3001);
  server.listen(port, () => {
    console.log(`Synthesis API listening on http://localhost:${port}`);
    if (x402.enabled) {
      console.log(`x402 payment gating ENABLED — paid endpoints require USDC on Base`);
    } else {
      console.log(`x402 payment gating disabled (set ENABLE_X402=true to enable)`);
    }
  });
}

start();
