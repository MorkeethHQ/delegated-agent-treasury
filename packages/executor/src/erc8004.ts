/**
 * ERC-8004 Agent Registry — Trust-Gated Identity Verification
 *
 * Looks up whether an address has a registered on-chain agent identity
 * in the ERC-8004 registry on Base mainnet.
 */

import { createPublicClient, http, type Address } from 'viem';
import { base } from 'viem/chains';

const ERC8004_REGISTRY_ADDRESS = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as const;

const ERC8004_REGISTRY_ABI = [
  {
    name: 'getAgentByOwner',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    name: 'agentUri',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: 'uri', type: 'string' }],
  },
] as const;

export interface IdentityVerification {
  verified: boolean;
  agentId?: number;
  name?: string;
}

/**
 * Create a Base mainnet public client for ERC-8004 lookups.
 * Uses a separate client from the executor since the registry
 * lives on Base mainnet regardless of what chain the treasury is on.
 */
function getRegistryClient() {
  const rpcUrl = process.env.BASE_MAINNET_RPC ?? 'https://mainnet.base.org';
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  });
}

/**
 * Verify whether an address has a registered ERC-8004 on-chain identity.
 *
 * Resilient to network errors — if the lookup fails, returns unverified
 * with a warning rather than blocking the payment flow.
 */
export async function verifyCounterpartyIdentity(
  address: string,
): Promise<IdentityVerification> {
  try {
    const client = getRegistryClient();

    const agentId = await client.readContract({
      address: ERC8004_REGISTRY_ADDRESS,
      abi: ERC8004_REGISTRY_ABI,
      functionName: 'getAgentByOwner',
      args: [address as Address],
    });

    // agentId of 0 means no agent registered
    if (!agentId || agentId === 0n) {
      return { verified: false };
    }

    // Try to fetch the agent URI for additional metadata
    let name: string | undefined;
    try {
      const uri = await client.readContract({
        address: ERC8004_REGISTRY_ADDRESS,
        abi: ERC8004_REGISTRY_ABI,
        functionName: 'agentUri',
        args: [agentId],
      });
      if (uri) {
        name = uri;
      }
    } catch {
      // URI lookup is optional — agent is still verified by ID
    }

    return {
      verified: true,
      agentId: Number(agentId),
      name,
    };
  } catch (error) {
    // Network failures should not block payments — log and treat as unverified
    console.warn(
      `[ERC-8004] Identity verification failed for ${address}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { verified: false };
  }
}
