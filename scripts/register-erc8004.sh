#!/usr/bin/env bash
# ERC-8004 Agent Registration for Synthesis Hackathon
# Usage: Fill in YOUR_EMAIL and YOUR_SOCIAL_HANDLE, then run this script.
set -euo pipefail

API="https://synthesis.devfolio.co/register"

# ─── FILL THESE IN ───
EMAIL="YOUR_EMAIL"
SOCIAL_HANDLE="YOUR_SOCIAL_HANDLE"
NAME="Oscar"
# ─────────────────────

echo "=== Step 1: Initiate Registration ==="
INIT_RESPONSE=$(curl -s -X POST "$API/init" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Yieldbound \",
    \"description\": \"A yield-only treasury agent on Base. Deposits wstETH, spends only accrued yield. Principal is structurally locked. Three on-chain enforcements: recipient whitelist, per-tx cap, yield ceiling.\",
    \"agentHarness\": \"claude-code\",
    \"model\": \"claude-opus-4-6\",
    \"humanInfo\": {
      \"name\": \"$NAME\",
      \"email\": \"$EMAIL\",
      \"socialMediaHandle\": \"$SOCIAL_HANDLE\",
      \"background\": \"builder\",
      \"cryptoExperience\": \"a little\",
      \"aiAgentExperience\": \"yes\",
      \"codingComfort\": 7,
      \"problemToSolve\": \"Delegated treasury management for AI agents — bounded financial autonomy backed by wstETH yield on Base\"
    }
  }")

echo "$INIT_RESPONSE" | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  if (d.pendingId) {
    console.log('pendingId:', d.pendingId);
    console.log('\\nSave this! Expires in 24h.');
    console.log('\\nNext: run Step 2 (email verification)');
    console.log('  export PENDING_ID=' + d.pendingId);
  } else {
    console.log('Response:', JSON.stringify(d, null, 2));
  }
"

echo ""
echo "=== Step 2: Email Verification ==="
echo "After setting PENDING_ID, run:"
echo ""
echo "  # Send OTP to your email"
echo "  curl -s -X POST $API/verify/email/send \\"
echo "    -H 'Content-Type: application/json' \\"
echo '    -d "{\"pendingId\": \"$PENDING_ID\"}"'
echo ""
echo "  # Then confirm with the 6-digit code from your inbox"
echo "  curl -s -X POST $API/verify/email/confirm \\"
echo "    -H 'Content-Type: application/json' \\"
echo '    -d "{\"pendingId\": \"$PENDING_ID\", \"otp\": \"123456\"}"'
echo ""
echo "=== Step 3: Complete Registration ==="
echo "  curl -s -X POST $API/complete \\"
echo "    -H 'Content-Type: application/json' \\"
echo '    -d "{\"pendingId\": \"$PENDING_ID\"}"'
echo ""
echo "Response will contain: participantId, teamId, apiKey (shown ONCE), registrationTxn URL"
echo "Send Claude the registrationTxn URL — that's the ERC-8004 agent ID."
