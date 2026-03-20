#!/usr/bin/env bash
# Screen-Record Demo — narrated walkthrough for hackathon judges
# Usage: Start API first (node --env-file=.env dist/apps/api/src/server.js)
#        Then: bash scripts/screen-demo.sh
set -euo pipefail

API=${API_URL:-http://localhost:3001}

# --- Colors & helpers ---
BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
DIM='\033[2m'
RESET='\033[0m'

narrate() { echo -e "\n${CYAN}$1${RESET}"; sleep 2; }
step()    { echo -e "\n${BOLD}${GREEN}--- $1 ---${RESET}"; sleep 1; }
result()  { echo -e "${YELLOW}$1${RESET}"; }
pause()   { sleep "${1:-2}"; }

pj() { node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));$1"; }

clear
echo -e "${BOLD}============================================${RESET}"
echo -e "${BOLD}  Synthesis Agent Treasury — Live Demo${RESET}"
echo -e "${BOLD}============================================${RESET}"
echo -e "${DIM}Yield-only spending for AI agents on Base${RESET}"
echo -e "${DIM}Built by 2 AI agents + 1 human orchestrator${RESET}"
pause 3

# ── 1. Health ──
step "1/8  System Health"
narrate "Checking API server and on-chain executor connection..."
curl -s "$API/health" | pj "
  console.log('  API:      ' + (d.ok ? '✓ healthy' : '✗ down'));
  console.log('  Executor: ' + d.executor);
"
pause

# ── 2. Policy ──
step "2/8  Active Policy Configuration"
narrate "The policy engine controls what the agent can and cannot do."
curl -s "$API/policy" | pj "
  const p=d.policy;
  console.log('  Policy:    ' + p.policyId);
  console.log('  Agent:     ' + p.agentId);
  console.log('  Max/tx:    ' + p.maxPerAction + ' wstETH');
  console.log('  Daily cap: ' + p.dailyCap + ' wstETH');
  console.log('  Threshold: ' + p.approvalThreshold + ' wstETH (above this → human approval)');
  console.log('  Allowed:   ' + p.allowedDestinations.length + ' whitelisted destinations');
  console.log('  Denied:    ' + p.deniedDestinations.length + ' blocked destinations');
"
pause

# ── 3. Treasury ──
step "3/8  On-Chain Treasury State"
narrate "Reading live state from the AgentTreasury contract on Base..."
curl -s "$API/treasury" | pj "
  if(d.error){
    console.log('  (Executor not configured — API-only mode)');
  } else {
    const t=d.treasury;
    console.log('  Available yield: ' + t.availableYield.formatted + ' wstETH');
    console.log('  Principal:       ' + t.principal.formatted + ' wstETH  (structurally LOCKED)');
    console.log('  Total spent:     ' + t.totalSpent.formatted + ' wstETH');
    console.log('  Per-tx cap:      ' + t.perTxCap.formatted + ' wstETH');
  }
"
pause 3

# ── 4. Auto-approved spend ──
step "4/8  Small Transfer → Auto-Approved"
narrate "Agent submits a 0.005 wstETH spend. Below the approval threshold → auto-executes."
curl -s -X POST "$API/plans/evaluate" \
  -H 'content-type: application/json' \
  -d '{"planId":"demo-small-1","agentId":"bagel","type":"transfer","amount":0.005,"destination":"0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6","reason":"Fund approved workflow — small amount"}' \
  | pj "
  console.log('  Decision:  ' + d.result.decision.toUpperCase());
  console.log('  Rules:     ' + d.result.appliedRules.join(', '));
  if(d.execution) console.log('  ON-CHAIN:  ' + d.execution.hash);
"
pause

# ── 5. Approval-required spend ──
step "5/8  Larger Transfer → Requires Human Approval"
narrate "Agent submits 0.009 wstETH. Above threshold → policy engine escalates to human."
LARGE_RESULT=$(curl -s -X POST "$API/plans/evaluate" \
  -H 'content-type: application/json' \
  -d '{"planId":"demo-large-1","agentId":"bagel","type":"transfer","amount":0.009,"destination":"0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6","reason":"Larger spend — requires human approval"}')
echo "$LARGE_RESULT" | pj "
  console.log('  Decision:    ' + d.result.decision.toUpperCase());
  if(d.approval) console.log('  Approval ID: ' + d.approval.approvalId);
  console.log('  → Waiting for human review...');
"
pause

# ── 6. Human approves ──
step "6/8  Human Approves the Pending Request"
narrate "A human operator reviews and approves via CLI or API."
APPROVAL_ID=$(curl -s "$API/approvals?status=pending" | pj "if(d.approvals.length)console.log(d.approvals[0].approvalId);")
if [ -n "$APPROVAL_ID" ]; then
  curl -s -X POST "$API/approvals/$APPROVAL_ID/respond" \
    -H 'content-type: application/json' \
    -d '{"decision":"approved","respondedBy":"oscar"}' \
    | pj "
    console.log('  Approved by: oscar');
    console.log('  Status:      ' + d.approval.status.toUpperCase());
    if(d.execution) console.log('  ON-CHAIN TX: ' + d.execution.hash);
  "
else
  echo "  (No pending approvals)"
fi
pause

# ── 7. Yield Strategy ──
step "7/10  Yield Strategy Engine"
narrate "Multi-bucket distribution — agent routes yield to ops, grants, reserve."
curl -s "$API/strategy" | pj "
  if(d.error){ console.log('  (No strategy loaded)'); } else {
    const s=d.strategy;
    console.log('  Strategy:  ' + s.strategyId);
    console.log('  Ratio:     ' + (s.distributionRatio*100) + '% of yield');
    console.log('  Threshold: ' + s.minYieldThreshold + ' wstETH min');
    s.buckets.forEach(b => console.log('  Bucket:    ' + b.label + ' → ' + b.percentage + '%'));
  }
"
pause

# ── 8. Strategy Preview ──
step "8/10  Strategy Preview (Dry Run)"
narrate "Preview how 0.1 wstETH yield would be distributed across buckets."
curl -s "$API/strategy/preview?yield=0.1&perTxCap=0.05" | pj "
  if(d.error){ console.log('  ' + d.error); } else {
    const p=d.plan;
    console.log('  Total to distribute: ' + p.totalToDistribute.toFixed(6) + ' wstETH');
    p.items.forEach(i => console.log('    ' + i.bucketLabel + ': ' + i.amount.toFixed(6) + ' wstETH → ' + i.destination.slice(0,10) + '...'));
    if(p.skippedItems.length) p.skippedItems.forEach(s => console.log('    SKIP: ' + s.bucketId + ' — ' + s.reason));
  }
"
pause

# ── 9. Uniswap Yield Swap ──
step "9/12  Yield Swap via Uniswap (DCA)"
narrate "Agent swaps 0.01 wstETH yield into USDC via Uniswap on Base."
curl -s -X POST "$API/swap/execute" \
  -H 'content-type: application/json' \
  -d '{"agentId":"bagel","tokenOut":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","amount":"10000000000000000","reason":"DCA yield into USDC — autonomous strategy","dryRun":true}' \
  | pj "
  console.log('  Policy:    ' + d.result.decision.toUpperCase());
  if(d.swap) {
    console.log('  Swap:      0.01 wstETH → ' + (parseInt(d.swap.amountOut)/1e6).toFixed(2) + ' USDC');
    console.log('  Mode:      dry run (simulation)');
    console.log('  → Agent deploys ONLY yield into bounded strategies.');
  }
"
pause

# ── 10. ERC-8004 Identity ──
step "10/12  ERC-8004 Trust Verification"
narrate "Before paying a recipient, verify their on-chain agent identity."
curl -s "$API/verify/0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6" | pj "
  console.log('  Address:  0x4fD6...DCe6');
  console.log('  Verified: ' + d.verified);
  if(d.agentId) console.log('  Agent ID: ' + d.agentId);
  if(d.name) console.log('  Name:     ' + d.name);
  console.log('  → Unverified recipients escalate to human approval.');
"
pause

# ── 11. Swap Quote ──
step "11/12  Live Uniswap Quote"
narrate "Real-time pricing from Uniswap on Base — no bridge, same chain as treasury."
curl -s "$API/swap/quote?tokenIn=0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452&tokenOut=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&amount=10000000000000000" \
  | pj "
  const q=d.quote;
  console.log('  Route:     wstETH → WETH → USDC (Uniswap V3)');
  console.log('  In:        0.01 wstETH');
  console.log('  Out:       ' + q.amountOutFormatted + ' USDC');
  console.log('  Impact:    ' + q.priceImpact + '%');
  console.log('  Gas:       $' + parseFloat(q.gasEstimateUSD).toFixed(4));
"
pause

# ── 12. Denied destination ──
step "12/12  Blocked Destination → Denied"
narrate "Agent tries to send to a denied address. Policy engine blocks it immediately."
curl -s -X POST "$API/plans/evaluate" \
  -H 'content-type: application/json' \
  -d '{"planId":"demo-denied-1","agentId":"bagel","type":"transfer","amount":0.005,"destination":"0xDeniedDestination1","reason":"Attempt to send to blocked address"}' \
  | pj "
  console.log('  Decision: ' + d.result.decision.toUpperCase());
  console.log('  Reason:   ' + d.result.reasons.join('; '));
  console.log('  → Blocked. No on-chain transaction. Logged for audit.');
"
pause

# ── Audit trail ──
echo ""
echo -e "${BOLD}--- Audit Trail ---${RESET}"
narrate "Every action is logged — append-only, tamper-evident."
curl -s "$API/audit" | pj "
  const types = {};
  d.events.forEach(e => { types[e.type] = (types[e.type]||0)+1; });
  console.log('  Total events: ' + d.events.length);
  Object.entries(types).forEach(([t,c]) => console.log('    ' + t + ': ' + c));
"
pause 2

# ── Wrap up ──
echo ""
echo -e "${BOLD}============================================${RESET}"
echo -e "${BOLD}  Demo Complete${RESET}"
echo -e "${BOLD}============================================${RESET}"
echo ""
echo -e "  ${GREEN}✓${RESET} Auto-approved spend (below threshold)"
echo -e "  ${GREEN}✓${RESET} Human-approved spend (above threshold)"
echo -e "  ${GREEN}✓${RESET} Multi-bucket yield strategy"
echo -e "  ${GREEN}✓${RESET} Uniswap yield swap (DCA)"
echo -e "  ${GREEN}✓${RESET} Live swap quotes on Base"
echo -e "  ${GREEN}✓${RESET} ERC-8004 trust verification"
echo -e "  ${RED}✗${RESET} Denied spend (blocked destination)"
echo -e "  ${GREEN}✓${RESET} Full audit trail captured"
echo ""
echo -e "  ${BOLD}Key invariant:${RESET} Agent can ONLY spend yield."
echo -e "  Principal is structurally locked at the contract level."
echo ""
echo -e "  ${DIM}Mainnet:  0x455d76a24e862a8d552a0722823ac4d13e482426${RESET}"
echo -e "  ${DIM}Sepolia:  0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0${RESET}"
echo -e "  ${DIM}Identity: ERC-8004 agent 10ee7e7e703b4fc493e19f512b5ae09d${RESET}"
echo ""
echo -e "  ${CYAN}github.com/MorkeethHQ/delegated-agent-treasury${RESET}"
echo ""
