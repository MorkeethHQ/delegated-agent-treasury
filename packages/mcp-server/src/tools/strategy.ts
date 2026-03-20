import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

function text(s: string) {
  return { content: [{ type: 'text' as const, text: s }] };
}

export function registerStrategyTools(server: McpServer) {
  server.tool(
    'get_yield_strategy',
    'Get the current yield distribution strategy configuration: buckets, percentages, thresholds',
    {},
    async () => {
      try {
        const res = await fetch(`${API_URL}/strategy`);
        const data = await res.json();
        return text(JSON.stringify(data, null, 2));
      } catch (e) {
        return text(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
      }
    },
  );

  server.tool(
    'preview_yield_distribution',
    'Preview what the next yield distribution would look like based on current treasury state and strategy config — does not execute anything',
    {},
    async () => {
      try {
        const res = await fetch(`${API_URL}/strategy/preview`);
        const data = await res.json();
        return text(JSON.stringify(data, null, 2));
      } catch (e) {
        return text(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
      }
    },
  );

  server.tool(
    'trigger_yield_distribution',
    'Manually trigger a full yield distribution cycle — computes the plan and submits each bucket through the policy engine for evaluation and execution',
    {
      dry_run: z.boolean().default(false).describe('If true, only preview the plan without executing'),
    },
    async ({ dry_run }) => {
      try {
        if (dry_run) {
          const res = await fetch(`${API_URL}/strategy/preview`);
          const data = await res.json();
          return text(JSON.stringify({ dry_run: true, ...data }, null, 2));
        }

        const res = await fetch(`${API_URL}/strategy/distribute`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        return text(JSON.stringify(data, null, 2));
      } catch (e) {
        return text(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
      }
    },
  );
}
