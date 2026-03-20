import { z } from 'zod';
import { formatEther, parseEther, type Address } from 'viem';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AGENT_TREASURY_ABI } from '../../../executor/src/abi.js';
import type { ClientConfig } from '../config.js';

function text(s: string) {
  return { content: [{ type: 'text' as const, text: s }] };
}

export function registerTreasuryTools(server: McpServer, config: ClientConfig) {
  const { publicClient, walletClient, treasuryAddress } = config;

  if (!treasuryAddress) return;

  server.tool(
    'get_treasury_state',
    'Get the full on-chain state of the Agent Treasury: available yield, locked principal, total spent, per-tx cap, authorized agent address',
    {},
    async () => {
      const [yield_, principal, spent, agent, perTxCap, deposited] = await Promise.all([
        publicClient.readContract({ address: treasuryAddress, abi: AGENT_TREASURY_ABI, functionName: 'availableYield' }),
        publicClient.readContract({ address: treasuryAddress, abi: AGENT_TREASURY_ABI, functionName: 'principal' }),
        publicClient.readContract({ address: treasuryAddress, abi: AGENT_TREASURY_ABI, functionName: 'totalSpent' }),
        publicClient.readContract({ address: treasuryAddress, abi: AGENT_TREASURY_ABI, functionName: 'agent' }),
        publicClient.readContract({ address: treasuryAddress, abi: AGENT_TREASURY_ABI, functionName: 'perTxCap' }),
        publicClient.readContract({ address: treasuryAddress, abi: AGENT_TREASURY_ABI, functionName: 'depositedWstETH' }),
      ]);

      return text(JSON.stringify({
        availableYield: formatEther(yield_),
        principal: formatEther(principal),
        totalSpent: formatEther(spent),
        depositedWstETH: formatEther(deposited),
        perTxCap: formatEther(perTxCap),
        agent,
        unit: 'wstETH',
      }, null, 2));
    },
  );

  server.tool(
    'spend_yield',
    'Spend accrued wstETH yield from the Agent Treasury to a whitelisted recipient. Only available yield can be spent — principal is locked. Requires agent wallet.',
    {
      to: z.string().describe('Recipient address (must be whitelisted by treasury owner)'),
      amount: z.string().describe('Amount of wstETH to spend (e.g. "0.005")'),
      dry_run: z.boolean().default(false).describe('If true, simulate the transaction without executing'),
    },
    async ({ to, amount, dry_run }) => {
      if (!walletClient) return text('Error: agent wallet not configured');

      const amountWei = parseEther(amount);

      if (dry_run) {
        try {
          await publicClient.simulateContract({
            address: treasuryAddress,
            abi: AGENT_TREASURY_ABI,
            functionName: 'spendYield',
            args: [to as Address, amountWei],
            account: walletClient.account,
          });
          return text(JSON.stringify({ dry_run: true, status: 'would_succeed', amount, to }));
        } catch (e) {
          return text(JSON.stringify({ dry_run: true, status: 'would_fail', error: e instanceof Error ? e.message : String(e) }));
        }
      }

      const hash = await walletClient.writeContract({
        address: treasuryAddress,
        abi: AGENT_TREASURY_ABI,
        functionName: 'spendYield',
        args: [to as Address, amountWei],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      return text(JSON.stringify({
        status: 'executed',
        hash,
        blockNumber: Number(receipt.blockNumber),
        amount,
        to,
      }));
    },
  );

  server.tool(
    'check_recipient',
    'Check if an address is whitelisted as a valid recipient in the Agent Treasury',
    {
      address: z.string().describe('Address to check'),
    },
    async ({ address }) => {
      const allowed = await publicClient.readContract({
        address: treasuryAddress,
        abi: AGENT_TREASURY_ABI,
        functionName: 'isRecipient',
        args: [address as Address],
      });
      return text(JSON.stringify({ address, whitelisted: allowed }));
    },
  );
}
