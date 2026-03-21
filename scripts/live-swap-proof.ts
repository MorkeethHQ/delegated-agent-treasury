/**
 * Live Swap Proof — wraps ETH→WETH then swaps WETH→USDC on Base mainnet
 * Usage: npx tsx scripts/live-swap-proof.ts
 *
 * This proves our Uniswap integration works end-to-end on-chain.
 * Does NOT require wstETH — uses native ETH the wallet already has.
 */

import { createWalletClient, createPublicClient, http, parseEther, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { executeSwapLive, TOKENS } from '../packages/trading-engine/src/index.js';

const AGENT_KEY = process.env.AGENT_PRIVATE_KEY as `0x${string}`;
if (!AGENT_KEY) { console.error('Set AGENT_PRIVATE_KEY'); process.exit(1); }

const account = privateKeyToAccount(AGENT_KEY);
const publicClient = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') });
const walletClient = createWalletClient({ account, chain: base, transport: http('https://mainnet.base.org') });

const WETH = TOKENS.WETH.address as `0x${string}`;
const USDC = TOKENS.USDC.address;
const WRAP_AMOUNT = parseEther('0.001'); // 0.001 ETH ≈ $2.65

async function main() {
  console.log(`Agent: ${account.address}`);

  // Check ETH balance
  const ethBalance = await publicClient.getBalance({ address: account.address });
  console.log(`ETH balance: ${formatUnits(ethBalance, 18)} ETH`);

  if (ethBalance < WRAP_AMOUNT + parseEther('0.0005')) {
    console.error('Insufficient ETH (need ~0.0015 ETH for wrap + gas)');
    process.exit(1);
  }

  // Step 1: Wrap ETH → WETH
  console.log('\n--- Step 1: Wrap 0.001 ETH → WETH ---');
  const wrapHash = await walletClient.sendTransaction({
    to: WETH,
    value: WRAP_AMOUNT,
    data: '0xd0e30db0' as `0x${string}`, // deposit() selector
  });
  console.log(`Wrap TX: https://basescan.org/tx/${wrapHash}`);

  // Wait for confirmation
  const wrapReceipt = await publicClient.waitForTransactionReceipt({ hash: wrapHash });
  console.log(`Wrap confirmed: block ${wrapReceipt.blockNumber}, status: ${wrapReceipt.status}`);

  if (wrapReceipt.status !== 'success') {
    console.error('Wrap failed!');
    process.exit(1);
  }

  // Step 2: Swap WETH → USDC via Uniswap
  console.log('\n--- Step 2: Swap 0.001 WETH → USDC via Uniswap ---');
  const swapResult = await executeSwapLive(
    WETH,
    USDC,
    WRAP_AMOUNT.toString(),
    walletClient as any,
  );

  console.log(`\nSwap result:`);
  console.log(`  Success: ${swapResult.success}`);
  if (swapResult.txHash) console.log(`  TX: https://basescan.org/tx/${swapResult.txHash}`);
  if (swapResult.amountOut !== '0') console.log(`  Output: ${formatUnits(BigInt(swapResult.amountOut), 6)} USDC`);
  if (swapResult.error) console.log(`  Error: ${swapResult.error}`);

  console.log('\n--- Done ---');
  if (swapResult.success && swapResult.txHash) {
    console.log(`\nPROOF: Live Uniswap swap on Base mainnet`);
    console.log(`Wrap TX:  https://basescan.org/tx/${wrapHash}`);
    console.log(`Swap TX:  https://basescan.org/tx/${swapResult.txHash}`);
  }
}

main().catch(console.error);
