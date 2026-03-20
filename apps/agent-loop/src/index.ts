/**
 * Autonomous Agent Loop
 *
 * Governance-aware yield spending agent.
 * Monitors treasury state + Lido governance, fuses signals into
 * autonomous spend/hold decisions — all bounded by the policy engine.
 *
 * Loop:  check treasury -> check governance -> decide -> act -> sleep -> repeat
 */

import { resolve } from 'node:path';
import { access } from 'node:fs/promises';
import { loadStrategy, computeDistribution } from '../../../packages/strategy-engine/src/index.js';
import type { YieldStrategyConfig } from '../../../packages/shared/src/index.js';

const API = process.env.API_URL ?? 'http://localhost:3001';
const INTERVAL_MS = Number(process.env.LOOP_INTERVAL_MS ?? 5 * 60 * 1000); // 5 min default
const YIELD_THRESHOLD = Number(process.env.YIELD_THRESHOLD ?? 0.001); // min wstETH to trigger spend
const SPEND_RECIPIENT = process.env.SPEND_RECIPIENT ?? '';
const AGENT_ID = process.env.AGENT_ID ?? 'bagel';
const SNAPSHOT_GRAPHQL = 'https://hub.snapshot.org/graphql';

// --- Helpers ---

async function api<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, opts);
  return (await res.json()) as T;
}

interface TreasuryState {
  treasury: {
    availableYield: { raw: string; formatted: string };
    principal: { raw: string; formatted: string };
    totalSpent: { raw: string; formatted: string };
    perTxCap: { raw: string; formatted: string };
  };
  error?: string;
}

interface EvalResult {
  result: { decision: string; reasons: string[] };
  approval?: { approvalId: string };
  execution?: { hash: string };
  executionError?: string;
}

interface Proposal {
  title: string;
  state: string;
  end: number;
}

function log(level: string, msg: string, data?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  const extra = data ? ' ' + JSON.stringify(data) : '';
  console.log(`[${ts}] [${level}] ${msg}${extra}`);
}

// --- Strategy loader ---

async function tryLoadStrategy(): Promise<YieldStrategyConfig | null> {
  const strategyPath = resolve(process.cwd(), 'config', 'sample-yield-strategy.json');
  try {
    await access(strategyPath);
    return await loadStrategy(strategyPath);
  } catch {
    return null;
  }
}

// --- Governance check ---

async function getActiveGovernance(): Promise<Proposal[]> {
  const query = `query { proposals(where: { space: "lido-snapshot.eth", state: "active" }, first: 10, orderBy: "created", orderDirection: desc) { title state end } }`;
  try {
    const res = await fetch(SNAPSHOT_GRAPHQL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const json = (await res.json()) as { data?: { proposals: Proposal[] } };
    return json.data?.proposals ?? [];
  } catch {
    log('WARN', 'Governance check failed — proceeding without');
    return [];
  }
}

function isRiskyProposal(p: Proposal): boolean {
  const risky = ['withdrawal', 'parameter', 'upgrade', 'emergency', 'pause', 'slash'];
  const lower = p.title.toLowerCase();
  return risky.some((kw) => lower.includes(kw));
}

// --- Core loop ---

async function tick(): Promise<void> {
  log('INFO', '── tick ──');

  // 1. Check treasury
  let treasury: TreasuryState;
  try {
    treasury = await api<TreasuryState>('/treasury');
  } catch {
    log('WARN', 'API unreachable — skipping tick');
    return;
  }

  if (treasury.error) {
    log('WARN', 'Executor not configured — API-only mode');
    return;
  }

  const yieldAvailable = parseFloat(treasury.treasury.availableYield.formatted);
  const principal = parseFloat(treasury.treasury.principal.formatted);
  const perTxCap = parseFloat(treasury.treasury.perTxCap.formatted);
  log('INFO', 'Treasury state', { yield: yieldAvailable, principal });

  // 2. Check governance
  const active = await getActiveGovernance();
  const risky = active.filter(isRiskyProposal);

  if (active.length > 0) {
    log('INFO', `Active governance proposals: ${active.length}`, {
      titles: active.map((p) => p.title),
    });
  }

  if (risky.length > 0) {
    log('HOLD', 'Risky governance detected — pausing yield spending', {
      proposals: risky.map((p) => p.title),
    });
    return;
  }

  // 3. Try multi-bucket strategy first, fall back to single-recipient
  const strategy = await tryLoadStrategy();

  if (strategy) {
    await tickWithStrategy(strategy, yieldAvailable, perTxCap);
  } else {
    await tickSingleRecipient(yieldAvailable, perTxCap);
  }
}

// --- Multi-bucket distribution ---

async function tickWithStrategy(
  strategy: YieldStrategyConfig,
  yieldAvailable: number,
  perTxCap: number,
): Promise<void> {
  log('INFO', `Using yield strategy: ${strategy.strategyId} (${strategy.buckets.length} buckets)`);

  const plan = computeDistribution(strategy, yieldAvailable, perTxCap);

  if (plan.items.length === 0) {
    const reasons = plan.skippedItems.map((s) => `${s.bucketId}: ${s.reason}`).join('; ');
    log('SKIP', `No distribution items — ${reasons}`);
    return;
  }

  log('INFO', `Distribution plan: ${plan.items.length} items, total ${plan.totalToDistribute.toFixed(6)} wstETH`);

  for (const item of plan.items) {
    log('INFO', `Submitting bucket "${item.bucketLabel}": ${item.amount.toFixed(6)} wstETH -> ${item.destination}`);

    try {
      const result = await api<EvalResult>('/plans/evaluate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          planId: `auto-${item.bucketId}-${Date.now()}`,
          agentId: strategy.agentId,
          type: 'transfer',
          amount: item.amount,
          destination: item.destination,
          reason: `Yield distribution [${strategy.strategyId}] bucket "${item.bucketLabel}" (${item.percentage}%) — ${yieldAvailable.toFixed(6)} available`,
        }),
      });

      log('INFO', `Bucket "${item.bucketLabel}" policy decision: ${result.result.decision}`, {
        reasons: result.result.reasons,
      });

      if (result.execution) {
        log('INFO', `Bucket "${item.bucketLabel}" executed on-chain: ${result.execution.hash}`);
      } else if (result.approval) {
        log('INFO', `Bucket "${item.bucketLabel}" approval required: ${result.approval.approvalId}`);
      } else if (result.executionError) {
        log('WARN', `Bucket "${item.bucketLabel}" execution failed: ${result.executionError}`);
      }
    } catch (err) {
      log('ERROR', `Bucket "${item.bucketLabel}" failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (plan.skippedItems.length > 0) {
    log('INFO', `Skipped buckets: ${plan.skippedItems.map((s) => `${s.bucketId}: ${s.reason}`).join('; ')}`);
  }
}

// --- Single-recipient fallback (original logic) ---

async function tickSingleRecipient(yieldAvailable: number, perTxCap: number): Promise<void> {
  if (yieldAvailable < YIELD_THRESHOLD) {
    log('SKIP', `Yield ${yieldAvailable} below threshold ${YIELD_THRESHOLD}`);
    return;
  }

  if (!SPEND_RECIPIENT) {
    log('SKIP', 'No SPEND_RECIPIENT configured and no strategy file — dry run only');
    return;
  }

  // Submit plan through policy engine
  const spendAmount = Math.min(yieldAvailable * 0.5, perTxCap);
  log('INFO', `Submitting spend plan: ${spendAmount} wstETH -> ${SPEND_RECIPIENT}`);

  const result = await api<EvalResult>('/plans/evaluate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      planId: `auto-${Date.now()}`,
      agentId: AGENT_ID,
      type: 'transfer',
      amount: spendAmount,
      destination: SPEND_RECIPIENT,
      reason: `Autonomous yield spend — ${yieldAvailable.toFixed(6)} available, no risky governance`,
    }),
  });

  log('INFO', `Policy decision: ${result.result.decision}`, {
    reasons: result.result.reasons,
  });

  if (result.execution) {
    log('INFO', `Executed on-chain: ${result.execution.hash}`);
  } else if (result.approval) {
    log('INFO', `Approval required: ${result.approval.approvalId}`);
  } else if (result.executionError) {
    log('WARN', `Execution failed: ${result.executionError}`);
  }
}

// --- Main ---

async function main(): Promise<void> {
  log('INFO', '=== Autonomous Agent Loop started ===');
  log('INFO', `API: ${API} | Interval: ${INTERVAL_MS / 1000}s | Threshold: ${YIELD_THRESHOLD} wstETH`);
  log('INFO', `Recipient: ${SPEND_RECIPIENT || '(none — dry run)'} | Agent: ${AGENT_ID}`);

  // Run first tick immediately
  await tick();

  // Then loop
  setInterval(async () => {
    try {
      await tick();
    } catch (err) {
      log('ERROR', `Tick failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, INTERVAL_MS);
}

main();
