#!/usr/bin/env bash
set -e

# Fallback demo: runs the full approval flow using API-only mode (no deployed contract needed)
# Use this if contract deployment slips or RPC is down

API=${API_URL:-http://localhost:3001}

pj() { node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));$1"; }

echo "=== Synthesis Agent Treasury — API-only Demo ==="
echo ""

echo "1. Checking API health..."
curl -s "$API/health" | pj "console.log('API:', d.ok?'healthy':'down', '| executor:', d.executor);"
echo ""

echo "2. Current policy:"
curl -s "$API/policy" | pj "
  const p=d.policy;
  console.log('  Policy:', p.policyId, '| Agent:', p.agentId);
  console.log('  Max/action:', p.maxPerAction, '| Daily cap:', p.dailyCap, '| Threshold:', p.approvalThreshold);
  console.log('  Allowed:', p.allowedDestinations.join(', '));
  console.log('  Denied:', p.deniedDestinations.join(', '));
"
echo ""

echo "3. Agent submits plan within policy (auto-approved):"
curl -s -X POST "$API/plans/evaluate" \
  -H 'content-type: application/json' \
  -d '{"planId":"demo-auto","agentId":"bagel","type":"transfer","amount":50,"destination":"0xApprovedDestination1","reason":"Routine payment within policy"}' \
  | pj "console.log('   Decision:', d.result.decision); console.log('   Reasons:', d.result.reasons.join('; '));"
echo ""

echo "4. Agent submits plan that exceeds threshold (needs human approval):"
curl -s -X POST "$API/plans/evaluate" \
  -H 'content-type: application/json' \
  -d '{"planId":"demo-approval","agentId":"bagel","type":"transfer","amount":80,"destination":"0xApprovedDestination1","reason":"Larger payment requiring human review"}' \
  | pj "console.log('   Decision:', d.result.decision); if(d.approval) console.log('   Approval ID:', d.approval.approvalId);"
echo ""

echo "5. Pending approvals:"
curl -s "$API/approvals?status=pending" | pj "d.approvals.forEach(a=>console.log('  ['+a.status.toUpperCase()+']',a.approvalId,'-',a.plan.amount,'to',a.plan.destination)); if(!d.approvals.length) console.log('  (none)');"
echo ""

APPROVAL_ID=$(curl -s "$API/approvals?status=pending" | pj "if(d.approvals.length)console.log(d.approvals[0].approvalId);")

if [ -n "$APPROVAL_ID" ]; then
  echo "6. Human approves the request:"
  curl -s -X POST "$API/approvals/$APPROVAL_ID/respond" \
    -H 'content-type: application/json' \
    -d '{"decision":"approved","respondedBy":"human-operator"}' \
    | pj "console.log('   Approved:', d.approval.approvalId, '→ status:', d.approval.status);"
  echo ""
fi

echo "7. Agent submits plan to denied destination (blocked):"
curl -s -X POST "$API/plans/evaluate" \
  -H 'content-type: application/json' \
  -d '{"planId":"demo-denied","agentId":"bagel","type":"transfer","amount":10,"destination":"0xDeniedDestination1","reason":"Attempt to send to blocked address"}' \
  | pj "console.log('   Decision:', d.result.decision); console.log('   Reasons:', d.result.reasons.join('; '));"
echo ""

echo "8. Full audit trail:"
curl -s "$API/audit" | pj "d.events.slice(0,10).forEach(e=>console.log('  ['+new Date(e.timestamp).toLocaleTimeString()+']',e.type)); console.log('  '+d.events.length+' total events');"
echo ""

echo "=== Demo complete ==="
echo ""
echo "What you just saw:"
echo "  - Auto-approved: plan within policy executed immediately"
echo "  - Approval gate: plan above threshold required human sign-off"
echo "  - Hard deny: plan to blocked destination rejected outright"
echo "  - Every action logged to immutable audit trail"
