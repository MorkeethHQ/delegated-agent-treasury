#!/usr/bin/env bash
# Judge Demo — run through the full system in under 2 minutes
# Prerequisites: npm install && npm run build, .env configured, API running
set -euo pipefail

API=${API_URL:-http://localhost:3001}
CLI="node dist/apps/cli/src/cli.js"

echo "=== Synthesis Agent Treasury — Judge Demo ==="
echo ""

# 1. Health check
echo "--- 1. System health ---"
$CLI health
echo ""

# 2. Show policy
echo "--- 2. Active policy ---"
$CLI policy
echo ""

# 3. Show treasury state (on-chain)
echo "--- 3. On-chain treasury state ---"
$CLI treasury
echo ""

# 4. Submit a small plan (auto-approved)
echo "--- 4. Submit plan: small transfer (auto-approved) ---"
$CLI evaluate '{
  "planId": "demo-small-1",
  "agentId": "bagel",
  "type": "transfer",
  "amount": 50,
  "destination": "0xApprovedDestination1",
  "reason": "Fund approved workflow — small amount, auto-executes"
}'
echo ""

# 5. Submit a larger plan (requires approval)
echo "--- 5. Submit plan: larger transfer (approval required) ---"
RESULT=$(curl -s -X POST "$API/plans/evaluate" \
  -H 'content-type: application/json' \
  -d '{
    "planId": "demo-large-1",
    "agentId": "bagel",
    "type": "transfer",
    "amount": 80,
    "destination": "0xApprovedDestination1",
    "reason": "Larger spend — requires human approval"
  }')
echo "$RESULT" | node -e "
  const r = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log('Decision:', r.result.decision);
  console.log('Reasons:', r.result.reasons.join('; '));
  if (r.approval) console.log('Approval ID:', r.approval.approvalId);
"
echo ""

# 6. Show pending approvals
echo "--- 6. Pending approvals ---"
$CLI approvals pending
echo ""

# 7. Approve it
echo "--- 7. Human approves the request ---"
# Get the approval ID from the pending list
APPROVAL_ID=$(curl -s "$API/approvals?status=pending" | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  if (d.approvals.length > 0) console.log(d.approvals[0].approvalId);
")
if [ -n "$APPROVAL_ID" ]; then
  $CLI approve "$APPROVAL_ID" judge-demo
else
  echo "(No pending approvals to approve)"
fi
echo ""

# 8. Submit a denied plan
echo "--- 8. Submit plan: denied destination ---"
$CLI evaluate '{
  "planId": "demo-denied-1",
  "agentId": "bagel",
  "type": "transfer",
  "amount": 50,
  "destination": "0xDenied1",
  "reason": "Attempt to send to blocked address"
}'
echo ""

# 9. Audit trail
echo "--- 9. Audit trail (last 10 events) ---"
$CLI audit 10
echo ""

echo "=== Demo complete ==="
echo "Every action was policy-evaluated, permission-scoped, and audit-logged."
echo "The agent can only spend yield — principal is structurally locked on-chain."
