import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AgentProfile } from '../../../shared/src/index.js';

function text(s: string) {
  return { content: [{ type: 'text' as const, text: s }] };
}

const agentsConfigPath = resolve(process.cwd(), 'config', 'agents.json');

// In-memory frozen set (mirrors the API server's state for MCP context)
const frozenAgents = new Set<string>();

async function loadAgents(): Promise<AgentProfile[]> {
  try {
    const raw = await readFile(agentsConfigPath, 'utf8');
    const data = JSON.parse(raw) as { agents: AgentProfile[] };
    return data.agents;
  } catch {
    return [];
  }
}

export function registerAgentTools(server: McpServer) {
  server.tool(
    'list_agents',
    'List all registered agents in the treasury system with their roles, capabilities, and frozen status',
    {},
    async () => {
      const agents = await loadAgents();
      const result = agents.map((a) => ({
        ...a,
        frozen: frozenAgents.has(a.agentId),
      }));
      return text(JSON.stringify(result, null, 2));
    },
  );

  server.tool(
    'get_agent_profile',
    'Get a specific agent\'s profile by ID, including role, capabilities, and frozen status',
    {
      agent_id: z.string().describe('The agent ID to look up (e.g. "bagel", "executor-1", "auditor-1")'),
    },
    async ({ agent_id }) => {
      const agents = await loadAgents();
      const agent = agents.find((a) => a.agentId === agent_id);
      if (!agent) {
        return text(JSON.stringify({ error: `Agent "${agent_id}" not found` }));
      }
      return text(JSON.stringify({ ...agent, frozen: frozenAgents.has(agent.agentId) }, null, 2));
    },
  );

  server.tool(
    'freeze_agent',
    'Freeze an agent\'s spending — all plans from this agent will be denied until unfrozen. Requires auditor role.',
    {
      agent_id: z.string().describe('The agent ID to freeze'),
      requested_by: z.string().default('auditor-1').describe('The agent ID of the auditor requesting the freeze'),
    },
    async ({ agent_id, requested_by }) => {
      const agents = await loadAgents();
      const requester = agents.find((a) => a.agentId === requested_by);
      if (requester && requester.role !== 'auditor' && requester.role !== 'admin') {
        return text(JSON.stringify({ error: 'Only auditor or admin agents can freeze spending' }));
      }

      const target = agents.find((a) => a.agentId === agent_id);
      if (!target) {
        return text(JSON.stringify({ error: `Agent "${agent_id}" not found` }));
      }

      frozenAgents.add(agent_id);
      return text(JSON.stringify({
        message: `Agent "${agent_id}" is now frozen`,
        agentId: agent_id,
        frozen: true,
        frozenBy: requested_by,
      }, null, 2));
    },
  );
}
