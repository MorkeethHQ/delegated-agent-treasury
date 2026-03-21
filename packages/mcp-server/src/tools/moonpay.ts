import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

function text(s: string) {
  return { content: [{ type: 'text' as const, text: s }] };
}

export function registerMoonPayTools(server: McpServer) {
  // -----------------------------------------------------------------------
  // moonpay_status — check MoonPay CLI connection and available tools
  // -----------------------------------------------------------------------
  server.tool(
    'moonpay_status',
    'Check whether MoonPay CLI is installed, authenticated, and what tools are available. MoonPay provides 54 crypto tools across 10+ chains including swaps, DCA, bridges, and fiat on/off ramps.',
    {},
    async () => {
      try {
        const res = await fetch(`${API_URL}/moonpay/status`);
        const data = await res.json();
        return text(JSON.stringify(data, null, 2));
      } catch (e) {
        return text(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
      }
    },
  );

  // -----------------------------------------------------------------------
  // moonpay_swap — execute a swap via MoonPay CLI (policy-gated)
  // -----------------------------------------------------------------------
  server.tool(
    'moonpay_swap',
    'Execute a token swap via MoonPay CLI — supports 10+ chains (Base, Ethereum, Arbitrum, Polygon, etc.). Goes through the policy engine for approval before execution. Supports dry_run mode.',
    {
      fromToken: z.string().describe('Symbol or address of the input token (e.g. "ETH", "USDC")'),
      toToken: z.string().describe('Symbol or address of the output token (e.g. "USDC", "wstETH")'),
      amount: z.string().describe('Amount of input token to swap (e.g. "0.1")'),
      chain: z.string().default('base').describe('Chain to execute on (base, ethereum, arbitrum, polygon, optimism)'),
      reason: z.string().describe('Reason for the swap (for audit trail)'),
      dry_run: z.boolean().default(true).describe('If true, simulate only — do not execute'),
    },
    async ({ fromToken, toToken, amount, chain, reason, dry_run }) => {
      try {
        const res = await fetch(`${API_URL}/moonpay/swap`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            agentId: 'mcp-agent',
            fromToken,
            toToken,
            amount,
            chain,
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

  // -----------------------------------------------------------------------
  // moonpay_dca — set up DCA via MoonPay CLI
  // -----------------------------------------------------------------------
  server.tool(
    'moonpay_dca',
    'Set up a Dollar Cost Averaging (DCA) order via MoonPay CLI. Automatically buys a token at a set frequency. Goes through policy engine for approval.',
    {
      token: z.string().describe('Token to DCA into (e.g. "ETH", "BTC")'),
      amount: z.string().describe('Amount per purchase in USD or base token (e.g. "100")'),
      frequency: z.enum(['daily', 'weekly', 'monthly']).describe('Purchase frequency'),
      chain: z.string().default('base').describe('Chain to execute on'),
      reason: z.string().describe('Reason for the DCA (for audit trail)'),
      dry_run: z.boolean().default(true).describe('If true, simulate only'),
    },
    async ({ token, amount, frequency, chain, reason, dry_run }) => {
      try {
        const res = await fetch(`${API_URL}/moonpay/swap`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            agentId: 'mcp-agent',
            fromToken: 'USDC',
            toToken: token,
            amount,
            chain,
            reason: `DCA [${frequency}]: ${reason}`,
            dryRun: dry_run,
            dca: { frequency },
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
