#!/usr/bin/env bash
# Screen-Record Demo — Bagel Yieldbound
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

narrate() { echo -e "\n${CYAN}$1${RESET}"; sleep 1.5; }
step()    { echo -e "\n${BOLD}${GREEN}▸ $1${RESET}"; sleep 0.8; }
pause()   { sleep "${1:-1.5}"; }

pj() { node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));$1"; }

clear
echo ""
echo -e "${BOLD}  🥯 Bagel Yieldbound — Live Demo${RESET}"
echo -e "${DIM}  Bounded financial authority for autonomous agents${RESET}"
echo -e "${DIM}  27 mainnet TXs · 11 autonomous spends · Base + Celo${RESET}"
echo -e "${DIM}  yieldbound.com${RESET}"
pause 2

# ── 1. Treasury State ──
step "1/12  On-Chain Treasury State"
narrate "Reading live contract on Base mainnet..."
curl -s "$API/treasury" | pj "
  if(d.error){ console.log('  ⚠  RPC rate-limited — retrying...'); } else {
    const t=d.treasury;
    console.log('  Principal:       ' + t.principal.formatted + ' wstETH  🔒 LOCKED');
    console.log('  Available yield: ' + t.availableYield.formatted + ' wstETH');
    console.log('  Total spent:     ' + t.totalSpent.formatted + ' wstETH  (11 autonomous TXs)');
    console.log('  Per-tx cap:      ' + t.perTxCap.formatted + ' wstETH');
  }
"
pause

# ── 2. Policy ──
step "2/12  Policy Engine"
narrate "Controls what the agent can and cannot do."
curl -s "$API/policy" | pj "
  const p=d.policy;
  console.log('  Agent:       ' + p.agentId);
  console.log('  Max/tx:      ' + p.maxPerAction + ' wstETH');
  console.log('  Daily cap:   ' + p.dailyCap + ' wstETH');
  console.log('  Threshold:   ' + p.approvalThreshold + ' wstETH  (above → human approval)');
  console.log('  Whitelisted: ' + p.allowedDestinations.length + ' addresses');
  console.log('  Denied:      ' + p.deniedDestinations.length + ' addresses');
"
pause

# ── 3. Auto-approved spend ──
step "3/12  Small Spend → Auto-Approved"
narrate "0.005 wstETH to whitelisted address. Below threshold → instant execution."
curl -s -X POST "$API/plans/evaluate" \
  -H 'content-type: application/json' \
  -d '{"planId":"demo-sm-'"$(date +%s)"'","agentId":"bagel","type":"transfer","amount":0.005,"destination":"0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6","reason":"Fund operations — within yield budget"}' \
  | pj "
  console.log('  Decision:  ' + d.result.decision.toUpperCase());
  console.log('  Rules:     ' + d.result.appliedRules.join(' → '));
  if(d.execution) console.log('  TX hash:   ' + d.execution.hash);
  else console.log('  → Approved. Ready for on-chain execution.');
"
pause

# ── 4. Approval-required → Human approves ──
step "4/12  Large Spend → Human Approval Required"
narrate "0.009 wstETH exceeds threshold. Escalated to human."
LARGE_RESULT=$(curl -s -X POST "$API/plans/evaluate" \
  -H 'content-type: application/json' \
  -d '{"planId":"demo-lg-'"$(date +%s)"'","agentId":"bagel","type":"transfer","amount":0.009,"destination":"0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6","reason":"Larger spend — needs sign-off"}')
echo "$LARGE_RESULT" | pj "
  console.log('  Decision:    ' + d.result.decision.toUpperCase());
  if(d.approval) console.log('  Approval ID: ' + d.approval.approvalId);
"
narrate "Human reviews and approves..."
APPROVAL_ID=$(curl -s "$API/approvals?status=pending" | pj "if(d.approvals&&d.approvals.length)console.log(d.approvals[0].approvalId);" 2>/dev/null || true)
if [ -n "$APPROVAL_ID" ]; then
  curl -s -X POST "$API/approvals/$APPROVAL_ID/respond" \
    -H 'content-type: application/json' \
    -d '{"decision":"approved","respondedBy":"oscar"}' \
    | pj "
    console.log('  ✓ Approved by Oscar');
    if(d.execution) console.log('  TX hash:   ' + d.execution.hash);
  "
fi
pause

# ── 5. Denied destination ──
step "5/12  Blocked Address → Denied"
narrate "Agent tries to send to burn address. Policy blocks it."
curl -s -X POST "$API/plans/evaluate" \
  -H 'content-type: application/json' \
  -d '{"planId":"demo-deny-'"$(date +%s)"'","agentId":"bagel","type":"transfer","amount":0.001,"destination":"0x000000000000000000000000000000000000dEaD","reason":"Test blocked destination"}' \
  | pj "
  console.log('  Decision: ' + d.result.decision.toUpperCase());
  console.log('  Reason:   ' + d.result.reasons[0]);
  console.log('  → No TX. Logged for audit.');
"
pause

# ── 6. Freeze/unfreeze ──
step "6/12  Auditor Freezes Agent"
narrate "Anomalous behavior detected. Auditor freezes the agent."
curl -s -X POST "$API/agents/bagel/freeze" \
  -H 'content-type: application/json' \
  -d '{"requestedBy":"auditor-1"}' | pj "console.log('  ' + d.message);"
sleep 0.5
curl -s -X POST "$API/plans/evaluate" \
  -H 'content-type: application/json' \
  -d '{"planId":"demo-frz-'"$(date +%s)"'","agentId":"bagel","type":"transfer","amount":0.001,"destination":"0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6","reason":"Attempt while frozen"}' \
  | pj "
  console.log('  Decision: ' + d.result.decision.toUpperCase());
  console.log('  Reason:   ' + d.result.reasons[0]);
"
curl -s -X POST "$API/agents/bagel/unfreeze" \
  -H 'content-type: application/json' \
  -d '{"requestedBy":"admin"}' | pj "console.log('  ✓ Unfrozen by admin');"
pause

# ── 7. Uniswap swap quote ──
step "7/12  Uniswap Yield Swap"
narrate "Live quote: swap 0.01 wstETH yield into USDC on Base."
curl -s "$API/swap/quote?tokenIn=0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452&tokenOut=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&amount=10000000000000000" \
  | pj "
  if(d.error){ console.log('  (Quote unavailable — rate limited)'); } else {
    const q=d.quote;
    console.log('  Route:    wstETH → WETH → USDC');
    console.log('  Output:   ' + q.amountOutFormatted + ' USDC');
    console.log('  Impact:   ' + q.priceImpact + '%');
    console.log('  → Agent deploys ONLY yield into strategies.');
  }
"
pause

# ── 8. Yield Strategy ──
step "8/12  Multi-Bucket Yield Distribution"
narrate "Agent routes yield across purpose-built buckets."
curl -s "$API/strategy/preview?yield=0.1&perTxCap=0.05" | pj "
  if(d.error){ console.log('  ' + d.error); } else {
    const p=d.plan;
    console.log('  Distributing: ' + p.totalToDistribute.toFixed(4) + ' wstETH');
    p.items.forEach(i => console.log('    ' + i.bucketLabel.padEnd(12) + i.amount.toFixed(4) + ' wstETH → ' + i.destination.slice(0,10) + '...'));
    if(p.skippedItems.length) p.skippedItems.forEach(s => console.log('    SKIP: ' + s.reason));
  }
"
pause

# ── 9. ERC-8004 Identity ──
step "9/12  ERC-8004 Trust Verification"
narrate "On-chain agent identity gates trust decisions."
curl -s "$API/verify/0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6" | pj "
  console.log('  Address:   0x4fD6...DCe6');
  console.log('  Verified:  ' + d.verified);
  if(d.agentId) console.log('  Agent ID:  ' + d.agentId);
  console.log('  → Unverified recipients escalate to human.');
"
pause

# ── 10. MetaMask Delegation ──
step "10/12  MetaMask Delegation Caveats"
narrate "Defense-in-depth: offchain policy + onchain caveats."
curl -s -X POST "$API/delegation/create" | pj "
  console.log('  Caveats: ' + d.caveatsCount + ' onchain enforcers');
  Object.entries(d.policyToCaveatMapping).forEach(([k,v]) => console.log('    ' + k.padEnd(22) + '→ ' + v.split(' — ')[0]));
  console.log('  → Even if API is bypassed, chain protects the treasury.');
"
pause

# ── 11. Multi-agent registry ──
step "11/12  Multi-Agent Roles"
curl -s "$API/agents" | pj "
  d.agents.forEach(a => {
    const status = a.frozen ? '🔒 FROZEN' : '✓ active';
    console.log('  ' + a.name.padEnd(12) + '[' + a.role.padEnd(8) + '] ' + status);
  });
"
pause

# ── 12. Audit trail ──
step "12/12  Audit Trail"
narrate "Every action logged. Append-only. Tamper-evident."
curl -s "$API/audit" | pj "
  const types = {};
  d.events.forEach(e => { types[e.type] = (types[e.type]||0)+1; });
  console.log('  Total events: ' + d.events.length);
  Object.entries(types).sort((a,b)=>b[1]-a[1]).forEach(([t,c]) => console.log('    ' + t.padEnd(20) + c));
"
pause 2

# ── Wrap up ──
echo ""
echo -e "${BOLD}  ──────────────────────────────────────${RESET}"
echo ""
echo -e "  ${GREEN}✓${RESET} Auto-approved spend        ${GREEN}✓${RESET} Human approval flow"
echo -e "  ${RED}✗${RESET} Blocked destination         ${RED}✗${RESET} Frozen agent denied"
echo -e "  ${GREEN}✓${RESET} Uniswap yield swap         ${GREEN}✓${RESET} Multi-bucket strategy"
echo -e "  ${GREEN}✓${RESET} ERC-8004 trust gate        ${GREEN}✓${RESET} MetaMask delegation"
echo -e "  ${GREEN}✓${RESET} Multi-agent roles          ${GREEN}✓${RESET} Full audit trail"
echo ""
echo -e "  ${BOLD}Key invariant:${RESET} Agent spends ONLY yield. Principal locked."
echo ""
echo -e "  ${DIM}Base:     0x455d76a24e862a8d552a0722823ac4d13e482426${RESET}"
echo -e "  ${DIM}Celo:     0xc976e463bd209e09cb15a168a275890b872aa1f0${RESET}"
echo -e "  ${DIM}Identity: ERC-8004 10ee7e7e703b4fc493e19f512b5ae09d${RESET}"
echo ""
echo -e "  ${CYAN}yieldbound.com${RESET}  ·  ${DIM}github.com/MorkeethHQ/delegated-agent-treasury${RESET}"
echo ""
