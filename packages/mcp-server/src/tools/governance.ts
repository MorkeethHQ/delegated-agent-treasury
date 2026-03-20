import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const SNAPSHOT_GRAPHQL = 'https://hub.snapshot.org/graphql';
const LIDO_SNAPSHOT_SPACE = 'lido-snapshot.eth';

function text(s: string) {
  return { content: [{ type: 'text' as const, text: s }] };
}

async function snapshotQuery(query: string, variables: Record<string, unknown>) {
  const res = await fetch(SNAPSHOT_GRAPHQL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Snapshot API error: ${res.status}`);
  return (await res.json()) as { data: Record<string, unknown> };
}

export function registerGovernanceTools(server: McpServer) {
  server.tool(
    'get_lido_governance_proposals',
    'Get recent Lido DAO governance proposals from Snapshot. Returns proposal title, state, vote counts, and links. Use this to understand ongoing or past governance decisions affecting the Lido protocol.',
    {
      state: z.enum(['active', 'closed', 'pending', 'all']).default('all')
        .describe('Filter by proposal state'),
      limit: z.number().min(1).max(20).default(5)
        .describe('Number of proposals to return'),
    },
    async ({ state, limit }) => {
      const stateFilter = state === 'all' ? '' : `state: "${state}",`;

      const { data } = await snapshotQuery(
        `query ($space: String!, $first: Int!) {
          proposals(
            where: { space: $space, ${stateFilter} },
            orderBy: "created",
            orderDirection: desc,
            first: $first
          ) {
            id
            title
            state
            author
            created
            start
            end
            choices
            scores
            scores_total
            votes
            link
          }
        }`,
        { space: LIDO_SNAPSHOT_SPACE, first: limit },
      );

      const proposals = data.proposals as Array<{
        id: string;
        title: string;
        state: string;
        author: string;
        created: number;
        start: number;
        end: number;
        choices: string[];
        scores: number[];
        scores_total: number;
        votes: number;
        link: string;
      }>;

      if (proposals.length === 0) {
        return text(JSON.stringify({ proposals: [], message: `No ${state} proposals found for Lido DAO` }));
      }

      const formatted = proposals.map((p) => ({
        id: p.id,
        title: p.title,
        state: p.state,
        author: p.author,
        created: new Date(p.created * 1000).toISOString(),
        voting: {
          start: new Date(p.start * 1000).toISOString(),
          end: new Date(p.end * 1000).toISOString(),
        },
        results: Object.fromEntries(
          p.choices.map((choice, i) => [choice, p.scores[i] ?? 0]),
        ),
        totalVotingPower: p.scores_total,
        totalVotes: p.votes,
        link: p.link,
      }));

      return text(JSON.stringify({ proposals: formatted }, null, 2));
    },
  );
}
