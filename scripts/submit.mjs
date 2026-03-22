#!/usr/bin/env node
// Submit project to Synthesis hackathon via Devfolio API
import { readFileSync } from 'node:fs';

const API_KEY = 'sk-synth-8915d49ce13cd92a3a2ee83bdc53b58f020ec8d18eda2efa';
const TEAM_UUID = '2b168ebca75a4db49ae552c06cca2fc8';
const API = 'https://synthesis.devfolio.co';

const conversationLog = readFileSync('docs/conversationLog.md', 'utf8');

const payload = {
  teamUUID: TEAM_UUID,
  name: 'Yieldbound ',
  description:
    'Yield-only spending for AI agents. Human deposits wstETH into a smart contract on Base. ' +
    'Yield accrues via Lido staking rewards. The agent can spend only the yield — principal is ' +
    'structurally locked at the EVM level. Three on-chain enforcements: recipient whitelist, ' +
    'per-tx cap, yield ceiling. An autonomous agent loop monitors treasury + Lido governance, ' +
    'deciding to spend or hold based on protocol risk. Every action is policy-evaluated and ' +
    'audit-logged. Includes an 11-tool MCP server for treasury, Lido staking, and governance. ' +
    'Built by two AI agents (Bagel + Claude Code) orchestrated by one human — zero lines of ' +
    'human-written code.',
  problemStatement:
    'AI agents need financial authority, but giving them full wallet access is reckless. ' +
    'There is no middle ground between zero access and full control. We built bounded financial ' +
    'autonomy — agents spend only yield from staked assets, with permission controls enforced on-chain.',
  repoURL: 'https://github.com/MorkeethHQ/delegated-agent-treasury',
  trackUUIDs: [
    '5e445a077b5248e0974904915f76e1a0', // stETH Agent Treasury
    'ee885a40e4bc4d3991546cec7a4433e2', // Lido MCP Server
    'fdb76d08812b43f6a5f454744b66f590', // Synthesis Open Track
    '3bf41be958da497bbb69f1a150c76af9', // Agents With Receipts — ERC-8004
  ],
  conversationLog,
  submissionMetadata: {
    agentFramework: 'other',
    agentFrameworkOther: 'custom TypeScript monorepo with viem',
    agentHarness: 'claude-code',
    model: 'claude-opus-4-6',
    skills: [
      'treasury-management',
      'policy-evaluation',
      'approval-workflow',
      'lido-staking',
      'governance-queries',
    ],
    tools: ['Viem', 'Foundry', 'MCP SDK', 'Node.js', 'TypeScript'],
    helpfulResources: [
      'https://docs.lido.fi/contracts/wsteth',
      'https://docs.base.org',
      'https://modelcontextprotocol.io',
      'https://eips.ethereum.org/EIPS/eip-8004',
    ],
    helpfulSkills: [],
    intention: 'continuing',
  },
};

console.log('=== Creating project draft ===');
console.log(`Payload size: ${JSON.stringify(payload).length} bytes`);
console.log(`Tracks: ${payload.trackUUIDs.length}`);
console.log('');

try {
  const res = await fetch(`${API}/projects`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (res.ok && (data.uuid || data.projectUUID)) {
    const id = data.uuid || data.projectUUID;
    console.log(`Project created: ${id}`);
    console.log('');
    console.log('Next steps:');
    console.log(`1. Publish: node -e "fetch('${API}/projects/${id}/publish', { method: 'POST', headers: { Authorization: 'Bearer ${API_KEY}' } }).then(r => r.json()).then(console.log)"`);
  } else {
    console.log(`Status: ${res.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));
  }
} catch (err) {
  console.error('Error:', err.message);
}
