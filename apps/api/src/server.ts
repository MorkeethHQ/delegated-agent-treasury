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
import { createTreasuryDelegation, redeemTreasuryDelegation, signTreasuryDelegation, policyToCaveatMapping, describeDelegation, buildDelegationChain } from '../../../packages/executor/src/delegation.js';
import { resolveENS, reverseResolveENS, enrichWithENS, getENSIdentities } from '../../../packages/executor/src/ens.js';
import type { ActionPlan, AuditEvent, Policy, DistributionPlan, AgentProfile } from '../../../packages/shared/src/index.js';
import { loadStrategy, computeDistribution } from '../../../packages/strategy-engine/src/index.js';
import {
  getQuote,
  getIndicativeQuote,
  executeSwap,
  executeSwapLive,
  TOKENS,
} from '../../../packages/trading-engine/src/index.js';
import { createSynthesisGateway } from '../../../packages/x402-gateway/src/index.js';
import {
  getMoonPayConfig,
  getMoonPayStatus,
  executeMoonPaySwap,
  executeMoonPayDCA,
  getMoonPayQuote,
  getMoonPayBalance,
  executeMoonPayBridge,
  getMoonPayPortfolio,
  listMoonPayTools,
  type MoonPaySwapParams,
  type MoonPayDCAParams,
  type MoonPayBridgeParams,
} from '../../../packages/moonpay-bridge/src/index.js';

const root = process.cwd();
const policyPath = resolve(root, 'config', 'sample-policy.json');
const strategyPath = resolve(root, 'config', 'sample-yield-strategy.json');
const tradingStrategiesPath = resolve(root, 'config', 'sample-trading-strategies.json');
const agentsConfigPath = resolve(root, 'config', 'agents.json');
const auditLogPath = resolve(root, 'data', 'audit-events.jsonl');
const approvalsPath = resolve(root, 'data', 'approvals.json');

// --- Multi-agent state ---

let agentRegistry: AgentProfile[] = [];
const frozenAgents = new Set<string>();

async function loadAgentRegistry(): Promise<void> {
  try {
    const data = await readJsonFile<{ agents: AgentProfile[] }>(agentsConfigPath);
    agentRegistry = data.agents;
    console.log(`Agent registry loaded — ${agentRegistry.length} agents`);
  } catch {
    console.log('Agent registry not found — running without multi-agent config');
  }
}

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

async function computeSpentToday(): Promise<number> {
  const events = await readAuditEvents();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayMs = todayStart.getTime();
  let total = 0;
  for (const e of events) {
    if (new Date(e.timestamp).getTime() < todayMs) break; // events are reverse-chronological
    if (e.type === 'execution_result' && e.payload.plan) {
      const amount = (e.payload.plan as Record<string, unknown>).amount;
      if (typeof amount === 'number') total += amount;
    }
  }
  return total;
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

  const spentToday = await computeSpentToday();
  const result = evaluatePlan(policy, plan, { spentToday, recipientVerified, frozenAgents });
  await auditLog('plan_evaluated', { plan, result, recipientVerified });

  // Auto-execute if approved and executor is available
  if (result.decision === 'approved' && executor) {
    try {
      // Convert amount safely — handle scientific notation that parseEther can't
      const amountStr = Number(plan.amount).toFixed(18);
      const tx = await executor.spendYield(
        plan.destination as Address,
        parseEther(amountStr),
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
      const approvalAmountStr = Number(approval.plan.amount).toFixed(18);
      const tx = await executor.spendYield(
        approval.plan.destination as Address,
        parseEther(approvalAmountStr),
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
  const enriched = await enrichWithENS(state as unknown as Record<string, unknown>, ['agent']);
  return sendJson(res, 200, { treasury: enriched });
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

      const evalResult = evaluatePlan(policy, actionPlan, { spentToday: await computeSpentToday(), recipientVerified, frozenAgents });
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

    const evalResult = evaluatePlan(policy, plan, { spentToday: await computeSpentToday(), frozenAgents });
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
    if (!dryRun && executor) {
      // Live execution: sign and broadcast via the executor's wallet client
      const swapResult = await executeSwapLive(
        tokenIn,
        tokenOut,
        amount,
        executor.agentWalletClient,
      );
      await auditLog('execution_result', { plan, result: evalResult, swap: swapResult, live: true });
      return sendJson(res, 200, { result: evalResult, swap: swapResult, live: true });
    }

    if (!dryRun && !executor) {
      return sendJson(res, 503, {
        error: 'Live swap execution requires executor — set contract env vars',
        result: evalResult,
      });
    }

    // Dry run: quote only
    const swapperAddress = executor?.agentAddress ?? '0x0000000000000000000000000000000000000000';
    const swapResult = await executeSwap(tokenIn, tokenOut, amount, swapperAddress, true);
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

// --- Trading performance handlers ---

interface SwapRecord {
  timestamp: string;
  planId: string;
  agentId: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  reason: string;
  live: boolean;
  success: boolean;
}

async function handleTradingPerformance(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const events = await readAuditEvents();

    // Filter execution_result events that contain swap data
    const swapEvents = events.filter(
      (e) =>
        e.type === 'execution_result' &&
        e.payload &&
        ((e.payload as Record<string, unknown>).swap != null ||
         (e.payload as Record<string, unknown>).moonpaySwap != null),
    );

    const swaps: SwapRecord[] = [];
    let totalVolumeWei = BigInt(0);
    const tokenBreakdown: Record<string, { swaps: number; totalAmountIn: string; totalAmountOut: string }> = {};

    for (const event of swapEvents) {
      const payload = event.payload as Record<string, unknown>;
      const plan = payload.plan as Record<string, unknown> | undefined;
      const swap = (payload.swap ?? payload.moonpaySwap) as Record<string, unknown> | undefined;

      if (!swap) continue;

      const amountIn = String(swap.amountIn ?? '0');
      const amountOut = String(swap.amountOut ?? '0');
      const success = swap.success === true;
      const tokenOut = plan?.destination ? String(plan.destination) : 'unknown';
      const tokenIn = TOKENS.wstETH.address;
      const isLive = payload.live === true;

      const record: SwapRecord = {
        timestamp: event.timestamp,
        planId: plan?.planId ? String(plan.planId) : event.id,
        agentId: plan?.agentId ? String(plan.agentId) : 'unknown',
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        reason: plan?.reason ? String(plan.reason) : '',
        live: isLive,
        success,
      };

      swaps.push(record);

      if (success) {
        try {
          totalVolumeWei += BigInt(amountIn);
        } catch {
          // skip non-numeric amounts
        }

        if (!tokenBreakdown[tokenOut]) {
          tokenBreakdown[tokenOut] = { swaps: 0, totalAmountIn: '0', totalAmountOut: '0' };
        }
        tokenBreakdown[tokenOut].swaps += 1;
        try {
          tokenBreakdown[tokenOut].totalAmountIn = String(
            BigInt(tokenBreakdown[tokenOut].totalAmountIn) + BigInt(amountIn),
          );
          tokenBreakdown[tokenOut].totalAmountOut = String(
            BigInt(tokenBreakdown[tokenOut].totalAmountOut) + BigInt(amountOut),
          );
        } catch {
          // skip aggregation for non-numeric
        }
      }
    }

    const successfulSwaps = swaps.filter((s) => s.success);
    const liveSwaps = swaps.filter((s) => s.live && s.success);

    const performance = {
      summary: {
        totalSwapsExecuted: swaps.length,
        successfulSwaps: successfulSwaps.length,
        liveSwaps: liveSwaps.length,
        dryRunSwaps: successfulSwaps.length - liveSwaps.length,
        totalYieldDeployedWei: totalVolumeWei.toString(),
        totalYieldDeployedETH: (Number(totalVolumeWei) / 1e18).toFixed(6),
      },
      tokenBreakdown,
      recentSwaps: swaps.slice(0, 20),
      generatedAt: new Date().toISOString(),
    };

    return sendJson(res, 200, { performance });
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleTradingStrategies(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const data = await readJsonFile<{ strategies: Array<Record<string, unknown>> }>(tradingStrategiesPath);
    const events = await readAuditEvents();

    // Count swap executions per strategy token pair
    const swapCounts: Record<string, number> = {};
    for (const event of events) {
      if (event.type !== 'execution_result') continue;
      const payload = event.payload as Record<string, unknown>;
      const swap = payload.swap as Record<string, unknown> | undefined;
      const plan = payload.plan as Record<string, unknown> | undefined;
      if (!swap || !plan) continue;
      const tokenOut = String(plan.destination ?? '');
      swapCounts[tokenOut] = (swapCounts[tokenOut] ?? 0) + 1;
    }

    const strategies = data.strategies.map((s) => ({
      ...s,
      status: 'active',
      executedSwaps: swapCounts[String(s.tokenOut)] ?? 0,
    }));

    return sendJson(res, 200, {
      strategies,
      totalStrategies: strategies.length,
      note: 'Trading strategies define how accrued yield is autonomously deployed via Uniswap V3 on Base.',
    });
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

// --- Agent registry handlers ---

async function handleListAgents(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const agents = agentRegistry.map((a) => ({
    ...a,
    frozen: frozenAgents.has(a.agentId),
  }));
  return sendJson(res, 200, { agents });
}

async function handleGetAgent(agentId: string, res: ServerResponse): Promise<void> {
  const agent = agentRegistry.find((a) => a.agentId === agentId);
  if (!agent) return sendJson(res, 404, { error: 'Agent not found' });
  return sendJson(res, 200, { agent: { ...agent, frozen: frozenAgents.has(agent.agentId) } });
}

async function handleFreezeAgent(agentId: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await parseBody(req);
  const { requestedBy } = body ? JSON.parse(body) as { requestedBy?: string } : { requestedBy: undefined };

  // Verify the requester is an auditor or admin
  const requester = requestedBy ? agentRegistry.find((a) => a.agentId === requestedBy) : undefined;
  if (requester && requester.role !== 'auditor' && requester.role !== 'admin') {
    return sendJson(res, 403, { error: 'Only auditor or admin agents can freeze spending' });
  }

  const target = agentRegistry.find((a) => a.agentId === agentId);
  if (!target) return sendJson(res, 404, { error: 'Agent not found' });

  frozenAgents.add(agentId);
  await auditLog('plan_evaluated', { action: 'agent_frozen', agentId, requestedBy: requestedBy ?? 'api' });
  return sendJson(res, 200, {
    message: `Agent "${agentId}" is now frozen`,
    agentId,
    frozen: true,
    delegationRevocation: {
      action: 'disableDelegation(delegationHash)',
      contract: 'DelegationManager',
      effect: `All delegations held by or flowing through "${agentId}" are now invalid on-chain`,
      cascading: target.role === 'proposer'
        ? 'Cascading revocation: proposer freeze also invalidates executor sub-delegations'
        : 'Direct revocation: this agent\'s delegation is disabled',
      recovery: 'Admin must call POST /agents/{id}/unfreeze — a NEW delegation with fresh hash will be issued',
    },
  });
}

async function handleUnfreezeAgent(agentId: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await parseBody(req);
  const { requestedBy } = body ? JSON.parse(body) as { requestedBy?: string } : { requestedBy: undefined };

  // Only admin can unfreeze
  const requester = requestedBy ? agentRegistry.find((a) => a.agentId === requestedBy) : undefined;
  if (requester && requester.role !== 'admin') {
    return sendJson(res, 403, { error: 'Only admin agents can unfreeze spending' });
  }

  const target = agentRegistry.find((a) => a.agentId === agentId);
  if (!target) return sendJson(res, 404, { error: 'Agent not found' });

  frozenAgents.delete(agentId);
  await auditLog('plan_evaluated', { action: 'agent_unfrozen', agentId, requestedBy: requestedBy ?? 'api' });
  return sendJson(res, 200, {
    message: `Agent "${agentId}" is now unfrozen`,
    agentId,
    frozen: false,
    delegationRenewal: {
      action: 'New delegation created with fresh hash and updated timestamp caveats',
      note: 'The old delegation hash remains permanently revoked in the DelegationManager. This is an append-only revocation model — no hash is ever re-enabled.',
      newCaveats: 'Fresh TimestampEnforcer bounds, same AllowedTargets/Methods/TransferAmount caveats',
    },
  });
}

// --- MoonPay handlers ---

const moonpayConfigPath = resolve(root, 'config', 'moonpay-config.json');

async function handleMoonPayStatus(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const [config, status] = await Promise.all([
      getMoonPayConfig(moonpayConfigPath),
      getMoonPayStatus(),
    ]);
    return sendJson(res, 200, { config, status });
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleMoonPaySwap(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const body = await parseBody(req);
    const { agentId, fromToken, toToken, amount, chain, reason, dryRun = true } = JSON.parse(body) as {
      agentId: string;
      fromToken: string;
      toToken: string;
      amount: string;
      chain?: string;
      reason: string;
      dryRun?: boolean;
    };

    if (!agentId || !fromToken || !toToken || !amount || !reason) {
      return sendJson(res, 400, { error: 'Missing required fields: agentId, fromToken, toToken, amount, reason' });
    }

    // Evaluate through policy engine
    const policy = await readJsonFile<Policy>(policyPath);
    const plan: ActionPlan = {
      planId: `moonpay-swap-${Date.now()}`,
      agentId,
      type: 'swap',
      amount: 0,
      destination: toToken,
      reason: `[MoonPay] ${reason}`,
    };

    await auditLog('plan_submitted', { plan, moonpay: { fromToken, toToken, amount, chain, dryRun } });

    const evalResult = evaluatePlan(policy, plan, { spentToday: await computeSpentToday(), frozenAgents });
    await auditLog('plan_evaluated', { plan, result: evalResult });

    if (evalResult.decision === 'denied') {
      return sendJson(res, 403, { result: evalResult, message: 'MoonPay swap denied by policy engine' });
    }

    if (evalResult.decision === 'approval_required') {
      const approval = await createApproval(plan, evalResult);
      await auditLog('approval_requested', { approval });
      return sendJson(res, 200, { result: evalResult, approval, message: 'MoonPay swap requires approval' });
    }

    // Approved — execute via MoonPay bridge
    const swapParams: MoonPaySwapParams = {
      fromToken,
      toToken,
      amount,
      chain: chain ?? 'base',
    };

    const swapResult = await executeMoonPaySwap(swapParams, dryRun);
    await auditLog('execution_result', { plan, result: evalResult, moonpaySwap: swapResult });

    return sendJson(res, 200, { result: evalResult, swap: swapResult });
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleMoonPayTools(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const config = await getMoonPayConfig(moonpayConfigPath);
    const tools = listMoonPayTools();
    return sendJson(res, 200, {
      config: {
        enabled: config.enabled,
        supportedChains: config.supportedChains,
      },
      tools,
      totalTools: tools.length,
      note: 'MoonPay CLI exposes 54 crypto tools across 17 skills via MCP. Install: npm i -g @moonpay/cli && mp mcp',
    });
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleMoonPayQuote(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const reqUrl = new URL(req.url ?? '', `http://${req.headers.host}`);
    const fromToken = reqUrl.searchParams.get('fromToken');
    const toToken = reqUrl.searchParams.get('toToken');
    const amount = reqUrl.searchParams.get('amount');
    const chain = reqUrl.searchParams.get('chain');

    if (!fromToken || !toToken || !amount) {
      return sendJson(res, 400, { error: 'Missing required query params: fromToken, toToken, amount' });
    }

    const quoteResult = await getMoonPayQuote({
      fromToken,
      toToken,
      amount,
      chain: chain ?? 'base',
    });

    return sendJson(res, 200, quoteResult);
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleMoonPayBalance(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const reqUrl = new URL(req.url ?? '', `http://${req.headers.host}`);
    const token = reqUrl.searchParams.get('token');
    const chain = reqUrl.searchParams.get('chain');

    if (!token || !chain) {
      return sendJson(res, 400, { error: 'Missing required query params: token, chain' });
    }

    const balanceResult = await getMoonPayBalance(token, chain);
    return sendJson(res, 200, balanceResult);
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleMoonPayBridge(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const body = await parseBody(req);
    const { agentId, token, amount, fromChain, toChain, reason, dryRun = true } = JSON.parse(body) as {
      agentId: string;
      token: string;
      amount: string;
      fromChain: string;
      toChain: string;
      reason: string;
      dryRun?: boolean;
    };

    if (!agentId || !token || !amount || !fromChain || !toChain || !reason) {
      return sendJson(res, 400, { error: 'Missing required fields: agentId, token, amount, fromChain, toChain, reason' });
    }

    // Evaluate through policy engine
    const policy = await readJsonFile<Policy>(policyPath);
    const plan: ActionPlan = {
      planId: `moonpay-bridge-${Date.now()}`,
      agentId,
      type: 'swap',
      amount: 0,
      destination: toChain,
      reason: `[MoonPay Bridge] ${reason}`,
    };

    await auditLog('plan_submitted', { plan, moonpay: { token, amount, fromChain, toChain, dryRun } });

    const evalResult = evaluatePlan(policy, plan, { spentToday: await computeSpentToday(), frozenAgents });
    await auditLog('plan_evaluated', { plan, result: evalResult });

    if (evalResult.decision === 'denied') {
      return sendJson(res, 403, { result: evalResult, message: 'MoonPay bridge denied by policy engine' });
    }

    if (evalResult.decision === 'approval_required') {
      const approval = await createApproval(plan, evalResult);
      await auditLog('approval_requested', { approval });
      return sendJson(res, 200, { result: evalResult, approval, message: 'MoonPay bridge requires approval' });
    }

    // Approved — execute via MoonPay bridge
    const bridgeParams: MoonPayBridgeParams = { token, amount, fromChain, toChain };

    const bridgeResult = await executeMoonPayBridge(bridgeParams, dryRun);
    await auditLog('execution_result', { plan, result: evalResult, moonpayBridge: bridgeResult });

    return sendJson(res, 200, { result: evalResult, bridge: bridgeResult });
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleMoonPayPortfolio(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const portfolioResult = await getMoonPayPortfolio();
    return sendJson(res, 200, portfolioResult);
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

// --- Delegation handler ---

async function handleDelegationCreate(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const p = await readJsonFile<Policy>(policyPath);

    const treasuryAddr = process.env.TREASURY_ADDRESS;
    const wstethAddr = process.env.WSTETH_ADDRESS;
    const agentAddr = executor?.agentAddress;
    const ownerAddr = executor?.ownerAddress;

    if (!treasuryAddr || !wstethAddr || !agentAddr || !ownerAddr) {
      return sendJson(res, 400, { error: 'Executor not configured — delegation requires treasury + agent + owner' });
    }

    const delegation = createTreasuryDelegation({
      treasuryAddress: treasuryAddr as Address,
      wstETHAddress: wstethAddr as Address,
      agentAddress: agentAddr,
      allowedRecipients: p.allowedDestinations.map((d: string) => d as Address),
      maxPerTx: String(p.maxPerAction),
      maxTotal: String(p.dailyCap),
      maxCalls: 50,
      chain: (process.env.CHAIN as 'base' | 'base-sepolia') ?? 'base-sepolia',
    }, ownerAddr);

    const summary = describeDelegation(delegation);
    const caveatMap = policyToCaveatMapping();

    return sendJson(res, 200, {
      delegation: summary,
      caveatsCount: delegation.caveats.length,
      policyToCaveatMapping: caveatMap,
      note: 'MetaMask Delegation Framework — onchain enforcement of policy engine constraints. Defense-in-depth: offchain policy + onchain caveats.',
      framework: 'ERC-7710 / ERC-7715',
      sdk: '@metamask/smart-accounts-kit',
    });
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleDelegationInfo(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const policy = await readJsonFile<Policy>(policyPath);
    const treasuryAddr = process.env.TREASURY_ADDRESS;

    const chainResponse = buildDelegationChain(
      agentRegistry,
      {
        maxPerAction: policy.maxPerAction,
        dailyCap: policy.dailyCap,
        approvalThreshold: policy.approvalThreshold,
        allowedDestinations: policy.allowedDestinations,
      },
      frozenAgents,
      treasuryAddr,
    );

    // Augment with delegation execution status
    const delegationStatus = {
      executionEnabled: !!executor && !!process.env.OWNER_PRIVATE_KEY,
      lastExecutionTxHash: lastDelegationTxHash,
      caveatEnforcement: frozenAgents.size > 0
        ? 'degraded — one or more agents frozen, delegations revoked on-chain'
        : 'active — all delegation caveats enforced by DelegationManager',
      endpoint: 'POST /delegation/execute',
    };

    return sendJson(res, 200, { ...chainResponse, delegationStatus });
  } catch (error) {
    // Fallback: return basic info if policy can't be loaded
    const caveatMap = policyToCaveatMapping();
    return sendJson(res, 200, {
      framework: 'MetaMask Delegation Framework',
      standards: ['ERC-7710 (Delegation)', 'ERC-7715 (Intent-Based Permissions)'],
      sdk: '@metamask/smart-accounts-kit',
      description: 'Multi-agent delegation chain — see POST /delegation/create for live delegation.',
      caveatMapping: caveatMap,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// --- Delegation execution handler ---

/** Track last delegation execution TX for status reporting */
let lastDelegationTxHash: string | null = null;

async function handleDelegationExecute(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const body = await parseBody(req);
    const { to, amount, delegationMode } = JSON.parse(body) as {
      to: string;
      amount: number;
      delegationMode?: boolean;
    };

    if (!to || !amount) {
      return sendJson(res, 400, { error: 'Missing required fields: to, amount' });
    }

    if (!executor) {
      return sendJson(res, 400, { error: 'Executor not configured — delegation execution requires treasury + agent + owner' });
    }

    const treasuryAddr = process.env.TREASURY_ADDRESS;
    const wstethAddr = process.env.WSTETH_ADDRESS;
    const ownerKey = process.env.OWNER_PRIVATE_KEY;
    const chainEnv = (process.env.CHAIN as 'base' | 'base-sepolia') ?? 'base-sepolia';

    if (!treasuryAddr || !wstethAddr || !ownerKey) {
      return sendJson(res, 400, { error: 'Delegation execution requires TREASURY_ADDRESS, WSTETH_ADDRESS, and OWNER_PRIVATE_KEY' });
    }

    // Evaluate against policy first
    const policy = await readJsonFile<Policy>(policyPath);
    const plan: ActionPlan = {
      planId: `delegation-${Date.now()}`,
      agentId: 'executor',
      type: 'transfer',
      amount,
      destination: to,
      reason: 'Delegation-routed spendYield execution',
    };

    const spentToday = await computeSpentToday();
    const evalResult = evaluatePlan(policy, plan, { spentToday, frozenAgents });
    await auditLog('plan_evaluated', { plan, result: evalResult, delegationMode: true });

    if (evalResult.decision === 'denied') {
      return sendJson(res, 403, { result: evalResult, error: 'Plan denied by policy engine' });
    }

    if (evalResult.decision === 'approval_required') {
      const approval = await createApproval(plan, evalResult);
      await auditLog('approval_requested', { approval, delegationMode: true });
      return sendJson(res, 200, { result: evalResult, approval, delegationMode: true });
    }

    // Create and sign delegation, then redeem on-chain
    const amountStr = Number(amount).toFixed(18);
    const amountWei = parseEther(amountStr);

    const delegation = createTreasuryDelegation({
      treasuryAddress: treasuryAddr as Address,
      wstETHAddress: wstethAddr as Address,
      agentAddress: executor.agentAddress,
      allowedRecipients: policy.allowedDestinations.map((d: string) => d as Address),
      maxPerTx: String(policy.maxPerAction),
      maxTotal: String(policy.dailyCap),
      maxCalls: 50,
      chain: chainEnv,
    }, executor.ownerAddress!);

    const signedDelegation = await signTreasuryDelegation(
      delegation,
      ownerKey as `0x${string}`,
      chainEnv,
    );

    const txHash = await redeemTreasuryDelegation(
      signedDelegation,
      to as Address,
      amountWei,
      treasuryAddr as Address,
      executor.agentWalletClient,
      executor.publicClient,
      chainEnv,
    );

    lastDelegationTxHash = txHash;

    await auditLog('execution_result', {
      plan,
      result: evalResult,
      tx: { hash: txHash },
      delegationMode: true,
      delegationChain: 'owner → proposer → executor (ERC-7710)',
    });

    return sendJson(res, 200, {
      result: evalResult,
      execution: { hash: txHash },
      delegationMode: true,
      delegationChain: 'owner → proposer → executor',
      framework: 'MetaMask Delegation Framework (ERC-7710)',
    });
  } catch (error) {
    await auditLog('execution_result', {
      error: error instanceof Error ? error.message : String(error),
      delegationMode: true,
    });
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : String(error),
      delegationMode: true,
    });
  }
}

// --- Monitoring & Alerting handlers ---

// In-memory webhook registry (persists for server lifetime)
const registeredWebhooks: Array<{ url: string; events: string[]; registeredAt: string }> = [];

// Alert thresholds (configurable per-deployment)
const alertThresholds = {
  yieldMinimum: Number(process.env.ALERT_YIELD_MIN ?? 0.0001),
  spendVelocityMax: Number(process.env.ALERT_SPEND_VELOCITY ?? 5),  // max spends per hour
  principalDropPercent: Number(process.env.ALERT_PRINCIPAL_DROP ?? 5), // % drop triggers alert
  governanceRiskKeywords: ['withdrawal', 'parameter', 'upgrade', 'emergency', 'pause', 'slash'],
};

async function handleMonitoringStatus(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const policy = await readJsonFile<Policy>(policyPath);

  // Read audit events for daily spend and last activity
  let auditEvents: AuditEvent[] = [];
  try {
    const raw = await readFile(auditLogPath, 'utf-8');
    auditEvents = raw.trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as AuditEvent);
  } catch { /* no events yet */ }

  const now = Date.now();
  const oneDayAgo = now - 86400000;
  const dailyExecutions = auditEvents.filter(
    e => e.type === 'execution_result' && new Date(e.timestamp).getTime() > oneDayAgo,
  );

  // Sum daily spend from execution events
  let spentToday = 0;
  for (const ev of dailyExecutions) {
    const evData = ev as unknown as Record<string, unknown>;
    const amt = evData.amount ?? evData.value ?? (evData.result as Record<string, unknown> | undefined)?.amount;
    if (typeof amt === 'number') spentToday += amt;
    else if (typeof amt === 'string') spentToday += parseFloat(amt) || 0;
  }

  const dailyCap = typeof policy.dailyCap === 'number' ? policy.dailyCap : parseFloat(String(policy.dailyCap ?? '0')) || 0;
  const spentTodayPct = dailyCap > 0 ? Math.min(100, Math.round((spentToday / dailyCap) * 10000) / 100) : null;

  // Pending approvals count
  const pendingApprovals = listApprovals({ status: 'pending' });

  // Last activity timestamp
  const lastActivity = auditEvents.length > 0
    ? auditEvents[auditEvents.length - 1]!.timestamp
    : null;

  // Build comprehensive system status
  const status: Record<string, unknown> = {
    system: {
      uptime: process.uptime(),
      memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      executor: executor ? 'connected' : 'not configured',
      x402: x402.enabled ? 'enabled' : 'disabled',
      agents: agentRegistry.length,
      frozenAgents: [...frozenAgents],
    },
    policy: {
      maxPerAction: policy.maxPerAction,
      dailyCap: policy.dailyCap,
      approvalThreshold: policy.approvalThreshold,
      maxSwapPerAction: (policy as unknown as Record<string, unknown>).maxSwapPerAction,
      maxSlippageBps: (policy as unknown as Record<string, unknown>).maxSlippageBps,
    },
    spend: {
      spentToday,
      dailyCap,
      spentTodayPct,
      dailyExecutions: dailyExecutions.length,
    },
    approvalsPending: pendingApprovals.length,
    lastActivity,
    alertThresholds,
    webhooks: registeredWebhooks.length,
  };

  // Add treasury state if executor is connected
  if (executor) {
    try {
      const tState = await executor.treasuryState();
      const yieldNum = parseFloat(tState.availableYield.formatted);
      const principalNum = parseFloat(tState.principal.formatted);

      status.treasury = {
        availableYield: tState.availableYield.formatted,
        principal: tState.principal.formatted,
        totalSpent: tState.totalSpent.formatted,
        perTxCap: tState.perTxCap.formatted,
        chain: process.env.CHAIN ?? 'base-sepolia',
      };

      // Active alerts based on current state
      const alerts: Array<{ severity: string; type: string; message: string }> = [];

      if (yieldNum < alertThresholds.yieldMinimum) {
        alerts.push({
          severity: 'info',
          type: 'low_yield',
          message: `Available yield (${yieldNum.toFixed(8)}) below threshold (${alertThresholds.yieldMinimum})`,
        });
      }

      if (frozenAgents.size > 0) {
        alerts.push({
          severity: 'warning',
          type: 'frozen_agents',
          message: `${frozenAgents.size} agent(s) frozen: ${[...frozenAgents].join(', ')}`,
        });
      }

      if (principalNum === 0) {
        alerts.push({
          severity: 'critical',
          type: 'no_principal',
          message: 'No principal deposited — treasury is empty',
        });
      }

      status.activeAlerts = alerts;
      status.health = alerts.some(a => a.severity === 'critical') ? 'critical' : alerts.length > 0 ? 'warning' : 'healthy';
    } catch {
      status.treasury = { error: 'Failed to read on-chain state' };
      status.health = 'degraded';
    }
  } else {
    status.health = 'api-only';
  }

  return sendJson(res, 200, status);
}

async function handleMonitoringAlerts(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Read recent audit events to compute alerts
  let events: AuditEvent[] = [];
  try {
    const raw = await readFile(auditLogPath, 'utf-8');
    events = raw.trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as AuditEvent);
  } catch { /* no events yet */ }

  const now = Date.now();
  const oneHourAgo = now - 3600000;
  const oneDayAgo = now - 86400000;

  // Recent activity analysis
  const recentEvents = events.filter(e => new Date(e.timestamp).getTime() > oneHourAgo);
  const dailyEvents = events.filter(e => new Date(e.timestamp).getTime() > oneDayAgo);

  const recentSpends = recentEvents.filter(e => e.type === 'execution_result');
  const recentDenials = recentEvents.filter(e => e.type === 'plan_evaluated' && (e as unknown as Record<string, unknown>).decision === 'denied');
  const dailyApprovals = dailyEvents.filter(e => e.type === 'approval_granted');

  const alerts: Array<{ severity: string; type: string; message: string; data?: unknown }> = [];

  // Spend velocity check
  if (recentSpends.length > alertThresholds.spendVelocityMax) {
    alerts.push({
      severity: 'warning',
      type: 'high_spend_velocity',
      message: `${recentSpends.length} spends in last hour (threshold: ${alertThresholds.spendVelocityMax})`,
      data: { count: recentSpends.length, threshold: alertThresholds.spendVelocityMax },
    });
  }

  // Denial rate check
  if (recentDenials.length > 3) {
    alerts.push({
      severity: 'warning',
      type: 'high_denial_rate',
      message: `${recentDenials.length} denials in last hour — agent may be misconfigured`,
      data: { count: recentDenials.length },
    });
  }

  // Frozen agent check
  if (frozenAgents.size > 0) {
    alerts.push({
      severity: 'warning',
      type: 'frozen_agents',
      message: `Frozen agents: ${[...frozenAgents].join(', ')}`,
    });
  }

  // Principal protection alert — check if on-chain principal has dropped vs a reasonable baseline
  if (executor) {
    try {
      const tState = await executor.treasuryState();
      const principalNum = parseFloat(tState.principal.formatted);
      // Baseline: principal should be > 0; if it has dropped to near-zero flag it
      if (principalNum > 0 && principalNum < 0.01) {
        alerts.push({
          severity: 'critical',
          type: 'principal_protection',
          message: `Principal critically low (${tState.principal.formatted} ETH) — treasury may be draining`,
          data: { principal: tState.principal.formatted, threshold: '0.01' },
        });
      } else if (principalNum === 0) {
        alerts.push({
          severity: 'critical',
          type: 'principal_protection',
          message: 'Principal has reached zero — treasury is empty',
          data: { principal: '0' },
        });
      }
    } catch { /* executor unreachable — skip principal check */ }
  }

  // Approval timeout alert — flag any approvals pending for more than 1 hour
  const allPending = listApprovals({ status: 'pending' });
  const timedOutApprovals = allPending.filter(a => {
    const age = now - new Date(a.createdAt).getTime();
    return age > 3600000; // 1 hour
  });
  if (timedOutApprovals.length > 0) {
    alerts.push({
      severity: 'warning',
      type: 'approval_timeout',
      message: `${timedOutApprovals.length} approval(s) have been pending for more than 1 hour`,
      data: {
        count: timedOutApprovals.length,
        approvalIds: timedOutApprovals.map(a => a.approvalId),
        oldest: timedOutApprovals.reduce((oldest, a) =>
          a.createdAt < oldest ? a.createdAt : oldest, timedOutApprovals[0]!.createdAt),
      },
    });
  }

  return sendJson(res, 200, {
    alerts,
    summary: {
      totalEvents: events.length,
      lastHour: { spends: recentSpends.length, denials: recentDenials.length, total: recentEvents.length },
      lastDay: { approvals: dailyApprovals.length, total: dailyEvents.length },
      pendingApprovals: allPending.length,
      timedOutApprovals: timedOutApprovals.length,
    },
    thresholds: alertThresholds,
    note: 'Register webhooks via POST /monitoring/webhook to receive alerts programmatically.',
  });
}

async function handleWebhookRegister(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const raw = await parseBody(req);
  const body = JSON.parse(raw) as { url?: string; events?: string[] };
  const { url, events } = body;

  if (!url) {
    return sendJson(res, 400, { error: 'url is required' });
  }

  const webhook = {
    url,
    events: events ?? ['all'],
    registeredAt: new Date().toISOString(),
  };

  registeredWebhooks.push(webhook);

  // Fire a test webhook so the registrant can verify delivery
  let testDelivery: { success: boolean; statusCode?: number; error?: string } = { success: false };
  try {
    const testPayload = {
      event: 'webhook_test',
      message: 'Delegated Agent Treasury — webhook registration confirmed',
      registeredAt: webhook.registeredAt,
      subscribedEvents: webhook.events,
    };
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-treasury-event': 'webhook_test' },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(5000),
    });
    testDelivery = { success: resp.ok, statusCode: resp.status };
  } catch (err) {
    testDelivery = { success: false, error: err instanceof Error ? err.message : String(err) };
  }

  return sendJson(res, 201, {
    registered: true,
    webhook,
    testDelivery,
    supportedEvents: [
      'plan_evaluated',
      'approval_requested',
      'approval_granted',
      'approval_denied',
      'execution_result',
      'agent_frozen',
      'agent_unfrozen',
      'yield_threshold',
      'governance_risk',
    ],
    note: 'Webhook will receive POST requests with event payloads when matching events occur.',
  });
}

async function handleOnboardingStatus(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Agent self-discovery protocol — an agent calls this to understand its operating environment
  const capabilities: Array<{ id: string; capability: string; ready: boolean; detail: string; resolve?: string }> = [];

  // Capability 1: Treasury contract binding
  const treasuryAddr = process.env.TREASURY_ADDRESS;
  capabilities.push({
    id: 'treasury_contract',
    capability: 'On-chain treasury binding',
    ready: !!treasuryAddr,
    detail: treasuryAddr ? `Bound to ${treasuryAddr}` : 'No treasury contract — operating in simulation mode',
    resolve: treasuryAddr ? undefined : 'Set TREASURY_ADDRESS to bind to a deployed AgentTreasury',
  });

  // Capability 2: Yield asset awareness
  const yieldAsset = process.env.WSTETH_ADDRESS;
  capabilities.push({
    id: 'yield_asset',
    capability: 'Yield-bearing asset recognition',
    ready: !!yieldAsset,
    detail: yieldAsset ? `Tracking yield on ${yieldAsset}` : 'No yield asset configured — cannot compute yield',
    resolve: yieldAsset ? undefined : 'Set WSTETH_ADDRESS (wstETH on Base, stataUSDC on Celo)',
  });

  // Capability 3: Signing authority
  const agentKey = process.env.AGENT_PRIVATE_KEY;
  capabilities.push({
    id: 'signer',
    capability: 'Transaction signing authority',
    ready: !!agentKey,
    detail: agentKey ? `Signer active: ${executor?.agentAddress ?? 'key loaded'}` : 'No signing key — read-only mode',
    resolve: agentKey ? undefined : 'Provide AGENT_PRIVATE_KEY for autonomous execution',
  });

  // Capability 4: Treasury state (on-chain check)
  let depositReady = false;
  let depositDetail = 'Executor not connected — cannot verify on-chain state';
  if (executor) {
    try {
      const tState = await executor.treasuryState();
      const principalVal = parseFloat(tState.principal.formatted);
      depositReady = principalVal > 0;
      depositDetail = depositReady
        ? `Principal: ${tState.principal.formatted} | Yield: ${tState.availableYield.formatted}`
        : 'Treasury is empty — no principal deposited';
    } catch {
      depositDetail = 'On-chain read failed';
    }
  }
  capabilities.push({
    id: 'treasury_funded',
    capability: 'Funded treasury with accruing yield',
    ready: depositReady,
    detail: depositDetail,
  });

  // Capability 5: Policy engine
  let policyReady = false;
  try {
    await readJsonFile<Policy>(policyPath);
    policyReady = true;
  } catch { /* missing */ }
  capabilities.push({
    id: 'policy',
    capability: 'Spending policy enforcement',
    ready: policyReady,
    detail: policyReady ? 'Policy loaded — caps, thresholds, allowlists active' : 'No policy — all plans will be denied',
  });

  // Capability 6: Distribution strategy
  let strategyReady = false;
  try {
    await readJsonFile<unknown>(strategyPath);
    strategyReady = true;
  } catch { /* missing */ }
  capabilities.push({
    id: 'strategy',
    capability: 'Yield distribution strategy',
    ready: strategyReady,
    detail: strategyReady ? 'Multi-bucket strategy loaded' : 'No strategy — agent cannot compute distributions',
  });

  // Capability 7: Multi-agent coordination
  capabilities.push({
    id: 'agents',
    capability: 'Multi-agent role separation',
    ready: agentRegistry.length > 0,
    detail: agentRegistry.length > 0
      ? `${agentRegistry.length} agents: ${agentRegistry.map(a => `${a.agentId}(${a.role})`).join(', ')}`
      : 'Solo mode — no agent registry',
  });

  // Capability 8: Alerting pipeline
  capabilities.push({
    id: 'alerting',
    capability: 'Webhook alerting pipeline',
    ready: registeredWebhooks.length > 0,
    detail: registeredWebhooks.length > 0
      ? `${registeredWebhooks.length} webhook(s) active`
      : 'No webhooks — alerts only via GET /monitoring/alerts polling',
  });

  const readyCount = capabilities.filter(c => c.ready).length;
  const coreReady = capabilities.filter(c => ['treasury_contract', 'signer', 'policy', 'strategy'].includes(c.id)).every(c => c.ready);

  return sendJson(res, 200, {
    protocol: 'agent-self-discovery/v1',
    autonomous: coreReady,
    readiness: `${readyCount}/${capabilities.length} capabilities online`,
    mode: coreReady ? 'full-autonomous' : (readyCount >= 3 ? 'limited-autonomous' : 'simulation'),
    capabilities,
    bootSequence: {
      description: 'Agent bootstrap protocol — call in order to self-configure',
      steps: [
        { endpoint: 'GET /onboarding/status', purpose: 'Discover current capabilities and gaps' },
        { endpoint: 'GET /treasury', purpose: 'Read on-chain state — principal, yield, caps' },
        { endpoint: 'GET /policy', purpose: 'Load spending constraints and allowlists' },
        { endpoint: 'GET /strategy', purpose: 'Load yield distribution buckets' },
        { endpoint: 'GET /monitoring/alerts', purpose: 'Check for active issues before operating' },
        { endpoint: 'POST /plans/evaluate', purpose: 'Submit first action plan for policy check' },
        { endpoint: 'GET /monitoring/status', purpose: 'Continuous health loop' },
      ],
    },
  });
}

// --- ENS handlers ---

async function handleENSResolve(nameOrAddress: string, res: ServerResponse): Promise<void> {
  try {
    const result = await resolveENS(nameOrAddress);
    return sendJson(res, 200, result);
  } catch (error) {
    return sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleENSIdentities(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const identities = getENSIdentities();
  return sendJson(res, 200, {
    identities,
    owner: 'morke.eth',
    note: 'ENS subdomains under morke.eth provide human-readable identity for all treasury participants. Agents are identified by name, not hex address.',
  });
}

// --- x402 handlers ---

async function handleX402Pricing(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const pricing = x402.getPricingTable();
  const stats = x402.getPaymentStats();
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
    stats: {
      totalPayments: stats.totalPayments,
      totalUSDCEarned: stats.totalUSDCEarned,
      lastPaymentAt: stats.lastPaymentAt,
    },
    endpoints: pricing,
    freeEndpoints: [
      'GET /health',
      'GET /policy',
      'GET /treasury',
      'GET /swap/tokens',
      'GET /audit',
      'GET /x402/pricing',
      'GET /x402/receipts',
    ],
    usage: {
      description: 'Send requests with X-PAYMENT header containing a base64-encoded signed USDC TransferWithAuthorization payload. Requests without payment receive HTTP 402 with payment instructions.',
      docs: 'https://x402.org',
    },
  });
}

async function handleX402Receipts(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const receipts = x402.getReceipts();
  const stats = x402.getPaymentStats();
  return sendJson(res, 200, {
    stats: {
      totalPayments: stats.totalPayments,
      totalUSDCEarned: stats.totalUSDCEarned,
      totalAtomicEarned: stats.totalAtomicEarned,
      lastPaymentAt: stats.lastPaymentAt,
    },
    receipts,
    note: receipts.length === 0
      ? 'No payments received yet. Enable x402 gating with ENABLE_X402=true and send a request with a valid X-PAYMENT header.'
      : `${receipts.length} payment(s) verified and settled on Base mainnet.`,
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

    // --- x402 endpoints (always free) ---
    if (req.method === 'GET' && url === '/x402/pricing') {
      return await handleX402Pricing(req, res);
    }

    if (req.method === 'GET' && url === '/x402/receipts') {
      return await handleX402Receipts(req, res);
    }

    if (req.method === 'GET' && url === '/health') {
      return sendJson(res, 200, {
        ok: true,
        service: 'openbound-api',
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

    // --- Trading performance routes ---

    if (req.method === 'GET' && url === '/trading/performance') {
      return await handleTradingPerformance(req, res);
    }

    if (req.method === 'GET' && url === '/trading/strategies') {
      return await handleTradingStrategies(req, res);
    }

    // --- Agent registry routes ---

    if (req.method === 'GET' && url === '/agents') {
      return await handleListAgents(req, res);
    }

    if (req.method === 'GET' && url.match(/^\/agents\/[^/]+$/) && !url.includes('/freeze') && !url.includes('/unfreeze')) {
      const agentId = url.split('/agents/')[1]?.split('?')[0];
      if (agentId) return await handleGetAgent(agentId, res);
    }

    if (req.method === 'POST' && url.match(/^\/agents\/[^/]+\/freeze$/)) {
      const agentId = url.split('/agents/')[1]?.split('/freeze')[0];
      if (agentId) return await handleFreezeAgent(agentId, req, res);
    }

    if (req.method === 'POST' && url.match(/^\/agents\/[^/]+\/unfreeze$/)) {
      const agentId = url.split('/agents/')[1]?.split('/unfreeze')[0];
      if (agentId) return await handleUnfreezeAgent(agentId, req, res);
    }

    // --- MoonPay routes ---

    if (req.method === 'GET' && url === '/moonpay/status') {
      return await handleMoonPayStatus(req, res);
    }

    if (req.method === 'POST' && url === '/moonpay/swap') {
      return await handleMoonPaySwap(req, res);
    }

    if (req.method === 'GET' && url === '/moonpay/tools') {
      return await handleMoonPayTools(req, res);
    }

    if (req.method === 'GET' && url.startsWith('/moonpay/quote')) {
      return await handleMoonPayQuote(req, res);
    }

    if (req.method === 'GET' && url.startsWith('/moonpay/balance')) {
      return await handleMoonPayBalance(req, res);
    }

    if (req.method === 'POST' && url === '/moonpay/bridge') {
      return await handleMoonPayBridge(req, res);
    }

    if (req.method === 'GET' && url === '/moonpay/portfolio') {
      return await handleMoonPayPortfolio(req, res);
    }

    // --- Delegation routes ---

    if (req.method === 'GET' && url === '/delegation') {
      return await handleDelegationInfo(req, res);
    }

    if (req.method === 'POST' && url === '/delegation/create') {
      return await handleDelegationCreate(req, res);
    }

    if (req.method === 'POST' && url === '/delegation/execute') {
      return await handleDelegationExecute(req, res);
    }

    // --- Monitoring & Alerting routes ---

    if (req.method === 'GET' && url === '/monitoring/status') {
      return await handleMonitoringStatus(req, res);
    }

    if (req.method === 'GET' && url === '/monitoring/alerts') {
      return await handleMonitoringAlerts(req, res);
    }

    if (req.method === 'POST' && url === '/monitoring/webhook') {
      return await handleWebhookRegister(req, res);
    }

    if (req.method === 'GET' && url === '/onboarding/status') {
      return await handleOnboardingStatus(req, res);
    }

    // --- ENS routes ---

    if (req.method === 'GET' && url === '/ens/identities') {
      return await handleENSIdentities(req, res);
    }

    if (req.method === 'GET' && url.startsWith('/ens/resolve/')) {
      const nameOrAddress = decodeURIComponent(url.split('/ens/resolve/')[1]?.split('?')[0] ?? '');
      if (nameOrAddress) return await handleENSResolve(nameOrAddress, res);
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
  await loadAgentRegistry();
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
