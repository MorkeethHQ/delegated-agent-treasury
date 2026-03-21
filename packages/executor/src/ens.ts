import { createPublicClient, http, type Address } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';

// ENS resolution requires Ethereum mainnet (where ENS registry lives)
const ensClient = createPublicClient({
  chain: mainnet,
  transport: http('https://cloudflare-eth.com'),
});

// Known ENS names for this treasury system (morke.eth subdomains)
const KNOWN_NAMES: Record<string, string> = {
  '0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6': 'bagel.morke.eth',
  '0x455d76a24e862a8d552a0722823ac4d13e482426': 'treasury.morke.eth',
  '0x3d7d7712ad32efD8Cb05249d0C7a3De1B1A3bb43': 'bageldeployer.morke.eth',
  '0x1101158041Fd96f21CBcbb0E752a9A2303E6D70e': 'odawgagent.morke.eth',
  '0xf3476b36fc9942083049C04e9404516703369ef3': 'morke.eth',
};

/**
 * Resolve an ENS name to an address.
 * Accepts both ENS names (*.eth) and raw addresses (0x...).
 */
export async function resolveENS(nameOrAddress: string): Promise<{ address: Address; ensName?: string }> {
  // Already an address
  if (nameOrAddress.startsWith('0x') && nameOrAddress.length === 42) {
    const ensName = KNOWN_NAMES[nameOrAddress] ?? await reverseResolveENS(nameOrAddress);
    return { address: nameOrAddress as Address, ensName: ensName ?? undefined };
  }

  // Check if it's a known name (fast path, works for subnames without on-chain records)
  const knownEntry = Object.entries(KNOWN_NAMES).find(([, name]) => name === nameOrAddress);
  if (knownEntry) {
    return { address: knownEntry[0] as Address, ensName: nameOrAddress };
  }

  // ENS name — resolve via on-chain registry
  try {
    const address = await ensClient.getEnsAddress({ name: normalize(nameOrAddress) });
    if (!address) throw new Error(`ENS name "${nameOrAddress}" does not resolve to an address`);
    return { address, ensName: nameOrAddress };
  } catch (error) {
    throw new Error(`Failed to resolve ENS name "${nameOrAddress}": ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Reverse-resolve an address to an ENS name.
 * Returns null if no reverse record is set.
 */
export async function reverseResolveENS(address: string): Promise<string | null> {
  // Check known names first (fast path)
  const known = KNOWN_NAMES[address];
  if (known) return known;

  try {
    const name = await ensClient.getEnsName({ address: address as Address });
    return name;
  } catch {
    return null;
  }
}

/**
 * Enrich an object's address fields with ENS names.
 * Takes any object and returns it with `ensName` fields added where addresses are recognized.
 */
export async function enrichWithENS<T extends Record<string, unknown>>(obj: T, addressFields: string[]): Promise<T & Record<string, unknown>> {
  const enriched = { ...obj } as T & Record<string, unknown>;
  for (const field of addressFields) {
    const value = obj[field];
    if (typeof value === 'string' && value.startsWith('0x')) {
      const name = KNOWN_NAMES[value] ?? await reverseResolveENS(value);
      if (name) {
        enriched[`${field}ENS`] = name;
      }
    }
  }
  return enriched;
}

/**
 * Get all known ENS identities for this treasury system.
 */
export function getENSIdentities(): Array<{ address: string; ensName: string; role: string }> {
  return [
    { address: '0xf3476b36fc9942083049C04e9404516703369ef3', ensName: 'morke.eth', role: 'owner (human)' },
    { address: '0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6', ensName: 'bagel.morke.eth', role: 'agent signer (Bagel)' },
    { address: '0x455d76a24e862a8d552a0722823ac4d13e482426', ensName: 'treasury.morke.eth', role: 'AgentTreasury contract (Base)' },
    { address: '0x3d7d7712ad32efD8Cb05249d0C7a3De1B1A3bb43', ensName: 'bageldeployer.morke.eth', role: 'Bagel deployer' },
    { address: '0x1101158041Fd96f21CBcbb0E752a9A2303E6D70e', ensName: 'odawgagent.morke.eth', role: 'secondary agent wallet' },
  ];
}
