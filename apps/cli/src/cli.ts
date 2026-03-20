#!/usr/bin/env node

import { parseEther, formatEther, type Address } from 'viem';
import { createExecutor } from '../../../packages/executor/src/index.js';

// --- Config from env ---

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

function getExecutor() {
  const treasury = process.env.TREASURY_ADDRESS;
  const wsteth = process.env.WSTETH_ADDRESS;
  const rpc = process.env.RPC_URL ?? process.env.BASE_SEPOLIA_RPC;
  const agentKey = process.env.AGENT_PRIVATE_KEY;

  if (!treasury || !wsteth || !rpc || !agentKey) {
    return null;
  }

  return createExecutor({
    treasuryAddress: treasury as Address,
    wstETHAddress: wsteth as Address,
    rpcUrl: rpc,
    agentPrivateKey: agentKey as `0x${string}`,
    ownerPrivateKey: process.env.OWNER_PRIVATE_KEY as `0x${string}` | undefined,
    chain: (process.env.CHAIN as 'base-sepolia' | 'base') ?? 'base-sepolia',
  });
}

async function api(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options?.headers },
  });
  return res.json();
}

// --- Commands ---

async function health() {
  const data = await api('/health');
  console.log('API:', data.ok ? 'healthy' : 'down', `(executor: ${data.executor})`);
}

async function policy() {
  const data = await api('/policy');
  const p = data.policy;
  console.log(`Policy: ${p.policyId}`);
  console.log(`  Agent:      ${p.agentId}`);
  console.log(`  Currency:   ${p.currency}`);
  console.log(`  Max/action: ${p.maxPerAction}`);
  console.log(`  Daily cap:  ${p.dailyCap}`);
  console.log(`  Threshold:  ${p.approvalThreshold}`);
  console.log(`  Allowed:    ${p.allowedDestinations.join(', ') || '(any)'}`);
  console.log(`  Denied:     ${p.deniedDestinations.join(', ') || '(none)'}`);
}

async function evaluate(planJson: string) {
  const plan = JSON.parse(planJson);
  const data = await api('/plans/evaluate', {
    method: 'POST',
    body: JSON.stringify(plan),
  });

  console.log(`Decision: ${data.result.decision}`);
  console.log(`Reasons:  ${data.result.reasons.join('; ')}`);
  console.log(`Rules:    ${data.result.appliedRules.join(', ')}`);

  if (data.approval) {
    console.log(`\nApproval created: ${data.approval.approvalId}`);
    console.log(`  Status: ${data.approval.status}`);
  }
  if (data.execution) {
    console.log(`\nExecuted on-chain: ${data.execution.hash}`);
  }
}

async function approvals(statusFilter?: string) {
  const path = statusFilter ? `/approvals?status=${statusFilter}` : '/approvals';
  const data = await api(path);

  if (data.approvals.length === 0) {
    console.log('No approvals found.');
    return;
  }

  for (const a of data.approvals) {
    console.log(`[${a.status.toUpperCase()}] ${a.approvalId}`);
    console.log(`  Plan:    ${a.planId} (${a.plan.type} ${a.plan.amount} to ${a.plan.destination})`);
    console.log(`  Reason:  ${a.evaluation.reasons.join('; ')}`);
    console.log(`  Created: ${a.createdAt}`);
    if (a.respondedAt) {
      console.log(`  Responded: ${a.respondedAt} by ${a.respondedBy ?? 'unknown'}`);
    }
    console.log();
  }
}

async function respond(approvalId: string, decision: string, respondedBy?: string) {
  if (decision !== 'approved' && decision !== 'denied') {
    console.error('Decision must be "approved" or "denied"');
    process.exit(1);
  }

  const data = await api(`/approvals/${approvalId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ decision, respondedBy: respondedBy ?? 'cli-operator' }),
  });

  if (data.error) {
    console.error(`Error: ${data.error}`);
    process.exit(1);
  }

  console.log(`Approval ${approvalId}: ${decision}`);
  if (data.execution) {
    console.log(`Executed on-chain: ${data.execution.hash}`);
  }
}

async function audit(limit?: number) {
  const data = await api('/audit');
  const events = data.events.slice(0, limit ?? 20);

  for (const e of events) {
    const time = new Date(e.timestamp).toLocaleTimeString();
    console.log(`[${time}] ${e.type}`);
  }
  console.log(`\n${data.events.length} total events`);
}

async function treasury() {
  const data = await api('/treasury');
  if (data.error) {
    console.error(`Error: ${data.error}`);
    process.exit(1);
  }
  const t = data.treasury;
  console.log('On-chain Treasury State:');
  console.log(`  Available yield: ${t.availableYield.formatted} wstETH`);
  console.log(`  Principal:       ${t.principal.formatted} wstETH`);
  console.log(`  Total spent:     ${t.totalSpent.formatted} wstETH`);
  console.log(`  Per-tx cap:      ${t.perTxCap.formatted} wstETH`);
  console.log(`  Agent:           ${t.agent}`);
}

// --- Demo: full end-to-end setup + execute ---

async function demo() {
  const exec = getExecutor();
  if (!exec) {
    console.error('Demo requires contract env vars (TREASURY_ADDRESS, WSTETH_ADDRESS, BASE_SEPOLIA_RPC, AGENT_PRIVATE_KEY, OWNER_PRIVATE_KEY)');
    process.exit(1);
  }

  console.log('=== Synthesis Agent Treasury Demo ===\n');

  // Step 1: Mint mock wstETH
  console.log('1. Minting 1 mock wstETH to owner...');
  await exec.mintMockWstETH(exec.ownerAddress! as Address, parseEther('1'));
  console.log('   Done.\n');

  // Step 2: Deposit
  console.log('2. Owner deposits 1 wstETH into treasury...');
  const depositHash = await exec.deposit(parseEther('1'));
  console.log(`   TX: ${depositHash}\n`);

  // Step 3: Set permissions
  const recipient = process.env.DEMO_RECIPIENT ?? '0x000000000000000000000000000000000000dEaD';
  console.log('3. Setting permissions...');
  await exec.setupPermissions(
    exec.agentAddress as Address,
    [recipient as Address],
    parseEther('0.01'),
  );
  console.log(`   Agent: ${exec.agentAddress}`);
  console.log(`   Recipient: ${recipient}`);
  console.log(`   Per-tx cap: 0.01 wstETH\n`);

  // Step 4: Simulate yield
  console.log('4. Simulating 5% yield accrual...');
  await exec.simulateYield(500);
  const yieldBefore = await exec.availableYield();
  console.log(`   Available yield: ${yieldBefore.formatted} wstETH\n`);

  // Step 5: Agent spends
  console.log('5. Agent spending 0.005 wstETH from yield...');
  const tx = await exec.spendYield(recipient as Address, parseEther('0.005'));
  console.log(`   TX: ${tx.hash}`);
  console.log(`   Amount: ${tx.amount} wstETH to ${tx.to}\n`);

  // Step 6: Verify state
  console.log('6. Final treasury state:');
  const state = await exec.treasuryState();
  console.log(`   Available yield: ${state.availableYield.formatted} wstETH`);
  console.log(`   Principal:       ${state.principal.formatted} wstETH`);
  console.log(`   Total spent:     ${state.totalSpent.formatted} wstETH`);

  console.log('\n=== Demo complete ===');
}

// --- Main ---

const [command, ...args] = process.argv.slice(2);

const commands: Record<string, () => Promise<void>> = {
  health:    () => health(),
  policy:    () => policy(),
  evaluate:  () => evaluate(args[0]),
  approvals: () => approvals(args[0]),
  approve:   () => respond(args[0], 'approved', args[1]),
  deny:      () => respond(args[0], 'denied', args[1]),
  audit:     () => audit(args[0] ? Number(args[0]) : undefined),
  treasury:  () => treasury(),
  demo:      () => demo(),
};

if (!command || command === 'help' || !commands[command]) {
  console.log(`
synthesis — CLI for the Synthesis Agent Treasury

Usage:
  synthesis health                         Check API status
  synthesis policy                         Show current policy
  synthesis evaluate '<plan-json>'         Submit plan for evaluation
  synthesis approvals [pending|approved|denied]  List approvals
  synthesis approve <id> [respondedBy]     Approve a pending request
  synthesis deny <id> [respondedBy]        Deny a pending request
  synthesis audit [limit]                  Show recent audit events
  synthesis treasury                       Show on-chain treasury state
  synthesis demo                           Run full end-to-end demo

Env vars:
  API_URL              API base URL (default: http://localhost:3001)
  TREASURY_ADDRESS     Deployed AgentTreasury contract address
  WSTETH_ADDRESS       Deployed wstETH (or mock) contract address
  BASE_SEPOLIA_RPC     RPC endpoint (default: https://sepolia.base.org)
  AGENT_PRIVATE_KEY    Agent wallet private key
  OWNER_PRIVATE_KEY    Owner wallet private key (for demo/setup)
  CHAIN                base-sepolia or base (default: base-sepolia)
  DEMO_RECIPIENT       Recipient address for demo flow
`);
  process.exit(0);
}

commands[command]().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
