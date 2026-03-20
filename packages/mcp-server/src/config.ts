import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Address,
  type Chain,
  type Transport,
  type Account,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, baseSepolia, base, arbitrum, optimism } from 'viem/chains';

export interface ClientConfig {
  publicClient: PublicClient<Transport, Chain>;
  walletClient: WalletClient<Transport, Chain, Account> | null;
  treasuryAddress: Address | null;
  wstETHAddress: Address | null;
  chain: string;
}

const CHAINS: Record<string, Chain> = {
  ethereum: mainnet,
  'base-sepolia': baseSepolia,
  base,
  arbitrum,
  optimism,
};

export function createConfig(): ClientConfig {
  const chainName = process.env.CHAIN ?? 'base-sepolia';
  const chain = CHAINS[chainName];
  if (!chain) {
    throw new Error(`Unknown chain: ${chainName}. Supported: ${Object.keys(CHAINS).join(', ')}`);
  }

  const rpcUrl = process.env.RPC_URL ?? process.env.BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org';

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  }) as PublicClient<Transport, Chain>;

  let walletClient: WalletClient<Transport, Chain, Account> | null = null;
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (privateKey) {
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    walletClient = createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    }) as WalletClient<Transport, Chain, Account>;
  }

  const treasuryAddress = process.env.TREASURY_ADDRESS as Address | undefined ?? null;
  const wstETHAddress = process.env.WSTETH_ADDRESS as Address | undefined ?? null;

  return {
    publicClient,
    walletClient,
    treasuryAddress,
    wstETHAddress,
    chain: chainName,
  };
}
