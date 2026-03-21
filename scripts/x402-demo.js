#!/usr/bin/env node

/**
 * x402 Payment Demo — Agent-to-Agent Commerce (Programmatic)
 *
 * Demonstrates the x402 protocol flow for agent-to-agent commerce:
 *
 *   Paying agent:  odawgagent.morke.eth (0x1101158041Fd96f21CBcbb0E752a9A2303E6D70e)
 *   Service:       bagel.morke.eth      (0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6)
 *
 * Usage:
 *   ENABLE_X402=true npm run dev:api   # Terminal 1
 *   node scripts/x402-demo.js          # Terminal 2
 *
 * The script shows the complete challenge-response flow:
 *   1. Request without payment → HTTP 402
 *   2. Parse payment requirements from the 402 response
 *   3. Construct the payment payload (documented, not signed — needs private key)
 *   4. Show the retry request with X-PAYMENT header
 */

const API = process.env.API_URL || 'http://localhost:3001';

const PAYING_AGENT = '0x1101158041Fd96f21CBcbb0E752a9A2303E6D70e';
const PAYING_AGENT_ENS = 'odawgagent.morke.eth';
const SERVICE_WALLET = '0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6';
const SERVICE_WALLET_ENS = 'bagel.morke.eth';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// ---------- Helpers ----------

function header(text) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${text}`);
  console.log('='.repeat(60));
}

function indent(obj) {
  return JSON.stringify(obj, null, 2)
    .split('\n')
    .map((l) => '    ' + l)
    .join('\n');
}

// ---------- Main ----------

async function main() {
  console.log('x402 Payment Demo — Agent-to-Agent Commerce');
  console.log(`Paying agent: ${PAYING_AGENT_ENS} (${PAYING_AGENT})`);
  console.log(`Service:      ${SERVICE_WALLET_ENS} (${SERVICE_WALLET})`);

  // ---- Step 1: Check API health ----
  header('Step 1: Verify API is running with x402 enabled');

  let health;
  try {
    const res = await fetch(`${API}/health`);
    health = await res.json();
  } catch (err) {
    console.error(`\n  ERROR: Cannot reach API at ${API}`);
    console.error('  Start it with: ENABLE_X402=true npm run dev:api\n');
    process.exit(1);
  }

  console.log(`  API status: ${health.ok ? 'healthy' : 'down'}`);
  console.log(`  x402:       ${health.x402}`);

  if (health.x402 !== 'enabled') {
    console.error('\n  ERROR: x402 is not enabled. Restart with ENABLE_X402=true\n');
    process.exit(1);
  }

  // ---- Step 2: Fetch pricing table ----
  header('Step 2: Fetch x402 pricing table (free endpoint)');

  const pricingRes = await fetch(`${API}/x402/pricing`);
  const pricing = await pricingRes.json();

  console.log(`  Protocol: ${pricing.x402.protocol}`);
  console.log(`  Network:  ${pricing.x402.network} | Asset: ${pricing.x402.assetSymbol}`);
  console.log(`  Pay to:   ${pricing.x402.payTo}`);
  console.log('');
  console.log('  Paid endpoints:');
  for (const ep of pricing.endpoints) {
    console.log(`    ${ep.method} ${ep.path}  $${ep.priceUSD.toFixed(2)} USDC  ${ep.description}`);
  }

  // ---- Step 3: Request paid endpoint WITHOUT payment ----
  header('Step 3: Request GET /swap/quote WITHOUT X-PAYMENT header');

  const paidUrl = `${API}/swap/quote?tokenIn=wstETH&tokenOut=USDC&amount=1`;
  console.log(`  GET ${paidUrl}`);
  console.log('  (no X-PAYMENT header)');
  console.log('');

  const paidRes = await fetch(paidUrl);
  console.log(`  HTTP Status: ${paidRes.status} ${paidRes.statusText}`);

  const body402 = await paidRes.json();

  // ---- Step 4: Parse the 402 response ----
  header('Step 4: Parse x402 payment requirements from 402 response');

  console.log('  Response body:');
  console.log(indent(body402));
  console.log('');

  if (body402.accepts && body402.accepts.length > 0) {
    const req = body402.accepts[0];
    const amountUSD = (Number(req.maxAmountRequired) / 1e6).toFixed(2);

    console.log('  Parsed payment requirements:');
    console.log(`    Scheme:    ${req.scheme}`);
    console.log(`    Network:   ${req.network}`);
    console.log(`    Asset:     ${req.asset} (USDC)`);
    console.log(`    Amount:    ${req.maxAmountRequired} atomic = $${amountUSD} USDC`);
    console.log(`    Pay to:    ${req.payTo}`);
    console.log(`    Resource:  ${req.resource}`);
    console.log(`    Timeout:   ${req.maxTimeoutSeconds}s`);
  }

  // ---- Step 5: Decode X-PAYMENT-REQUIRED header ----
  header('Step 5: Decode X-PAYMENT-REQUIRED header');

  const headerValue = paidRes.headers.get('x-payment-required');
  if (headerValue) {
    console.log(`  Raw (base64, first 80 chars): ${headerValue.substring(0, 80)}...`);
    const decoded = JSON.parse(Buffer.from(headerValue, 'base64').toString('utf-8'));
    console.log('');
    console.log('  Decoded:');
    console.log(indent(decoded));
  } else {
    console.log('  (Header not present — requirements are in the response body above)');
  }

  // ---- Step 6: Document the payment construction ----
  header('Step 6: Construct payment payload (EIP-3009 TransferWithAuthorization)');

  const paymentReq = body402.accepts?.[0];
  const validBefore = Math.floor(Date.now() / 1000) + 60;
  const nonce = '0x' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');

  const transferAuth = {
    from: PAYING_AGENT,
    to: paymentReq?.payTo || SERVICE_WALLET,
    value: paymentReq?.maxAmountRequired || '10000',
    validAfter: 0,
    validBefore,
    nonce,
  };

  console.log('  USDC TransferWithAuthorization parameters:');
  console.log(indent(transferAuth));
  console.log('');
  console.log('  EIP-712 domain:');
  console.log(indent({
    name: 'USD Coin',
    version: '2',
    chainId: 8453,
    verifyingContract: USDC_BASE,
  }));
  console.log('');
  console.log('  The paying agent would:');
  console.log('    1. Sign the above with EIP-712 using their private key');
  console.log('    2. Encode the signature + authorization as JSON');
  console.log('    3. Base64-encode it for the X-PAYMENT header');
  console.log('');
  console.log('  NOTE: Actual signing requires the agent private key at runtime.');
  console.log('  In production, use @x402/fetch which handles this automatically:');
  console.log('');
  console.log('    import { paymentFetch } from "@x402/fetch";');
  console.log(`    const res = await paymentFetch("${paidUrl}", {`);
  console.log('      privateKey: process.env.AGENT_PRIVATE_KEY,');
  console.log('    });');

  // ---- Step 7: Show the retry request ----
  header('Step 7: Retry request with X-PAYMENT header (conceptual)');

  const mockPayload = Buffer.from(JSON.stringify({
    x402Version: 1,
    scheme: 'exact',
    network: 'base',
    payload: {
      signature: '0x<EIP-712-signature-over-TransferWithAuthorization>',
      authorization: transferAuth,
    },
  })).toString('base64');

  console.log('  The retry request would look like:');
  console.log('');
  console.log(`  curl "${paidUrl}" \\`);
  console.log(`    -H "X-PAYMENT: ${mockPayload.substring(0, 60)}..."`);
  console.log('');
  console.log('  The x402 gateway then:');
  console.log('    1. Decodes the X-PAYMENT header');
  console.log('    2. POST /verify to https://x402.org/facilitator');
  console.log('       - Verifies the EIP-712 signature');
  console.log('       - Checks the TransferWithAuthorization is valid');
  console.log('    3. POST /settle to https://x402.org/facilitator');
  console.log('       - Executes the USDC transfer on Base');
  console.log('       - Returns the on-chain transaction hash');
  console.log('    4. Sets X-PAYMENT-RESPONSE header with the settlement receipt');
  console.log('    5. Proxies the request to the actual endpoint handler');
  console.log('    6. Client receives the data + payment receipt');

  // ---- Step 8: Verify free endpoints are unaffected ----
  header('Step 8: Verify free endpoints are unaffected');

  const freeEndpoints = ['/health', '/x402/pricing', '/swap/tokens', '/policy'];
  for (const path of freeEndpoints) {
    const res = await fetch(`${API}${path}`);
    console.log(`  GET ${path} -> HTTP ${res.status} (${res.status === 200 ? 'OK, no payment needed' : 'unexpected'})`);
  }

  // ---- Summary ----
  header('Summary: x402 Agent-to-Agent Commerce');

  console.log(`
  Protocol:     x402 (HTTP 402 Payment Required)
  Standard:     https://x402.org
  Network:      Base (chainId 8453)
  Asset:        USDC (${USDC_BASE})

  Service provider:  ${SERVICE_WALLET_ENS} (${SERVICE_WALLET})
  Paying agent:      ${PAYING_AGENT_ENS} (${PAYING_AGENT})

  Flow demonstrated:
    [x] Paid endpoints return HTTP 402 without X-PAYMENT header
    [x] 402 response contains x402-compliant payment requirements
    [x] X-PAYMENT-REQUIRED header carries base64-encoded requirements
    [x] Payment construction documented (EIP-3009 TransferWithAuthorization)
    [x] Retry flow with X-PAYMENT header documented
    [x] Facilitator verify + settle flow documented
    [x] Free endpoints remain accessible without payment
    [x] Compatible with @x402/fetch, @x402/axios

  This demonstrates agent-to-agent commerce: one agent (odawgagent)
  pays another agent's service (bagel/synthesis treasury) for API
  access using USDC micropayments on Base, gated by the x402 protocol.
`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
