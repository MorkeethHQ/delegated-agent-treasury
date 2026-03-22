#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# Open Bound — Screen Recording Demo
# ═══════════════════════════════════════════════════════════════════
# Start API first:  node --env-file=.env dist/apps/api/src/server.js
# Then record:      bash scripts/record-demo.sh
set -euo pipefail

API=${API_URL:-http://localhost:3001}

# --- Colors ---
B='\033[1m'
G='\033[0;32m'
C='\033[0;36m'
Y='\033[0;33m'
R='\033[0;31m'
D='\033[2m'
W='\033[97m'
X='\033[0m'

type_slow() {
  local text="$1"
  local color="${2:-$W}"
  echo -ne "  ${color}"
  for (( i=0; i<${#text}; i++ )); do
    echo -n "${text:$i:1}"
    sleep 0.02
  done
  echo -e "${X}"
}

say()     { echo -e "\n${C}$1${X}"; sleep 1.5; }
step()    { echo -e "\n${B}${G}━━━ $1 ━━━${X}"; sleep 0.5; }
link()    { echo -e "  ${D}↗ $1${X}"; }
divider() { echo -e "\n${D}──────────────────────────────────────────────${X}\n"; sleep 1; }
pause()   { sleep "${1:-1.5}"; }

pj() { node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));$1"; }

# ═════════════════════════════════════════════════════
# ACT 1 — THE PROBLEM
# ═════════════════════════════════════════════════════

clear
echo ""
echo ""
sleep 1
type_slow "AI agents are getting wallets." "$B"
sleep 2
echo ""
type_slow "But right now, financial authority is binary:" "$D"
sleep 1
echo ""
type_slow "Either no access... or full wallet control." "$Y"
sleep 2
echo ""
type_slow "Neither works for production systems." "$R"
sleep 3

clear
echo ""
echo ""
sleep 1
type_slow "What if an agent could only spend what it earned?" "$B"
sleep 2
echo ""
type_slow "Principal stays locked. Only yield is touchable." "$G"
sleep 1
echo ""
type_slow "Every action bounded. Every spend audited. Every recipient verified." "$C"
sleep 3

# ═════════════════════════════════════════════════════
# ACT 2 — THE SOLUTION
# ═════════════════════════════════════════════════════

clear
echo ""
echo -e "${B}╔══════════════════════════════════════════════════════════════╗${X}"
echo -e "${B}║              Open Bound — Onchain Money Maker               ║${X}"
echo -e "${B}║                                                            ║${X}"
echo -e "${B}║    Principal-protected. Yield-activated. Fully autonomous.  ║${X}"
echo -e "${B}╚══════════════════════════════════════════════════════════════╝${X}"
echo ""
echo -e "  ${D}Human deposits wstETH → Lido staking yield accrues${X}"
echo -e "  ${D}Agent spends ONLY the yield — principal is locked at the EVM level${X}"
echo -e "  ${D}Every action goes through a policy engine before touching chain${X}"
echo ""
echo -e "  ${D}10 packages · 24 MCP tools · 22 API endpoints${X}"
echo -e "  ${D}Live on Base mainnet with real Lido staking yield${X}"
echo ""
echo -e "  ${B}Team:${X}"
echo -e "  ${C}Oscar${X}  — human architect, orchestrator, funder"
echo -e "  ${C}Bagel${X}  — AI agent (Cursor) — Solidity contracts, on-chain deployment"
echo -e "  ${C}Claude${X} — AI agent (CLI) — 10-package TypeScript system, 24 MCP tools"
echo ""
echo -e "  ${D}Zero lines of human-written code.${X}"
sleep 5

# ═════════════════════════════════════════════════════
# ACT 3 — LIVE PROOF
# ═════════════════════════════════════════════════════

clear
echo ""
echo -e "${B}  ACT 1 — The system is live${X}"
divider

say "Health check — connecting to Base mainnet"
curl -s "$API/health" | pj "
  console.log('  API:       ' + (d.ok ? '✓ healthy' : '✗ down'));
  console.log('  Executor:  ' + d.executor);
  console.log('  x402:      ' + d.x402);
"
pause

say "Treasury state — real wstETH on Base mainnet"
curl -s "$API/treasury" | pj "
  if(d.error){
    console.log('  (API-only mode)');
  } else {
    const t=d.treasury;
    console.log('  Principal:       ' + t.principal.formatted + ' wstETH  ← LOCKED FOREVER');
    console.log('  Available yield: ' + t.availableYield.formatted + ' wstETH');
    console.log('  Total spent:     ' + t.totalSpent.formatted + ' wstETH');
    console.log('  Per-tx cap:      ' + t.perTxCap.formatted + ' wstETH');
  }
"
link "basescan.org/address/0x455d76a24e862a8d552a0722823ac4d13e482426"
pause 2

say "Policy — the rules that bind the agent"
curl -s "$API/policy" | pj "
  const p=d.policy;
  console.log('  Transfer cap:     ' + p.maxPerAction + ' wstETH per tx');
  console.log('  Swap cap:         ' + (p.maxSwapPerAction||'N/A') + ' wstETH per tx');
  console.log('  Slippage limit:   ' + (p.maxSlippageBps||'N/A') + ' bps (1%)');
  console.log('  Daily limit:      ' + p.dailyCap + ' wstETH');
  console.log('  Human threshold:  ' + p.approvalThreshold + ' wstETH');
  console.log('  Whitelisted:      ' + p.allowedDestinations.length + ' destinations');
"
pause

# ═════════════════════════════════════════════════════
# ACT 4 — THE POLICY ENGINE
# ═════════════════════════════════════════════════════

clear
echo ""
echo -e "${B}  ACT 2 — Three paths. Every transaction.${X}"
divider

echo -e "  ${D}Every spend goes through the policy engine.${X}"
echo -e "  ${D}Three possible outcomes:${X}"
echo ""
echo -e "  ${G}APPROVED${X}        — within bounds, auto-executes"
echo -e "  ${Y}APPROVAL_REQUIRED${X} — above threshold, human reviews"
echo -e "  ${R}DENIED${X}          — blocked, no transaction, logged"
pause 3

say "Path 1: AUTO-APPROVED — 0.005 wstETH (below threshold)"
curl -s -X POST "$API/plans/evaluate" \
  -H 'content-type: application/json' \
  -d '{"planId":"rec-s1","agentId":"bagel","type":"transfer","amount":0.005,"destination":"0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6","reason":"Fund approved workflow"}' \
  | pj "
  console.log('  Decision:  ${G}' + d.result.decision.toUpperCase() + '${X}');
  console.log('  Rules:     ' + d.result.appliedRules.join(', '));
  if(d.execution) console.log('  On-chain:  ' + d.execution.hash);
"
pause

say "Path 2: ESCALATED — 0.009 wstETH (above 0.008 threshold)"
LARGE=$(curl -s -X POST "$API/plans/evaluate" \
  -H 'content-type: application/json' \
  -d '{"planId":"rec-l1","agentId":"bagel","type":"transfer","amount":0.009,"destination":"0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6","reason":"Larger spend — needs human"}')
echo "$LARGE" | pj "
  console.log('  Decision:    ${Y}' + d.result.decision.toUpperCase() + '${X}');
  if(d.approval) console.log('  Approval ID: ' + d.approval.approvalId);
  console.log('  → Waiting for human operator...');
"
pause

say "Oscar reviews and approves"
AID=$(curl -s "$API/approvals?status=pending" | pj "if(d.approvals.length)console.log(d.approvals[0].approvalId);")
if [ -n "$AID" ]; then
  curl -s -X POST "$API/approvals/$AID/respond" \
    -H 'content-type: application/json' \
    -d '{"decision":"approved","respondedBy":"oscar"}' \
    | pj "
    console.log('  Approved by: oscar (human operator)');
    console.log('  Status:      ' + d.approval.status.toUpperCase());
    if(d.execution) console.log('  On-chain:    ' + d.execution.hash);
  "
else
  echo "  (No pending approvals)"
fi
pause

say "Path 3: DENIED — unknown destination, blocked immediately"
curl -s -X POST "$API/plans/evaluate" \
  -H 'content-type: application/json' \
  -d '{"planId":"rec-d1","agentId":"bagel","type":"transfer","amount":0.001,"destination":"0xDeniedDestination1","reason":"Send to unknown address"}' \
  | pj "
  console.log('  Decision:  ${R}' + d.result.decision.toUpperCase() + '${X}');
  console.log('  Reason:    ' + d.result.reasons.join('; '));
  console.log('  → No transaction. Logged for audit.');
"
pause 2

# ═════════════════════════════════════════════════════
# ACT 5 — MULTI-AGENT GOVERNANCE
# ═════════════════════════════════════════════════════

clear
echo ""
echo -e "${B}  ACT 3 — Agents governing agents${X}"
divider

echo -e "  ${D}Not one agent — three roles, separation of duties.${X}"
echo -e "  ${D}The auditor can freeze any agent instantly.${X}"
pause 2

say "Agent registry"
curl -s "$API/agents" | pj "
  d.agents.forEach(a => {
    const icon = a.role==='proposer'?'📋':a.role==='executor'?'🔑':'👁️';
    console.log('  ' + icon + ' ' + a.name.padEnd(10) + '[' + a.role + ']');
    console.log('     ' + a.capabilities.join(', '));
  });
"
pause

say "Watchdog detects anomaly — freezes the proposer"
curl -s -X POST "$API/agents/bagel/freeze" \
  -H 'content-type: application/json' \
  -d '{"requestedBy":"auditor-1"}' | pj "
  console.log('  ${R}⚠  ' + d.message + '${X}');
"
pause
echo -e "  ${Y}Frozen agent attempts a transaction...${X}"
curl -s -X POST "$API/plans/evaluate" \
  -H 'content-type: application/json' \
  -d '{"planId":"rec-frz","agentId":"bagel","type":"transfer","amount":0.001,"destination":"0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6","reason":"Test while frozen"}' \
  | pj "
  console.log('  Decision:  ${R}' + d.result.decision.toUpperCase() + '${X}');
  console.log('  Rule:      ' + d.result.appliedRules.join(', '));
  console.log('  → Completely locked out. Zero access.');
"
pause
curl -s -X POST "$API/agents/bagel/unfreeze" \
  -H 'content-type: application/json' \
  -d '{"requestedBy":"admin"}' | pj "
  console.log('  ${G}✓ ' + d.message + '${X}');
"
pause 2

# ═════════════════════════════════════════════════════
# ACT 6 — YIELD DEPLOYMENT
# ═════════════════════════════════════════════════════

clear
echo ""
echo -e "${B}  ACT 4 — Not just spending yield. Deploying it.${X}"
divider

echo -e "  ${D}The agent doesn't just transfer yield — it trades it.${X}"
echo -e "  ${D}DCA into USDC. Swap to stable. Rebalance across assets.${X}"
echo -e "  ${D}All via Uniswap, same chain as the treasury. No bridging.${X}"
pause 3

say "Multi-bucket yield strategy"
curl -s "$API/strategy" | pj "
  if(d.error){ console.log('  (No strategy)'); } else {
    const s=d.strategy;
    s.buckets.forEach(b => console.log('  ' + b.label.padEnd(14) + b.percentage + '%  → ' + b.destination.slice(0,12) + '...'));
  }
"
pause

say "Live Uniswap quote — real-time pricing on Base"
curl -s "$API/swap/quote?tokenIn=0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452&tokenOut=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&amount=10000000000000000" \
  | pj "
  const q=d.quote;
  console.log('  0.01 wstETH → ' + q.amountOutFormatted + ' USDC');
  console.log('  Impact: ' + q.priceImpact + '%   Gas: \$' + parseFloat(q.gasEstimateUSD).toFixed(4));
  console.log('  Route:  Uniswap V3 on Base (same chain as treasury)');
"
pause

say "Policy-gated swap — yield into USDC"
curl -s -X POST "$API/swap/execute" \
  -H 'content-type: application/json' \
  -d '{"agentId":"bagel","tokenOut":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","amount":"10000000000000000","reason":"DCA yield into USDC","dryRun":true}' \
  | pj "
  console.log('  Policy:   ' + d.result.decision.toUpperCase());
  if(d.swap) {
    console.log('  Output:   ' + (parseInt(d.swap.amountOut)/1e6).toFixed(2) + ' USDC');
    console.log('  Mode:     dry run (simulation)');
  }
  console.log('  → Separate swap caps + slippage limits from transfers');
"
pause

say "3 configurable trading strategies"
curl -s "$API/swap/strategies" | pj "
  if(d.strategies) d.strategies.forEach(s =>
    console.log('  ' + s.label.padEnd(24) + s.allocationPercent + '%')
  );
"
pause 2

# ═════════════════════════════════════════════════════
# ACT 7 — IDENTITY & SERVICE
# ═════════════════════════════════════════════════════

clear
echo ""
echo -e "${B}  ACT 5 — Trust, identity, and agent-as-a-service${X}"
divider

say "ERC-8004 — on-chain agent identity on Base"
echo -e "  Agent ID:  ${B}10ee7e7e703b4fc493e19f512b5ae09d${X}"
echo -e "  Registry:  ERC-8004 on Base mainnet"
link "basescan.org/tx/0x4027641718bb5cfb9fdf7f4871f6506685b5367cab1a3a030b9bb0fe779ee934"
echo ""
echo -e "  ${D}Before paying anyone, the agent verifies their identity.${X}"
echo -e "  ${D}Unverified recipients → escalated to human approval.${X}"
pause 2

say "Trust-gated payment check"
curl -s "$API/verify/0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6" | pj "
  const v = d.identity || d;
  console.log('  Address:   0x4fD6...DCe6');
  console.log('  Verified:  ' + (v.verified || false));
  console.log('  → Identity shapes the policy decision');
"
pause

say "x402 — this treasury is a payable service"
curl -s "$API/x402/pricing" | pj "
  console.log('  Protocol:  x402 (HTTP 402 by Coinbase)');
  console.log('  Payment:   USDC on Base');
  d.endpoints.forEach(e => console.log('    ' + e.method.padEnd(5) + e.path.padEnd(20) + '\$' + e.priceUSD));
  console.log('');
  console.log('  Other agents pay to use this treasury.');
  console.log('  Swap quotes: \$0.01 · Execution: \$0.05');
"
pause

say "MoonPay bridge — 54 tools across 10+ chains"
curl -s "$API/moonpay/tools" | pj "
  console.log('  Tools:   ' + d.totalTools + ' (swaps, DCA, bridges, portfolio, fiat ramps)');
  console.log('  Chains:  Base, Ethereum, Arbitrum, Polygon, Optimism, ...');
  console.log('  Status:  All policy-gated through the same engine');
"
pause 2

# ═════════════════════════════════════════════════════
# ACT 8 — THE RECEIPTS
# ═════════════════════════════════════════════════════

clear
echo ""
echo -e "${B}  ACT 6 — The receipts${X}"
divider

say "Audit trail — every action, append-only, tamper-evident"
curl -s "$API/audit" | pj "
  const types = {};
  d.events.forEach(e => { types[e.type] = (types[e.type]||0)+1; });
  console.log('  Total events:  ' + d.events.length);
  Object.entries(types).sort((a,b)=>b[1]-a[1]).forEach(([t,c]) => console.log('    ' + t.padEnd(22) + c));
"
pause 2

echo ""
echo -e "  ${B}On-chain proof — verified on BaseScan:${X}"
echo ""
echo -e "  ${G}Treasury Contract${X}"
echo -e "  ${B}0x455d76a24e862a8d552a0722823ac4d13e482426${X}"
link "basescan.org/address/0x455d76a24e862a8d552a0722823ac4d13e482426"
echo ""
echo -e "  ${G}Contract Deploy TX${X}"
echo -e "  ${B}0x33e648434ce963eb47ddfb403df14f2faae20d72e78bf0e9ebafefa3e85ea0db${X}"
link "basescan.org/tx/0x33e648434ce963eb47ddfb403df14f2faae20d72e78bf0e9ebafefa3e85ea0db"
echo ""
echo -e "  ${G}Live Uniswap Swap (WETH → USDC)${X}"
echo -e "  ${B}0x9e387425cfddde0d2809d36a154b667ea37e8ea93a5943dda2c97416bc375ae9${X}"
link "basescan.org/tx/0x9e387425cfddde0d2809d36a154b667ea37e8ea93a5943dda2c97416bc375ae9"
echo ""
echo -e "  ${G}Permit2 Approval${X}"
echo -e "  ${B}0x536b75fd78f78106db68efcd3cdd7d162e8c6fe074e81dffa5841f8b888f462d${X}"
link "basescan.org/tx/0x536b75fd78f78106db68efcd3cdd7d162e8c6fe074e81dffa5841f8b888f462d"
echo ""
echo -e "  ${G}ERC-8004 Identity Registration${X}"
echo -e "  ${B}0x4027641718bb5cfb9fdf7f4871f6506685b5367cab1a3a030b9bb0fe779ee934${X}"
link "basescan.org/tx/0x4027641718bb5cfb9fdf7f4871f6506685b5367cab1a3a030b9bb0fe779ee934"
echo ""
echo -e "  ${G}Sepolia Test Treasury${X}"
echo -e "  ${B}0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0${X}"
link "sepolia.basescan.org/address/0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0"
sleep 4

# ═════════════════════════════════════════════════════
# FINALE — BOUNTY SHOWCASE + CREDITS
# ═════════════════════════════════════════════════════

clear
echo ""
echo -e "${B}╔══════════════════════════════════════════════════════════════╗${X}"
echo -e "${B}║                    9 Bounty Tracks                         ║${X}"
echo -e "${B}╚══════════════════════════════════════════════════════════════╝${X}"
echo ""
echo -e "  ${C}Lido Labs Foundation${X}"
echo -e "    ${G}■${X} stETH Agent Treasury        ${B}\$3,000${X}   wstETH yield-only spending"
echo -e "    ${G}■${X} Lido MCP                     ${B}\$5,000${X}   24 tools for staking + governance"
echo ""
echo -e "  ${C}Protocol Labs${X}"
echo -e "    ${G}■${X} Agents With Receipts (8004)  ${B}\$4,000${X}   on-chain identity + trust-gating"
echo -e "    ${G}■${X} Let the Agent Cook           ${B}\$4,000${X}   multi-agent, autonomous, safe"
echo ""
echo -e "  ${C}Base${X}"
echo -e "    ${G}■${X} Agent Services on Base       ${B}\$5,000${X}   x402 payment-gated service"
echo -e "    ${G}■${X} Autonomous Trading Agent     ${B}\$5,000${X}   DCA + yield trading on Base"
echo ""
echo -e "  ${C}Uniswap${X}"
echo -e "    ${G}■${X} Agentic Finance              ${B}\$5,000${X}   live swaps via Trading API"
echo ""
echo -e "  ${C}MoonPay${X}"
echo -e "    ${G}■${X} MoonPay CLI Agents           ${B}\$3,500${X}   54-tool multi-chain bridge"
echo ""
echo -e "  ${C}Synthesis Community${X}"
echo -e "    ${G}■${X} Open Track                  ${B}~\$28,000${X}  community-funded"
echo ""
echo -e "  ${D}──────────────────────────────────────────────${X}"
echo -e "  ${B}  Total potential:  ~\$62,500 across 9 tracks${X}"
sleep 5

clear
echo ""
echo ""
echo ""
echo -e "  ${B}Open Bound — Onchain Money Maker${X}"
echo ""
echo -e "  ${D}The thesis:${X}"
type_slow "Agents should have bounded financial autonomy —" "$W"
type_slow "not zero access, not full control." "$W"
type_slow "Just the yield. Never the principal." "$G"
echo ""
sleep 2
echo -e "  ${D}The proof:${X}"
echo -e "  ${D}Live contracts. Real swaps. Real receipts. Real policy enforcement.${X}"
echo ""
sleep 2
echo -e "  ${D}The team:${X}"
echo -e "  ${C}Oscar${X}   architect & orchestrator     ${D}(the human who never writes code)${X}"
echo -e "  ${C}Bagel${X}   Solidity & on-chain            ${D}(AI agent — Cursor)${X}"
echo -e "  ${C}Claude${X}  10 packages, 24 tools, 22 APIs ${D}(AI agent — CLI)${X}"
echo ""
sleep 2
echo -e "  ${D}Zero lines of human-written code.${X}"
echo -e "  ${D}One human with intent. Two agents with capability.${X}"
echo ""
sleep 3
echo -e "  ${C}github.com/MorkeethHQ/delegated-agent-treasury${X}"
echo ""
echo ""
