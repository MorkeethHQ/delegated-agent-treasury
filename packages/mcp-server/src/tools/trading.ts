import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

function text(s: string) {
  return { content: [{ type: 'text' as const, text: s }] };
}

export function registerTradingTools(server: McpServer) {
  server.tool(
    'get_swap_quote',
    'Get a Uniswap quote for swapping yield tokens on Base. Returns expected output amount, price impact, and gas estimate.',
    {
      tokenIn: z.string().describe('Address of the input token (e.g. wstETH)'),
      tokenOut: z.string().describe('Address of the output token (e.g. USDC)'),
      amount: z.string().describe('Amount of input token in wei (string)'),
    },
    async ({ tokenIn, tokenOut, amount }) => {
      try {
        const res = await fetch(
          `${API_URL}/swap/quote?tokenIn=${encodeURIComponent(tokenIn)}&tokenOut=${encodeURIComponent(tokenOut)}&amount=${encodeURIComponent(amount)}`,
        );
        const data = await res.json();
        return text(JSON.stringify(data, null, 2));
      } catch (e) {
        return text(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
      }
    },
  );

  server.tool(
    'preview_yield_swap',
    'Preview what a DCA/swap strategy would do with the current available yield — calls Uniswap for indicative quotes without executing anything',
    {},
    async () => {
      try {
        const res = await fetch(`${API_URL}/swap/tokens`);
        const tokensData = await res.json();

        const previewRes = await fetch(`${API_URL}/strategy/preview`);
        const previewData = await previewRes.json();

        return text(JSON.stringify({
          availableTokens: tokensData,
          yieldPreview: previewData,
          hint: 'Use get_swap_quote to get a live Uniswap quote for a specific swap, or execute_yield_swap to execute one.',
        }, null, 2));
      } catch (e) {
        return text(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
      }
    },
  );

  server.tool(
    'execute_yield_swap',
    'Execute a yield swap through the policy engine — swaps yield tokens on Uniswap via Base chain. Supports dry_run mode.',
    {
      tokenOut: z.string().describe('Address of the output token to swap yield into'),
      amount: z.string().describe('Amount of yield token (wstETH) to swap, in wei'),
      reason: z.string().describe('Reason for the swap (for audit trail)'),
      dry_run: z.boolean().default(true).describe('If true, simulate only — do not execute on-chain'),
    },
    async ({ tokenOut, amount, reason, dry_run }) => {
      try {
        const res = await fetch(`${API_URL}/swap/execute`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            agentId: 'mcp-agent',
            tokenOut,
            amount,
            reason,
            dryRun: dry_run,
          }),
        });
        const data = await res.json();
        return text(JSON.stringify(data, null, 2));
      } catch (e) {
        return text(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
      }
    },
  );
}
