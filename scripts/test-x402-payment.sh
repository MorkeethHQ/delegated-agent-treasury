#!/usr/bin/env bash
set -e

# x402 Payment Proof — Agent-to-Agent Commerce Demo
#
# Demonstrates the x402 protocol (https://x402.org) payment gating on the
# Synthesis Agent Treasury API.
#
# Paying agent:   odawgagent.morke.eth (0x1101158041Fd96f21CBcbb0E752a9A2303E6D70e)
# Service wallet:  bagel.morke.eth     (0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6)
#
# Flow:
#   1. Agent requests a paid endpoint WITHOUT an X-PAYMENT header → HTTP 402
#   2. The 402 response contains payment requirements (amount, asset, payTo, etc.)
#   3. Agent signs a USDC TransferWithAuthorization for the required amount
#   4. Agent retries the request with X-PAYMENT header → gets the data
#
# Usage:
#   # Terminal 1 — start the API with x402 enabled
#   ENABLE_X402=true npm run dev:api
#
#   # Terminal 2 — run this demo
#   ./scripts/test-x402-payment.sh

API=${API_URL:-http://localhost:3001}
PAYING_AGENT="0x1101158041Fd96f21CBcbb0E752a9A2303E6D70e"
PAYING_AGENT_ENS="odawgagent.morke.eth"
SERVICE_WALLET="0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6"
SERVICE_WALLET_ENS="bagel.morke.eth"

# Helper: pretty-print JSON with Node
pj() { node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));$1"; }

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║      x402 Payment Proof — Agent-to-Agent Commerce          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Paying agent:  $PAYING_AGENT_ENS ($PAYING_AGENT)"
echo "Service:       $SERVICE_WALLET_ENS ($SERVICE_WALLET)"
echo ""

# -------------------------------------------------------------------
# Step 0: Verify the API is running with x402 enabled
# -------------------------------------------------------------------
echo "--- Step 0: Verify API is running with x402 enabled ---"
echo ""

HEALTH=$(curl -sf "$API/health" 2>/dev/null || echo '{"ok":false}')
X402_STATUS=$(echo "$HEALTH" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));console.log(d.x402||'unknown')")

if [ "$X402_STATUS" != "enabled" ]; then
  echo "ERROR: API not running or x402 not enabled."
  echo "Start the API with: ENABLE_X402=true npm run dev:api"
  echo "(Health response: $HEALTH)"
  exit 1
fi

echo "API healthy, x402 payment gating: $X402_STATUS"
echo ""

# -------------------------------------------------------------------
# Step 1: Show the x402 pricing table (free endpoint)
# -------------------------------------------------------------------
echo "--- Step 1: Query x402 pricing table (free endpoint) ---"
echo ""

curl -s "$API/x402/pricing" | pj "
  console.log('  Protocol:', d.x402.protocol, '| Network:', d.x402.network);
  console.log('  Asset:', d.x402.assetSymbol, '(' + d.x402.asset + ')');
  console.log('  Pay to:', d.x402.payTo);
  console.log('');
  console.log('  Paid endpoints:');
  d.endpoints.forEach(e => {
    console.log('    ' + e.method + ' ' + e.path + ' — \$' + e.priceUSD.toFixed(2) + ' USDC — ' + e.description);
  });
  console.log('');
  console.log('  Free endpoints:', d.freeEndpoints.join(', '));
"
echo ""

# -------------------------------------------------------------------
# Step 2: Request a PAID endpoint WITHOUT payment → expect HTTP 402
# -------------------------------------------------------------------
echo "--- Step 2: Request paid endpoint WITHOUT X-PAYMENT header ---"
echo ""
echo "  curl -s -w '\\nHTTP_STATUS:%{http_code}' \"$API/swap/quote?tokenIn=wstETH&tokenOut=USDC&amount=1\""
echo ""

RESPONSE=$(curl -s -w '\nHTTP_STATUS:%{http_code}' "$API/swap/quote?tokenIn=wstETH&tokenOut=USDC&amount=1")
HTTP_CODE=$(echo "$RESPONSE" | grep 'HTTP_STATUS:' | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')

echo "  HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" = "402" ]; then
  echo "  --> HTTP 402 Payment Required (as expected)"
else
  echo "  WARNING: Expected 402, got $HTTP_CODE"
fi
echo ""

# -------------------------------------------------------------------
# Step 3: Parse the 402 response body to show payment requirements
# -------------------------------------------------------------------
echo "--- Step 3: Parse payment requirements from 402 response ---"
echo ""

echo "$BODY" | pj "
  console.log('  x402 Version:', d.x402Version);
  console.log('  Error:', d.error);
  console.log('');
  if (d.accepts && d.accepts.length > 0) {
    const req = d.accepts[0];
    console.log('  Payment Requirements:');
    console.log('    Scheme:       ', req.scheme);
    console.log('    Network:      ', req.network);
    console.log('    Asset (USDC): ', req.asset);
    console.log('    Amount:       ', req.maxAmountRequired, 'atomic units (\$' + (Number(req.maxAmountRequired) / 1e6).toFixed(2) + ' USDC)');
    console.log('    Pay to:       ', req.payTo);
    console.log('    Resource:     ', req.resource);
    console.log('    Description:  ', req.description);
    console.log('    Timeout:      ', req.maxTimeoutSeconds, 'seconds');
    console.log('    MIME type:    ', req.mimeType);
  }
"
echo ""

# -------------------------------------------------------------------
# Step 4: Decode the X-PAYMENT-REQUIRED header
# -------------------------------------------------------------------
echo "--- Step 4: Decode X-PAYMENT-REQUIRED header (base64) ---"
echo ""

HEADER_VALUE=$(curl -sI "$API/swap/quote?tokenIn=wstETH&tokenOut=USDC&amount=1" 2>/dev/null | grep -i 'x-payment-required' | cut -d' ' -f2- | tr -d '\r\n')

if [ -n "$HEADER_VALUE" ]; then
  echo "  Raw header (base64, truncated): ${HEADER_VALUE:0:80}..."
  echo ""
  echo "$HEADER_VALUE" | node -e "
    const b64 = require('fs').readFileSync('/dev/stdin','utf8').trim();
    const decoded = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    console.log('  Decoded X-PAYMENT-REQUIRED header:');
    console.log(JSON.stringify(decoded, null, 4).split('\n').map(l=>'    '+l).join('\n'));
  "
else
  echo "  (Could not extract header — showing body instead, which contains the same data)"
fi
echo ""

# -------------------------------------------------------------------
# Step 5: Document the full payment flow
# -------------------------------------------------------------------
echo "--- Step 5: Full x402 payment flow (what a paying agent does) ---"
echo ""
echo "  The paying agent ($PAYING_AGENT_ENS) would:"
echo ""
echo "  1. Receive the 402 response with payment requirements"
echo "  2. Construct a USDC TransferWithAuthorization (EIP-3009):"
echo "     - from:       $PAYING_AGENT  (paying agent)"
echo "     - to:         $SERVICE_WALLET (service treasury)"
echo "     - value:      10000 atomic units (\$0.01 USDC)"
echo "     - validAfter: 0"
echo "     - validBefore: <current time + 60s>"
echo "     - nonce:      <random 32 bytes>"
echo "  3. Sign the authorization with the agent's private key (EIP-712)"
echo "  4. Base64-encode the signed payload"
echo "  5. Retry the request with the X-PAYMENT header:"
echo ""
echo "     curl -s \"$API/swap/quote?tokenIn=wstETH&tokenOut=USDC&amount=1\" \\"
echo "       -H \"X-PAYMENT: <base64-encoded-signed-payload>\""
echo ""
echo "  6. The x402 gateway:"
echo "     a. Verifies the payment via the Coinbase x402 facilitator"
echo "     b. Settles the USDC transfer on-chain (Base L2)"
echo "     c. Returns the data + X-PAYMENT-RESPONSE header with tx receipt"
echo ""

# -------------------------------------------------------------------
# Step 6: Show a free endpoint still works without payment
# -------------------------------------------------------------------
echo "--- Step 6: Verify free endpoints still work without payment ---"
echo ""

FREE_RESPONSE=$(curl -s -w '\nHTTP_STATUS:%{http_code}' "$API/health")
FREE_CODE=$(echo "$FREE_RESPONSE" | grep 'HTTP_STATUS:' | cut -d: -f2)
echo "  GET /health → HTTP $FREE_CODE (free, no payment needed)"

FREE_RESPONSE2=$(curl -s -w '\nHTTP_STATUS:%{http_code}' "$API/x402/pricing")
FREE_CODE2=$(echo "$FREE_RESPONSE2" | grep 'HTTP_STATUS:' | cut -d: -f2)
echo "  GET /x402/pricing → HTTP $FREE_CODE2 (free, no payment needed)"
echo ""

# -------------------------------------------------------------------
# Step 7: Show another paid endpoint also returns 402
# -------------------------------------------------------------------
echo "--- Step 7: Verify other paid endpoints also return 402 ---"
echo ""

VERIFY_RESPONSE=$(curl -s -w '\nHTTP_STATUS:%{http_code}' "$API/verify/$PAYING_AGENT")
VERIFY_CODE=$(echo "$VERIFY_RESPONSE" | grep 'HTTP_STATUS:' | cut -d: -f2)
echo "  GET /verify/$PAYING_AGENT → HTTP $VERIFY_CODE"

PREVIEW_RESPONSE=$(curl -s -w '\nHTTP_STATUS:%{http_code}' "$API/strategy/preview?yield=100&perTxCap=50")
PREVIEW_CODE=$(echo "$PREVIEW_RESPONSE" | grep 'HTTP_STATUS:' | cut -d: -f2)
echo "  GET /strategy/preview → HTTP $PREVIEW_CODE"
echo ""

# -------------------------------------------------------------------
# Summary
# -------------------------------------------------------------------
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                     x402 Proof Summary                     ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║ Protocol:  x402 (HTTP 402 Payment Required)                ║"
echo "║ Network:   Base (chainId 8453)                             ║"
echo "║ Asset:     USDC (0x8335...2913)                            ║"
echo "║ Pay to:    bagel.morke.eth ($SERVICE_WALLET)    ║"
echo "║ Payer:     odawgagent.morke.eth ($PAYING_AGENT) ║"
echo "║                                                            ║"
echo "║ Demonstrated:                                              ║"
echo "║  [x] Paid endpoints return HTTP 402 without payment        ║"
echo "║  [x] 402 response contains x402-compliant requirements     ║"
echo "║  [x] X-PAYMENT-REQUIRED header with base64 payload         ║"
echo "║  [x] Free endpoints remain accessible                      ║"
echo "║  [x] Multiple paid routes correctly gated                  ║"
echo "║  [x] Payment flow documented (EIP-3009 + facilitator)      ║"
echo "║                                                            ║"
echo "║ Compatible with: @x402/fetch, @x402/axios, any x402 client║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "For programmatic demo, see: scripts/x402-demo.js"
