import { z } from 'zod';
import { formatEther, parseEther, type Address } from 'viem';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { STETH_ABI, WSTETH_ABI, WITHDRAWAL_QUEUE_ABI, LIDO_ADDRESSES } from '../lido-abi.js';
import type { ClientConfig } from '../config.js';

function text(s: string) {
  return { content: [{ type: 'text' as const, text: s }] };
}

export function registerStakingTools(server: McpServer, config: ClientConfig) {
  const { publicClient, walletClient, chain } = config;

  // Only available on Ethereum mainnet (where Lido staking contract lives)
  const isEthereum = chain === 'ethereum';
  const stETH = LIDO_ADDRESSES.ethereum.stETH;
  const wstETH = config.wstETHAddress ?? LIDO_ADDRESSES.ethereum.wstETH;
  const withdrawalQueue = LIDO_ADDRESSES.ethereum.withdrawalQueue;

  // --- Balance queries (work on any chain with wstETH) ---

  server.tool(
    'get_wsteth_balance',
    'Get the wstETH balance of an address, plus its equivalent value in stETH at the current exchange rate',
    {
      address: z.string().describe('Wallet address to check'),
    },
    async ({ address }) => {
      const balance = await publicClient.readContract({
        address: wstETH,
        abi: WSTETH_ABI,
        functionName: 'balanceOf',
        args: [address as Address],
      });

      const rate = await publicClient.readContract({
        address: wstETH,
        abi: WSTETH_ABI,
        functionName: 'stEthPerToken',
      });

      const stETHValue = (balance * rate) / BigInt(1e18);

      return text(JSON.stringify({
        address,
        wstETH: formatEther(balance),
        stETHValue: formatEther(stETHValue),
        exchangeRate: formatEther(rate),
      }, null, 2));
    },
  );

  server.tool(
    'get_steth_exchange_rate',
    'Get the current wstETH/stETH exchange rate. wstETH is non-rebasing — this rate increases over time as staking rewards accrue.',
    {},
    async () => {
      const rate = await publicClient.readContract({
        address: wstETH,
        abi: WSTETH_ABI,
        functionName: 'stEthPerToken',
      });

      return text(JSON.stringify({
        stEthPerWstETH: formatEther(rate),
        explanation: 'Each wstETH is worth this many stETH. This number increases over time as staking rewards accrue.',
      }));
    },
  );

  // --- Write operations (stake, wrap, unwrap, unstake) ---
  // These require a wallet and are only meaningful on Ethereum mainnet
  // (except wrap/unwrap which work with our mock on Base Sepolia too)

  server.tool(
    'stake_eth',
    'Stake ETH with Lido to receive stETH. This submits ETH to the Lido staking pool. Only works on Ethereum mainnet.',
    {
      amount: z.string().describe('Amount of ETH to stake (e.g. "1.0")'),
      dry_run: z.boolean().default(false).describe('If true, simulate without executing'),
    },
    async ({ amount, dry_run }) => {
      if (!isEthereum) return text('Error: stake_eth is only available on Ethereum mainnet. On L2s, acquire wstETH via bridging or swapping.');
      if (!walletClient) return text('Error: wallet not configured');

      const value = parseEther(amount);

      if (dry_run) {
        try {
          await publicClient.simulateContract({
            address: stETH,
            abi: STETH_ABI,
            functionName: 'submit',
            args: ['0x0000000000000000000000000000000000000000' as Address],
            value,
            account: walletClient.account,
          });
          return text(JSON.stringify({ dry_run: true, status: 'would_succeed', amount, action: 'stake ETH → stETH' }));
        } catch (e) {
          return text(JSON.stringify({ dry_run: true, status: 'would_fail', error: e instanceof Error ? e.message : String(e) }));
        }
      }

      const hash = await walletClient.writeContract({
        address: stETH,
        abi: STETH_ABI,
        functionName: 'submit',
        args: ['0x0000000000000000000000000000000000000000' as Address],
        value,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      return text(JSON.stringify({
        status: 'executed',
        action: 'stake ETH → stETH',
        hash,
        blockNumber: Number(receipt.blockNumber),
        amount,
      }));
    },
  );

  server.tool(
    'wrap_steth',
    'Wrap stETH into wstETH. wstETH is non-rebasing and easier to use in DeFi. Requires stETH balance and approval.',
    {
      amount: z.string().describe('Amount of stETH to wrap (e.g. "1.0")'),
      dry_run: z.boolean().default(false).describe('If true, simulate without executing'),
    },
    async ({ amount, dry_run }) => {
      if (!walletClient) return text('Error: wallet not configured');
      if (!isEthereum) return text('Error: wrap is only available on Ethereum mainnet where stETH exists natively.');

      const amountWei = parseEther(amount);

      if (dry_run) {
        try {
          await publicClient.simulateContract({
            address: wstETH,
            abi: WSTETH_ABI,
            functionName: 'wrap',
            args: [amountWei],
            account: walletClient.account,
          });
          return text(JSON.stringify({ dry_run: true, status: 'would_succeed', amount, action: 'wrap stETH → wstETH' }));
        } catch (e) {
          return text(JSON.stringify({ dry_run: true, status: 'would_fail', error: e instanceof Error ? e.message : String(e) }));
        }
      }

      // Approve wstETH contract to pull stETH
      const approveHash = await walletClient.writeContract({
        address: stETH,
        abi: STETH_ABI,
        functionName: 'approve',
        args: [wstETH, amountWei],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      const hash = await walletClient.writeContract({
        address: wstETH,
        abi: WSTETH_ABI,
        functionName: 'wrap',
        args: [amountWei],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      return text(JSON.stringify({
        status: 'executed',
        action: 'wrap stETH → wstETH',
        hash,
        blockNumber: Number(receipt.blockNumber),
        amount,
      }));
    },
  );

  server.tool(
    'unwrap_wsteth',
    'Unwrap wstETH back to stETH. Returns the stETH equivalent at the current exchange rate.',
    {
      amount: z.string().describe('Amount of wstETH to unwrap (e.g. "0.5")'),
      dry_run: z.boolean().default(false).describe('If true, simulate without executing'),
    },
    async ({ amount, dry_run }) => {
      if (!walletClient) return text('Error: wallet not configured');
      if (!isEthereum) return text('Error: unwrap is only available on Ethereum mainnet where stETH exists natively.');

      const amountWei = parseEther(amount);

      if (dry_run) {
        try {
          await publicClient.simulateContract({
            address: wstETH,
            abi: WSTETH_ABI,
            functionName: 'unwrap',
            args: [amountWei],
            account: walletClient.account,
          });
          return text(JSON.stringify({ dry_run: true, status: 'would_succeed', amount, action: 'unwrap wstETH → stETH' }));
        } catch (e) {
          return text(JSON.stringify({ dry_run: true, status: 'would_fail', error: e instanceof Error ? e.message : String(e) }));
        }
      }

      const hash = await walletClient.writeContract({
        address: wstETH,
        abi: WSTETH_ABI,
        functionName: 'unwrap',
        args: [amountWei],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      return text(JSON.stringify({
        status: 'executed',
        action: 'unwrap wstETH → stETH',
        hash,
        blockNumber: Number(receipt.blockNumber),
        amount,
      }));
    },
  );

  server.tool(
    'request_withdrawal',
    'Request a withdrawal of stETH back to ETH. This enters the Lido withdrawal queue. The withdrawal must be claimed after finalization (typically 1-5 days). Only on Ethereum mainnet.',
    {
      amount: z.string().describe('Amount of stETH to withdraw (e.g. "1.0")'),
      dry_run: z.boolean().default(false).describe('If true, simulate without executing'),
    },
    async ({ amount, dry_run }) => {
      if (!isEthereum) return text('Error: withdrawals are only available on Ethereum mainnet.');
      if (!walletClient) return text('Error: wallet not configured');

      const amountWei = parseEther(amount);

      if (dry_run) {
        try {
          await publicClient.simulateContract({
            address: withdrawalQueue,
            abi: WITHDRAWAL_QUEUE_ABI,
            functionName: 'requestWithdrawals',
            args: [[amountWei], walletClient.account.address],
            account: walletClient.account,
          });
          return text(JSON.stringify({ dry_run: true, status: 'would_succeed', amount, action: 'request stETH → ETH withdrawal' }));
        } catch (e) {
          return text(JSON.stringify({ dry_run: true, status: 'would_fail', error: e instanceof Error ? e.message : String(e) }));
        }
      }

      // Approve withdrawal queue to pull stETH
      const approveHash = await walletClient.writeContract({
        address: stETH,
        abi: STETH_ABI,
        functionName: 'approve',
        args: [withdrawalQueue, amountWei],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      const hash = await walletClient.writeContract({
        address: withdrawalQueue,
        abi: WITHDRAWAL_QUEUE_ABI,
        functionName: 'requestWithdrawals',
        args: [[amountWei], walletClient.account.address],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      return text(JSON.stringify({
        status: 'executed',
        action: 'request stETH → ETH withdrawal (queued)',
        hash,
        blockNumber: Number(receipt.blockNumber),
        amount,
        note: 'Withdrawal must be claimed after finalization (1-5 days)',
      }));
    },
  );

  // --- Protocol stats ---

  if (isEthereum) {
    server.tool(
      'get_lido_protocol_stats',
      'Get Lido protocol statistics: total pooled ETH, total shares, and the implied stETH/ETH exchange rate',
      {},
      async () => {
        const [totalPooled, totalShares] = await Promise.all([
          publicClient.readContract({ address: stETH, abi: STETH_ABI, functionName: 'getTotalPooledEther' }),
          publicClient.readContract({ address: stETH, abi: STETH_ABI, functionName: 'getTotalShares' }),
        ]);

        return text(JSON.stringify({
          totalPooledETH: formatEther(totalPooled),
          totalShares: formatEther(totalShares),
          impliedRate: totalShares > 0n ? formatEther((totalPooled * BigInt(1e18)) / totalShares) : 'N/A',
        }, null, 2));
      },
    );
  }
}
