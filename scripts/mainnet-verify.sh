#!/usr/bin/env bash
# Mainnet Verification — run after treasury is deployed and funded on Base mainnet
# Usage: TREASURY_ADDRESS=0x... AGENT_PRIVATE_KEY=0x... ./scripts/mainnet-verify.sh
set -euo pipefail

RPC_URL=${RPC_URL:-https://mainnet.base.org}
WSTETH=0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452
TREASURY=${TREASURY_ADDRESS:?Set TREASURY_ADDRESS}

echo "=== Base Mainnet Treasury Verification ==="
echo "Treasury: $TREASURY"
echo "wstETH:   $WSTETH"
echo "RPC:      $RPC_URL"
echo ""

# 1. Read treasury state
echo "--- 1. Treasury owner ---"
cast call $TREASURY "owner()" --rpc-url $RPC_URL
echo ""

echo "--- 2. Authorized agent ---"
cast call $TREASURY "agent()" --rpc-url $RPC_URL
echo ""

echo "--- 3. Principal (deposited wstETH) ---"
cast call $TREASURY "principal()" --rpc-url $RPC_URL
echo ""

echo "--- 4. Available yield ---"
cast call $TREASURY "availableYield()" --rpc-url $RPC_URL
echo ""

echo "--- 5. Per-tx cap ---"
cast call $TREASURY "perTxCap()" --rpc-url $RPC_URL
echo ""

echo "--- 6. Total spent ---"
cast call $TREASURY "totalSpent()" --rpc-url $RPC_URL
echo ""

echo "--- 7. wstETH exchange rate (stEthPerToken) ---"
cast call $WSTETH "stEthPerToken()" --rpc-url $RPC_URL
echo ""

echo "--- 8. Treasury wstETH balance ---"
cast call $WSTETH "balanceOf(address)" $TREASURY --rpc-url $RPC_URL
echo ""

# 9. API verification (if running)
API=${API_URL:-http://localhost:3001}
echo "--- 9. API health check ---"
curl -s "$API/health" 2>/dev/null | node -e "
  try {
    const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    console.log('API:', d.ok ? 'healthy' : 'down', '| executor:', d.executor);
  } catch { console.log('API not running (start with: CHAIN=base RPC_URL=$RPC_URL TREASURY_ADDRESS=$TREASURY WSTETH_ADDRESS=$WSTETH node dist/apps/api/src/server.js)'); }
" || echo "API not reachable"
echo ""

echo "--- 10. API treasury state ---"
curl -s "$API/treasury" 2>/dev/null | node -e "
  try {
    const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    if (d.error) { console.log('Error:', d.error); }
    else {
      const t=d.treasury;
      console.log('Available yield:', t.availableYield.formatted, 'wstETH');
      console.log('Principal:      ', t.principal.formatted, 'wstETH');
      console.log('Total spent:    ', t.totalSpent.formatted, 'wstETH');
      console.log('Per-tx cap:     ', t.perTxCap.formatted, 'wstETH');
      console.log('Agent:          ', t.agent);
    }
  } catch { console.log('API not running or treasury endpoint failed'); }
" || echo "API not reachable"
echo ""

echo "=== Verification complete ==="
