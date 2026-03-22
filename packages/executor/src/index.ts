import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
  type Address,
  type Hash,
  type Chain,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia, base, celo } from 'viem/chains';
import { AGENT_TREASURY_ABI, MOCK_WSTETH_ABI } from './abi.js';

export { AGENT_TREASURY_ABI, MOCK_WSTETH_ABI } from './abi.js';

// --- Config ---

export interface ExecutorConfig {
  treasuryAddress: Address;
  wstETHAddress: Address;
  rpcUrl: string;
  agentPrivateKey: `0x${string}`;
  ownerPrivateKey?: `0x${string}`;
  chain?: 'base-sepolia' | 'base' | 'celo';
}

function getChain(name?: string): Chain {
  if (name === 'base') return base;
  if (name === 'celo') return celo;
  return baseSepolia;
}

export function createExecutor(config: ExecutorConfig) {
  const chain = getChain(config.chain);

  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  });

  const agentAccount = privateKeyToAccount(config.agentPrivateKey);
  const agentWallet = createWalletClient({
    account: agentAccount,
    chain,
    transport: http(config.rpcUrl),
  });

  const ownerAccount = config.ownerPrivateKey
    ? privateKeyToAccount(config.ownerPrivateKey)
    : null;
  const ownerWallet = ownerAccount
    ? createWalletClient({
        account: ownerAccount,
        chain,
        transport: http(config.rpcUrl),
      })
    : null;

  // --- Read functions ---

  async function availableYield(): Promise<{ raw: bigint; formatted: string }> {
    const raw = await publicClient.readContract({
      address: config.treasuryAddress,
      abi: AGENT_TREASURY_ABI,
      functionName: 'availableYield',
    });
    return { raw, formatted: formatEther(raw) };
  }

  async function principal(): Promise<{ raw: bigint; formatted: string }> {
    const raw = await publicClient.readContract({
      address: config.treasuryAddress,
      abi: AGENT_TREASURY_ABI,
      functionName: 'principal',
    });
    return { raw, formatted: formatEther(raw) };
  }

  async function totalSpent(): Promise<{ raw: bigint; formatted: string }> {
    const raw = await publicClient.readContract({
      address: config.treasuryAddress,
      abi: AGENT_TREASURY_ABI,
      functionName: 'totalSpent',
    });
    return { raw, formatted: formatEther(raw) };
  }

  async function treasuryState() {
    const [yield_, principal_, spent_, agent_, perTxCap_] = await Promise.all([
      availableYield(),
      principal(),
      totalSpent(),
      publicClient.readContract({
        address: config.treasuryAddress,
        abi: AGENT_TREASURY_ABI,
        functionName: 'agent',
      }),
      publicClient.readContract({
        address: config.treasuryAddress,
        abi: AGENT_TREASURY_ABI,
        functionName: 'perTxCap',
      }),
    ]);

    return {
      availableYield: yield_,
      principal: principal_,
      totalSpent: spent_,
      agent: agent_,
      perTxCap: { raw: perTxCap_, formatted: formatEther(perTxCap_) },
    };
  }

  async function isRecipient(address: Address): Promise<boolean> {
    return publicClient.readContract({
      address: config.treasuryAddress,
      abi: AGENT_TREASURY_ABI,
      functionName: 'isRecipient',
      args: [address],
    });
  }

  // --- Agent write functions ---

  async function spendYield(
    to: Address,
    amount: bigint,
  ): Promise<{ hash: Hash; amount: string; to: Address }> {
    const hash = await agentWallet.writeContract({
      address: config.treasuryAddress,
      abi: AGENT_TREASURY_ABI,
      functionName: 'spendYield',
      args: [to, amount],
    });

    await publicClient.waitForTransactionReceipt({ hash });

    return { hash, amount: formatEther(amount), to };
  }

  // --- Owner write functions (for setup/demo) ---

  function requireOwner() {
    if (!ownerWallet || !ownerAccount) {
      throw new Error('Owner private key not configured');
    }
    return { wallet: ownerWallet, account: ownerAccount };
  }

  async function deposit(amount: bigint): Promise<Hash> {
    const { wallet, account } = requireOwner();

    // Approve treasury to pull wstETH
    const approveHash = await wallet.writeContract({
      address: config.wstETHAddress,
      abi: MOCK_WSTETH_ABI,
      functionName: 'approve',
      args: [config.treasuryAddress, amount],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });

    // Deposit
    const hash = await wallet.writeContract({
      address: config.treasuryAddress,
      abi: AGENT_TREASURY_ABI,
      functionName: 'deposit',
      args: [amount],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  async function setupPermissions(
    agentAddress: Address,
    recipients: Address[],
    perTxCapAmount: bigint,
  ): Promise<Hash[]> {
    const { wallet } = requireOwner();
    const hashes: Hash[] = [];

    const h1 = await wallet.writeContract({
      address: config.treasuryAddress,
      abi: AGENT_TREASURY_ABI,
      functionName: 'setAgent',
      args: [agentAddress],
    });
    await publicClient.waitForTransactionReceipt({ hash: h1 });
    hashes.push(h1);

    for (const r of recipients) {
      const h = await wallet.writeContract({
        address: config.treasuryAddress,
        abi: AGENT_TREASURY_ABI,
        functionName: 'addRecipient',
        args: [r],
      });
      await publicClient.waitForTransactionReceipt({ hash: h });
      hashes.push(h);
    }

    if (perTxCapAmount > 0n) {
      const h = await wallet.writeContract({
        address: config.treasuryAddress,
        abi: AGENT_TREASURY_ABI,
        functionName: 'setPerTxCap',
        args: [perTxCapAmount],
      });
      await publicClient.waitForTransactionReceipt({ hash: h });
      hashes.push(h);
    }

    return hashes;
  }

  // Mock-only: simulate yield
  async function simulateYield(basisPoints: number): Promise<Hash> {
    const { wallet } = requireOwner();
    const hash = await wallet.writeContract({
      address: config.wstETHAddress,
      abi: MOCK_WSTETH_ABI,
      functionName: 'simulateYield',
      args: [BigInt(basisPoints)],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  // Mock-only: mint test tokens
  async function mintMockWstETH(to: Address, amount: bigint): Promise<Hash> {
    const { wallet } = requireOwner();
    const hash = await wallet.writeContract({
      address: config.wstETHAddress,
      abi: MOCK_WSTETH_ABI,
      functionName: 'mint',
      args: [to, amount],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  return {
    // Read
    availableYield,
    principal,
    totalSpent,
    treasuryState,
    isRecipient,
    // Agent
    spendYield,
    // Owner / setup
    deposit,
    setupPermissions,
    simulateYield,
    mintMockWstETH,
    // Wallet clients (for live swap execution & delegation redemption)
    agentWalletClient: agentWallet,
    publicClient,
    // Addresses
    agentAddress: agentAccount.address,
    ownerAddress: ownerAccount?.address,
  };
}

export type Executor = ReturnType<typeof createExecutor>;
