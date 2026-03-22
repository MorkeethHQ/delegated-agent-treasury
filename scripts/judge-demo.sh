#!/usr/bin/env bash
# Judge Demo — run through the full system in under 2 minutes
# Prerequisites: npm install && npm run build, .env configured, API running on PORT
set -euo pipefail

API=${API_URL:-http://localhost:3001}

pj() { node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));$1"; }

echo "=== Open Bound — Judge Demo ==="
echo ""

# 1. Health check
echo "--- 1. System health ---"
curl -s "$API/health" | pj "console.log('API:', d.ok?'healthy':'down', '| executor:', d.executor);"
echo ""

# 2. Show policy
echo "--- 2. Active policy ---"
curl -s "$API/policy" | pj "
  const p=d.policy;
  console.log('Policy:', p.policyId);
  console.log('  Agent:', p.agentId, '| Max/action:', p.maxPerAction, '| Daily cap:', p.dailyCap);
  console.log('  Approval threshold:', p.approvalThreshold);
  console.log('  Allowed:', p.allowedDestinations.join(', ') || '(any)');
  console.log('  Denied:', p.deniedDestinations.join(', ') || '(none)');
"
echo ""

# 3. Show treasury state (on-chain)
echo "--- 3. On-chain treasury state ---"
curl -s "$API/treasury" | pj "
  if(d.error){console.log('(Executor not configured — API-only mode)');}
  else{const t=d.treasury; console.log('Yield:', t.availableYield.formatted, 'wstETH | Principal:', t.principal.formatted, 'wstETH | Spent:', t.totalSpent.formatted, 'wstETH');}
"
echo ""

# 4. Submit a small plan (auto-approved)
echo "--- 4. Submit plan: small transfer (auto-approved) ---"
curl -s -X POST "$API/plans/evaluate" \
  -H 'content-type: application/json' \
  -d '{"planId":"demo-small-1","agentId":"bagel","type":"transfer","amount":0.005,"destination":"0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6","reason":"Fund approved workflow — small amount, auto-executes"}' \
  | pj "console.log('Decision:', d.result.decision); console.log('Rules:', d.result.appliedRules.join(', ')); console.log('Reasons:', d.result.reasons.join('; '));"
echo ""

# 5. Submit a larger plan (requires approval)
echo "--- 5. Submit plan: larger transfer (approval required) ---"
curl -s -X POST "$API/plans/evaluate" \
  -H 'content-type: application/json' \
  -d '{"planId":"demo-large-1","agentId":"bagel","type":"transfer","amount":0.009,"destination":"0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6","reason":"Larger spend — requires human approval"}' \
  | pj "console.log('Decision:', d.result.decision); if(d.approval) console.log('Approval ID:', d.approval.approvalId);"
echo ""

# 6. Show pending approvals
echo "--- 6. Pending approvals ---"
curl -s "$API/approvals?status=pending" | pj "d.approvals.forEach(a=>console.log('['+a.status.toUpperCase()+']',a.approvalId,'-',a.plan.amount,'to',a.plan.destination)); if(!d.approvals.length) console.log('(none)');"
echo ""

# 7. Approve it
echo "--- 7. Human approves the request ---"
APPROVAL_ID=$(curl -s "$API/approvals?status=pending" | pj "if(d.approvals.length)console.log(d.approvals[0].approvalId);")
if [ -n "$APPROVAL_ID" ]; then
  curl -s -X POST "$API/approvals/$APPROVAL_ID/respond" \
    -H 'content-type: application/json' \
    -d '{"decision":"approved","respondedBy":"judge-demo"}' \
    | pj "console.log('Approved:', d.approval.approvalId, '→ status:', d.approval.status); if(d.execution) console.log('Executed on-chain:', d.execution.hash);"
else
  echo "(No pending approvals to approve)"
fi
echo ""

# 8. Submit a denied plan
echo "--- 8. Submit plan: denied destination ---"
curl -s -X POST "$API/plans/evaluate" \
  -H 'content-type: application/json' \
  -d '{"planId":"demo-denied-1","agentId":"bagel","type":"transfer","amount":0.005,"destination":"0xDeniedDestination1","reason":"Attempt to send to blocked address"}' \
  | pj "console.log('Decision:', d.result.decision); console.log('Reasons:', d.result.reasons.join('; '));"
echo ""

# 9. Audit trail
echo "--- 9. Audit trail (last 10 events) ---"
curl -s "$API/audit" | pj "d.events.slice(0,10).forEach(e=>console.log('['+new Date(e.timestamp).toLocaleTimeString()+']',e.type)); console.log('\\n'+d.events.length+' total events');"
echo ""

echo "=== Demo complete ==="
echo "Every action was policy-evaluated, permission-scoped, and audit-logged."
echo "The agent can only spend yield — principal is structurally locked on-chain."
