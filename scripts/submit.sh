#!/usr/bin/env bash
# Submit project to Synthesis hackathon via Devfolio API
# Usage: ./scripts/submit.sh
set -euo pipefail

API_KEY="sk-synth-8915d49ce13cd92a3a2ee83bdc53b58f020ec8d18eda2efa"
TEAM_UUID="2b168ebca75a4db49ae552c06cca2fc8"
API="https://synthesis.devfolio.co"

# Track UUIDs (verified fit)
LIDO_TREASURY="5e445a077b5248e0974904915f76e1a0"   # stETH Agent Treasury — STRONG fit
LIDO_MCP="ee885a40e4bc4d3991546cec7a4433e2"         # Lido MCP Server — STRONG fit
OPEN_TRACK="fdb76d08812b43f6a5f454744b66f590"       # Synthesis Open Track — universal
ERC8004_RECEIPTS="3bf41be958da497bbb69f1a150c76af9"  # Agents With Receipts — ERC-8004 registered
# DROPPED: Agents that Pay (requires GMX perps trading), Agent Services on Base (requires x402)

CONVERSATION_LOG=$(cat docs/conversationLog.md)

echo "=== Creating project draft ==="
RESPONSE=$(curl -s -X POST "$API/projects" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$(node -e "
const log = require('fs').readFileSync('docs/conversationLog.md','utf8');
console.log(JSON.stringify({
  teamUUID: '$TEAM_UUID',
  name: 'Open Bound Onchain Money Maker',
  description: 'Yield-only spending for AI agents. Human deposits wstETH into a smart contract on Base. Yield accrues via Lido staking rewards. The agent can spend only the yield — principal is structurally locked at the EVM level. Three on-chain enforcements: recipient whitelist, per-tx cap, yield ceiling. Every action is policy-evaluated and audit-logged. Includes an 11-tool MCP server for treasury, Lido staking, and governance. Built by two AI agents (Bagel + Claude Code) orchestrated by one human — zero lines of human-written code.',
  problemStatement: 'AI agents need financial authority, but giving them full wallet access is reckless. There is no middle ground between zero access and full control. We built bounded financial autonomy — agents spend only yield from staked assets, with permission controls enforced on-chain.',
  repoURL: 'https://github.com/MorkeethHQ/delegated-agent-treasury',
  trackUUIDs: [
    '$LIDO_TREASURY',
    '$LIDO_MCP',
    '$OPEN_TRACK',
    '$ERC8004_RECEIPTS'
  ],
  conversationLog: log,
  submissionMetadata: {
    agentFramework: 'other',
    agentFrameworkOther: 'custom TypeScript monorepo with viem',
    agentHarness: 'claude-code',
    model: 'claude-opus-4-6',
    skills: ['treasury-management', 'policy-evaluation', 'approval-workflow', 'lido-staking', 'governance-queries'],
    tools: ['Viem', 'Foundry', 'MCP SDK', 'Node.js', 'TypeScript'],
    helpfulResources: [
      'https://docs.lido.fi/contracts/wsteth',
      'https://docs.base.org',
      'https://modelcontextprotocol.io',
      'https://eips.ethereum.org/EIPS/eip-8004'
    ],
    helpfulSkills: [],
    intention: 'continuing'
  }
}));
")")

echo "$RESPONSE" | node -e "
  const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  if(d.uuid || d.projectUUID) {
    const id = d.uuid || d.projectUUID;
    console.log('Project created:', id);
    console.log('');
    console.log('Next steps:');
    console.log('1. Transfer to self-custody:');
    console.log('   curl -X POST $API/participants/me/transfer/init \\\\');
    console.log('     -H \"Authorization: Bearer $API_KEY\" \\\\');
    console.log('     -H \"Content-Type: application/json\" \\\\');
    console.log('     -d \'{\"targetOwnerAddress\": \"0xYOUR_WALLET\"}\'');
    console.log('');
    console.log('2. Publish:');
    console.log('   curl -X POST $API/projects/' + id + '/publish \\\\');
    console.log('     -H \"Authorization: Bearer $API_KEY\"');
  } else {
    console.log('Response:', JSON.stringify(d, null, 2));
  }
"