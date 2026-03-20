#!/usr/bin/env bash
set -e

# Fallback demo: runs the full approval flow using API-only mode (no deployed contract needed)
# Use this if contract deployment slips or RPC is down

API=${API_URL:-http://localhost:3001}
CLI="node dist/apps/cli/src/cli.js"

echo "=== Synthesis Agent Treasury — API-only Demo ==="
echo ""

echo "1. Checking API health..."
$CLI health
echo ""

echo "2. Current policy:"
$CLI policy
echo ""

echo "3. Agent submits plan within policy (auto-approved):"
curl -s -X POST "$API/plans/evaluate" \
  -H 'content-type: application/json' \
  -d '{
    "planId": "demo-auto",
    "agentId": "bagel",
    "type": "transfer",
    "amount": 50,
    "destination": "0xApprovedDestination1",
    "reason": "Routine payment within policy"
  }' | node -e "
    process.stdin.on('data', d => {
      const r = JSON.parse(d);
      console.log('   Decision:', r.result.decision);
      console.log('   Reasons:', r.result.reasons.join('; '));
    })
  "
echo ""

echo "4. Agent submits plan that exceeds threshold (needs human approval):"
curl -s -X POST "$API/plans/evaluate" \
  -H 'content-type: application/json' \
  -d '{
    "planId": "demo-approval",
    "agentId": "bagel",
    "type": "transfer",
    "amount": 80,
    "destination": "0xApprovedDestination1",
    "reason": "Larger payment requiring human review"
  }' | node -e "
    process.stdin.on('data', d => {
      const r = JSON.parse(d);
      console.log('   Decision:', r.result.decision);
      console.log('   Approval ID:', r.approval?.approvalId);
    })
  "
echo ""

echo "5. Pending approvals:"
$CLI approvals pending
echo ""

APPROVAL_ID=$(curl -s "$API/approvals?status=pending" | node -e "
  process.stdin.on('data', d => {
    const a = JSON.parse(d).approvals[0];
    if (a) process.stdout.write(a.approvalId);
  })
")

if [ -n "$APPROVAL_ID" ]; then
  echo "6. Human approves the request:"
  $CLI approve "$APPROVAL_ID" human-operator
  echo ""
fi

echo "7. Agent submits plan to denied destination (blocked):"
curl -s -X POST "$API/plans/evaluate" \
  -H 'content-type: application/json' \
  -d '{
    "planId": "demo-denied",
    "agentId": "bagel",
    "type": "transfer",
    "amount": 10,
    "destination": "0xDeniedDestination1",
    "reason": "Attempt to send to blocked address"
  }' | node -e "
    process.stdin.on('data', d => {
      const r = JSON.parse(d);
      console.log('   Decision:', r.result.decision);
      console.log('   Reasons:', r.result.reasons.join('; '));
    })
  "
echo ""

echo "8. Full audit trail:"
$CLI audit 10
echo ""

echo "=== Demo complete ==="
echo ""
echo "What you just saw:"
echo "  - Auto-approved: plan within policy executed immediately"
echo "  - Approval gate: plan above threshold required human sign-off"
echo "  - Hard deny: plan to blocked destination rejected outright"
echo "  - Every action logged to immutable audit trail"
