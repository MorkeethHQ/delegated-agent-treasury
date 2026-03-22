#!/usr/bin/env node
// Update Bagel Yieldbound project on Devfolio for Synthesis hackathon
import { readFileSync } from 'node:fs';

const API_KEY = 'sk-synth-8915d49ce13cd92a3a2ee83bdc53b58f020ec8d18eda2efa';
const PROJECT_UUID = '74eb1aa0751e4cab8726e7482dff61bc';
const API = 'https://synthesis.devfolio.co';

const conversationLog = readFileSync('docs/conversationLog.md', 'utf8');

const payload = {
  name: 'Bagel Yieldbound',
  description:
    'Bounded financial authority for autonomous agents. Human deposits wstETH into a smart contract on Base. ' +
    'Yield accrues via Lido staking rewards. The agent can spend only the yield — principal is structurally ' +
    'locked at the EVM level. Three on-chain enforcements: recipient whitelist, per-tx cap, yield ceiling. ' +
    'An autonomous agent loop monitors treasury state + Lido governance, deciding to spend or hold based on ' +
    'protocol risk. Every action is policy-evaluated and audit-logged. 27 mainnet transactions across Base and ' +
    'Celo. 11 fully autonomous spends. 25-tool MCP server. 39 API endpoints. MetaMask ERC-7710 delegation ' +
    'caveats as defense-in-depth. ERC-8004 on-chain agent identity. Uniswap + MoonPay + x402 execution layer. ' +
    'Built by Oscar + 3 AI agents (Bagel via Codex, Open Claw via Claude Code, ODawg via Anthropic).',
  problemStatement:
    'AI agents need financial authority, but giving them full wallet access is reckless. ' +
    'There is no middle ground between zero access and full control. Yieldbound provides bounded financial ' +
    'autonomy — agents spend only yield from staked assets, with permission controls enforced on-chain. ' +
    'Principal is always safe. Budget regenerates forever from real economic activity.',
  repoURL: 'https://github.com/MorkeethHQ/delegated-agent-treasury',
  websiteURL: 'https://yieldbound.com',
  trackUUIDs: [
    '5e445a077b5248e0974904915f76e1a0', // stETH Agent Treasury (Lido)
    'ee885a40e4bc4d3991546cec7a4433e2', // Lido MCP Server (Lido)
    'fdb76d08812b43f6a5f454744b66f590', // Synthesis Open Track
    '3bf41be958da497bbb69f1a150c76af9', // Agents With Receipts — ERC-8004 (Protocol Labs)
    // Note: remaining 7 tracks need real UUIDs from Devfolio dashboard
    // - Agentic Finance (Uniswap), Agent Services on Base, Let the Agent Cook,
    // - Autonomous Trading Agent, MoonPay CLI Agents, Best Delegations (MetaMask), Best Agent on Celo
  ],
  conversationLog,
  submissionMetadata: {
    agentFramework: 'other',
    agentFrameworkOther: 'Custom TypeScript monorepo — 13 packages, Viem, MCP SDK',
    agentHarness: 'claude-code',
    model: 'claude-opus-4-6',
    skills: [
      'treasury-management',
      'policy-evaluation',
      'approval-workflow',
      'lido-staking',
      'governance-queries',
      'uniswap-trading',
      'moonpay-execution',
      'x402-micropayments',
      'erc8004-identity',
      'metamask-delegation',
    ],
    tools: ['Viem', 'Foundry', 'MCP SDK', 'Node.js', 'TypeScript', 'Uniswap Trading API', 'MoonPay CLI'],
    helpfulResources: [
      'https://docs.lido.fi/contracts/wsteth',
      'https://docs.base.org',
      'https://modelcontextprotocol.io',
      'https://eips.ethereum.org/EIPS/eip-8004',
      'https://docs.metamask.io/delegation-toolkit/',
      'https://docs.uniswap.org/api/trading-api/overview',
    ],
    helpfulSkills: [],
    intention: 'continuing',
  },
};

console.log('=== Updating Bagel Yieldbound on Devfolio ===');
console.log(`Payload size: ${JSON.stringify(payload).length} bytes`);
console.log(`Tracks: ${payload.trackUUIDs.length}`);
console.log('');

try {
  const res = await fetch(`${API}/projects/${PROJECT_UUID}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log(`Status: ${res.status}`);
  console.log('Response:', JSON.stringify(data, null, 2));

  if (res.ok) {
    console.log('');
    console.log('✓ Submission updated successfully');
    console.log(`  View: https://synthesis.devfolio.co/projects/${PROJECT_UUID}`);
  }
} catch (err) {
  console.error('Error:', err.message);
}
