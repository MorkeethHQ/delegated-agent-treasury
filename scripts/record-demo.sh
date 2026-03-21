#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Synthesis Agent Treasury — Full Screen Recording Demo
# ═══════════════════════════════════════════════════════════════════
# Start API first:  node --env-file=.env dist/apps/api/src/server.js
# Then record this:  bash scripts/record-demo.sh
set -euo pipefail

API=${API_URL:-http://localhost:3001}

# --- Colors ---
B='\033[1m'
G='\033[0;32m'
C='\033[0;36m'
Y='\033[0;33m'
R='\033[0;31m'
D='\033[2m'
X='\033[0m'

say()  { echo -e "\n${C}$1${X}"; sleep 1.5; }
step() { echo -e "\n${B}${G}━━━ $1 ━━━${X}"; sleep 0.5; }
link() { echo -e "  ${D}↗ $1${X}"; }
wait() { sleep "${1:-1.5}"; }

pj() { node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));$1"; }

clear
echo ""
echo -e "${B}╔══════════════════════════════════════════════════════════════╗${X}"
echo -e "${B}║         Synthesis Agent Treasury — Live Demo                ║${X}"
echo -e "${B}╚══════════════════════════════════════════════════════════════╝${X}"
echo ""
echo -e "  ${B}Principal-protected yield treasury with autonomous trading${X}"
echo -e "  ${D}10 packages · 24 MCP tools · 22 API endpoints · 9 bounty tracks${X}"
echo -e "  ${D}Built by 2 AI agents + 1 human orchestrator${X}"
echo ""
echo -e "  ${D}Repo:     github.com/MorkeethHQ/delegated-agent-treasury${X}"
echo -e "  ${D}Mainnet:  basescan.org/address/0x455d76a24e862a8d552a0722823ac4d13e482426${X}"
echo -e "  ${D}Identity: ERC-8004 agent 10ee7e7e703b4fc493e19f512b5ae09d${X}"
sleep 4

# ─────────────────────────────────────────────────────
# PART 1: INFRASTRUCTURE
# ─────────────────────────────────────────────────────

step "PART 1 — LIVE INFRASTRUCTURE"

say "1. System health — API server + on-chain executor"
curl -s "$API/health" | pj "
  console.log('  API:       ' + (d.ok ? '✓ healthy' : '✗ down'));
  console.log('  Executor:  ' + d.executor);
  console.log('  x402:      ' + d.x402);
"
wait

say "2. On-chain treasury state — reading from Base mainnet contract"
curl -s "$API/treasury" | pj "
  if(d.error){
    console.log('  (API-only mode — contract reads disabled)');
  } else {
    const t=d.treasury;
    console.log('  Principal:       ' + t.principal.formatted + ' wstETH  ← LOCKED (never touchable)');
    console.log('  Available yield: ' + t.availableYield.formatted + ' wstETH');
    console.log('  Total spent:     ' + t.totalSpent.formatted + ' wstETH');
    console.log('  Per-tx cap:      ' + t.perTxCap.formatted + ' wstETH');
    console.log('  Agent:           ' + t.agent);
  }
"
link "basescan.org/address/0x455d76a24e862a8d552a0722823ac4d13e482426"
wait 2

say "3. Policy configuration — what the agent can and cannot do"
curl -s "$API/policy" | pj "
  const p=d.policy;
  console.log('  Max transfer/tx:  ' + p.maxPerAction + ' wstETH');
  console.log('  Max swap/tx:      ' + (p.maxSwapPerAction || 'N/A') + ' wstETH');
  console.log('  Max slippage:     ' + (p.maxSlippageBps || 'N/A') + ' bps (1%)');
  console.log('  Daily cap:        ' + p.dailyCap + ' wstETH');
  console.log('  Approval thresh:  ' + p.approvalThreshold + ' wstETH');
  console.log('  Whitelisted:      ' + p.allowedDestinations.length + ' addresses');
  console.log('  Trust-gated:      ' + (p.requireVerifiedIdentity ? 'YES' : 'NO'));
"
wait

# ─────────────────────────────────────────────────────
# PART 2: POLICY ENGINE — 3 PATHS
# ─────────────────────────────────────────────────────

step "PART 2 — POLICY ENGINE (3 decision paths)"

say "4. AUTO-APPROVED — small transfer below threshold"
curl -s -X POST "$API/plans/evaluate" \
  -H 'content-type: application/json' \
  -d '{"planId":"rec-small-1","agentId":"bagel","type":"transfer","amount":0.005,"destination":"0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6","reason":"Fund approved workflow"}' \
  | pj "
  console.log('  Amount:    0.005 wstETH');
  console.log('  Decision:  ' + d.result.decision.toUpperCase());
  console.log('  Rules:     ' + d.result.appliedRules.join(', '));
  if(d.execution) console.log('  TX:        ' + d.execution.hash);
"
wait

say "5. APPROVAL REQUIRED — larger transfer above threshold"
LARGE=$(curl -s -X POST "$API/plans/evaluate" \
  -H 'content-type: application/json' \
  -d '{"planId":"rec-large-1","agentId":"bagel","type":"transfer","amount":0.009,"destination":"0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6","reason":"Larger spend needs human sign-off"}')
echo "$LARGE" | pj "
  console.log('  Amount:      0.009 wstETH (above 0.008 threshold)');
  console.log('  Decision:    ' + d.result.decision.toUpperCase());
  if(d.approval) console.log('  Approval ID: ' + d.approval.approvalId);
"
wait

say "6. HUMAN APPROVES — operator reviews and signs off"
AID=$(curl -s "$API/approvals?status=pending" | pj "if(d.approvals.length)console.log(d.approvals[0].approvalId);")
if [ -n "$AID" ]; then
  curl -s -X POST "$API/approvals/$AID/respond" \
    -H 'content-type: application/json' \
    -d '{"decision":"approved","respondedBy":"oscar"}' \
    | pj "
    console.log('  Approved by: oscar (human operator)');
    console.log('  Status:      ' + d.approval.status.toUpperCase());
    if(d.execution) console.log('  TX:          ' + d.execution.hash);
  "
else
  echo "  (No pending approvals)"
fi
wait

say "7. DENIED — blocked destination rejected immediately"
curl -s -X POST "$API/plans/evaluate" \
  -H 'content-type: application/json' \
  -d '{"planId":"rec-deny-1","agentId":"bagel","type":"transfer","amount":0.001,"destination":"0xDeniedDestination1","reason":"Attempt to send to unknown address"}' \
  | pj "
  console.log('  Decision:  ' + d.result.decision.toUpperCase());
  console.log('  Reason:    ' + d.result.reasons.join('; '));
  console.log('  → No transaction. Logged for audit.');
"
wait

# ─────────────────────────────────────────────────────
# PART 3: MULTI-AGENT GOVERNANCE
# ─────────────────────────────────────────────────────

step "PART 3 — MULTI-AGENT GOVERNANCE"

say "8. Agent registry — 3 roles with distinct capabilities"
curl -s "$API/agents" | pj "
  d.agents.forEach(a => {
    const status = a.frozen ? '🔒 FROZEN' : '✓ active';
    console.log('  ' + a.name.padEnd(10) + ' [' + a.role.padEnd(8) + '] ' + status);
    console.log('  ' + ' '.repeat(10) + ' → ' + a.capabilities.join(', '));
  });
"
wait

say "9. AUDITOR FREEZE — watchdog halts agent spending"
curl -s -X POST "$API/agents/bagel/freeze" \
  -H 'content-type: application/json' \
  -d '{"requestedBy":"auditor-1"}' | pj "
  console.log('  ⚠  ' + d.message);
"
echo -e "  ${Y}Frozen agent tries to spend...${X}"
curl -s -X POST "$API/plans/evaluate" \
  -H 'content-type: application/json' \
  -d '{"planId":"rec-frozen","agentId":"bagel","type":"transfer","amount":0.001,"destination":"0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6","reason":"Test while frozen"}' \
  | pj "
  console.log('  Decision:  ' + d.result.decision.toUpperCase());
  console.log('  Rule:      ' + d.result.appliedRules.join(', '));
  console.log('  → Completely locked out. No transaction possible.');
"
curl -s -X POST "$API/agents/bagel/unfreeze" \
  -H 'content-type: application/json' \
  -d '{"requestedBy":"admin"}' | pj "
  console.log('  ✓ ' + d.message);
"
wait 2

# ─────────────────────────────────────────────────────
# PART 4: YIELD STRATEGIES
# ─────────────────────────────────────────────────────

step "PART 4 — YIELD DISTRIBUTION STRATEGIES"

say "10. Multi-bucket strategy — configurable yield routing"
curl -s "$API/strategy" | pj "
  if(d.error){ console.log('  (No strategy)'); } else {
    const s=d.strategy;
    console.log('  Strategy:    ' + s.strategyId);
    console.log('  Distribution: ' + (s.distributionRatio*100) + '% of available yield');
    s.buckets.forEach(b => console.log('  Bucket:      ' + b.label.padEnd(12) + ' → ' + b.percentage + '%  → ' + b.destination.slice(0,10) + '...'));
  }
"
wait

say "11. Strategy preview — how 0.1 wstETH yield gets distributed"
curl -s "$API/strategy/preview?yield=0.1&perTxCap=0.05" | pj "
  if(d.error){ console.log('  ' + d.error); } else {
    const p=d.plan;
    console.log('  Total:  ' + p.totalToDistribute.toFixed(6) + ' wstETH across ' + p.items.length + ' buckets');
    p.items.forEach(i => console.log('    ' + i.bucketLabel.padEnd(12) + i.amount.toFixed(6) + ' wstETH → ' + i.destination.slice(0,12) + '...'));
  }
"
wait

# ─────────────────────────────────────────────────────
# PART 5: UNISWAP TRADING
# ─────────────────────────────────────────────────────

step "PART 5 — UNISWAP YIELD TRADING ON BASE"

say "12. Live Uniswap quote — real-time pricing, same chain as treasury"
curl -s "$API/swap/quote?tokenIn=0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452&tokenOut=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&amount=10000000000000000" \
  | pj "
  const q=d.quote;
  console.log('  Route:    wstETH → WETH → USDC (Uniswap V3 on Base)');
  console.log('  In:       0.01 wstETH');
  console.log('  Out:      ' + q.amountOutFormatted + ' USDC');
  console.log('  Impact:   ' + q.priceImpact + '%');
  console.log('  Gas:      \$' + parseFloat(q.gasEstimateUSD).toFixed(4));
"
wait

say "13. Policy-gated swap (dry run) — yield into USDC via Uniswap"
curl -s -X POST "$API/swap/execute" \
  -H 'content-type: application/json' \
  -d '{"agentId":"bagel","tokenOut":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","amount":"10000000000000000","reason":"DCA yield into USDC","dryRun":true}' \
  | pj "
  console.log('  Policy:   ' + d.result.decision.toUpperCase());
  console.log('  Rules:    ' + d.result.appliedRules.join(', '));
  if(d.swap) {
    console.log('  Output:   ' + (parseInt(d.swap.amountOut)/1e6).toFixed(2) + ' USDC');
    console.log('  Mode:     dry run (simulation — no on-chain tx)');
  }
"
wait

say "14. Trading strategies — 3 configurable DCA/swap strategies"
curl -s "$API/swap/strategies" | pj "
  if(d.strategies) d.strategies.forEach(s =>
    console.log('  ' + s.label.padEnd(22) + s.allocationPercent + '%  ' + s.tokenIn.slice(0,6) + '→' + s.tokenOut.slice(0,6))
  );
"
wait

say "15. ON-CHAIN PROOF — real Uniswap swap on Base mainnet"
echo -e "  ${G}Confirmed transactions:${X}"
echo -e "  Wrap ETH→WETH:     ${B}0x4d381ed584b85d08155fdce4cfdb1ac8ec310eb75affd6d5e7c3f766284556ac${X}"
link "basescan.org/tx/0x4d381ed584b85d08155fdce4cfdb1ac8ec310eb75affd6d5e7c3f766284556ac"
echo -e "  Permit2 Approval:   ${B}0x536b75fd78f78106db68efcd3cdd7d162e8c6fe074e81dffa5841f8b888f462d${X}"
link "basescan.org/tx/0x536b75fd78f78106db68efcd3cdd7d162e8c6fe074e81dffa5841f8b888f462d"
echo -e "  WETH→USDC Swap:     ${B}0x9e387425cfddde0d2809d36a154b667ea37e8ea93a5943dda2c97416bc375ae9${X}"
link "basescan.org/tx/0x9e387425cfddde0d2809d36a154b667ea37e8ea93a5943dda2c97416bc375ae9"
echo -e "  ${D}0.001 WETH → 2.157 USDC via Uniswap V3 on Base${X}"
wait 3

# ─────────────────────────────────────────────────────
# PART 6: IDENTITY & TRUST
# ─────────────────────────────────────────────────────

step "PART 6 — ERC-8004 IDENTITY & TRUST"

say "16. Agent identity — registered on Base mainnet"
echo -e "  Agent ID:    ${B}10ee7e7e703b4fc493e19f512b5ae09d${X}"
echo -e "  Registry:    ERC-8004 on Base mainnet"
link "basescan.org/tx/0x4027641718bb5cfb9fdf7f4871f6506685b5367cab1a3a030b9bb0fe779ee934"
wait

say "17. Trust-gated verification — check counterparty before paying"
curl -s "$API/verify/0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6" | pj "
  console.log('  Address:   0x4fD6...DCe6');
  const v = d.identity || d;
  console.log('  Verified:  ' + (v.verified || false));
  if(v.agentId) console.log('  Agent ID:  ' + v.agentId);
  console.log('  → Unverified recipients escalate to human approval');
"
wait

# ─────────────────────────────────────────────────────
# PART 7: AGENT-AS-A-SERVICE
# ─────────────────────────────────────────────────────

step "PART 7 — AGENT-AS-A-SERVICE (x402)"

say "18. x402 payment pricing — other agents pay USDC to use this treasury"
curl -s "$API/x402/pricing" | pj "
  console.log('  Protocol:  x402 (HTTP 402 by Coinbase)');
  console.log('  Asset:     USDC on Base');
  console.log('  Pricing:');
  d.endpoints.forEach(e => console.log('    ' + e.method.padEnd(5) + ' ' + e.path.padEnd(20) + ' \$' + e.priceUSD + ' USDC'));
  console.log('');
  console.log('  Free:      /health, /policy, /treasury, /audit');
"
wait

say "19. MoonPay CLI bridge — 54 crypto tools across 10+ chains"
curl -s "$API/moonpay/tools" | pj "
  console.log('  Total tools:  ' + d.totalTools);
  console.log('  Chains:       Base, Ethereum, Arbitrum, Polygon, Optimism, ...');
  console.log('  Categories:   ' + d.tools.slice(0,6).join(', ') + ', ...');
  console.log('  Status:       policy-gated through same engine');
"
wait

# ─────────────────────────────────────────────────────
# PART 8: AUDIT TRAIL
# ─────────────────────────────────────────────────────

step "PART 8 — AUDIT TRAIL"

say "20. Full audit log — every action recorded, append-only"
curl -s "$API/audit" | pj "
  const types = {};
  d.events.forEach(e => { types[e.type] = (types[e.type]||0)+1; });
  console.log('  Total events: ' + d.events.length);
  Object.entries(types).sort((a,b)=>b[1]-a[1]).forEach(([t,c]) => console.log('    ' + t.padEnd(22) + c));
  if(d.events.length) {
    const latest = d.events[0];
    console.log('');
    console.log('  Latest: [' + latest.type + '] at ' + latest.timestamp.slice(0,19));
  }
"
wait 2

# ─────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────

echo ""
echo -e "${B}╔══════════════════════════════════════════════════════════════╗${X}"
echo -e "${B}║                     Demo Complete                          ║${X}"
echo -e "${B}╚══════════════════════════════════════════════════════════════╝${X}"
echo ""
echo -e "  ${B}What was proven:${X}"
echo ""
echo -e "  ${G}✓${X} Live treasury on Base mainnet (real wstETH principal)"
echo -e "  ${G}✓${X} Policy engine — 3 paths: approve, escalate, deny"
echo -e "  ${G}✓${X} Human approval workflow"
echo -e "  ${G}✓${X} Multi-agent governance — freeze/unfreeze by auditor"
echo -e "  ${G}✓${X} Multi-bucket yield distribution strategies"
echo -e "  ${G}✓${X} Live Uniswap quotes on Base"
echo -e "  ${G}✓${X} Policy-gated yield swaps (DCA, rebalance)"
echo -e "  ${G}✓${X} Real on-chain Uniswap swap (3 confirmed TXs)"
echo -e "  ${G}✓${X} ERC-8004 agent identity + trust-gated payments"
echo -e "  ${G}✓${X} x402 agent-as-a-service (USDC payment gating)"
echo -e "  ${G}✓${X} MoonPay CLI bridge (54 tools, 10+ chains)"
echo -e "  ${G}✓${X} Full append-only audit trail"
echo ""
echo -e "  ${B}Key invariant:${X} Agent can ONLY spend yield."
echo -e "  Principal is structurally locked at the contract level."
echo ""
echo -e "  ${B}On-chain proof:${X}"
echo -e "  ${D}Treasury:     basescan.org/address/0x455d76a24e862a8d552a0722823ac4d13e482426${X}"
echo -e "  ${D}Deploy TX:    basescan.org/tx/0x33e648434ce963eb47ddfb403df14f2faae20d72e78bf0e9ebafefa3e85ea0db${X}"
echo -e "  ${D}Swap TX:      basescan.org/tx/0x9e387425cfddde0d2809d36a154b667ea37e8ea93a5943dda2c97416bc375ae9${X}"
echo -e "  ${D}ERC-8004 TX:  basescan.org/tx/0x4027641718bb5cfb9fdf7f4871f6506685b5367cab1a3a030b9bb0fe779ee934${X}"
echo -e "  ${D}Sepolia:      sepolia.basescan.org/address/0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0${X}"
echo ""
echo -e "  ${B}9 bounty tracks · ~\$62.5K potential${X}"
echo -e "  ${D}Lido stETH ($3K) · Lido MCP ($5K) · Open Track (~$28K) · ERC-8004 ($4K)${X}"
echo -e "  ${D}Uniswap ($5K) · Agent Services ($5K) · Agent Cook ($4K)${X}"
echo -e "  ${D}Trading Agent ($5K) · MoonPay ($3.5K)${X}"
echo ""
echo -e "  ${C}github.com/MorkeethHQ/delegated-agent-treasury${X}"
echo ""
