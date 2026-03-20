import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { verifyCounterpartyIdentity } from '../../../executor/src/erc8004.js';

function text(s: string) {
  return { content: [{ type: 'text' as const, text: s }] };
}

export function registerTrustTools(server: McpServer) {
  server.tool(
    'verify_counterparty_identity',
    'Verify whether an address has a registered ERC-8004 on-chain agent identity on the Base mainnet registry. Use this before making payments to check if the recipient is a trusted, verified agent.',
    {
      address: z.string().describe('Ethereum address to verify against the ERC-8004 registry'),
    },
    async ({ address }) => {
      const identity = await verifyCounterpartyIdentity(address);

      return text(JSON.stringify({
        address,
        verified: identity.verified,
        agentId: identity.agentId ?? null,
        details: identity.verified
          ? `Address has verified ERC-8004 identity (agent #${identity.agentId})`
          : 'Address does not have a registered ERC-8004 identity',
        name: identity.name ?? null,
      }, null, 2));
    },
  );
}
