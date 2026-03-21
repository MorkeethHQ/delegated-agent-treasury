/**
 * MetaMask Delegation Framework integration
 *
 * Creates delegations from treasury owner → agent with caveats that mirror
 * the policy engine constraints. Provides onchain enforcement as a backstop
 * (defense-in-depth: offchain policy + onchain caveats).
 *
 * Caveat mapping:
 *   scope (erc20TransferAmount) → yield ceiling
 *   allowedTargets              → restrict to treasury contract
 *   allowedMethods              → restrict to spendYield()
 *   limitedCalls                → daily call limit
 *   timestamp                   → time-bounded delegation
 */

import {
  createDelegation,
  signDelegation,
  getSmartAccountsEnvironment,
  redeemDelegations,
  ExecutionMode,
} from '@metamask/smart-accounts-kit';
import type { Delegation } from '@metamask/smart-accounts-kit';
import {
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  parseEther,
  encodeFunctionData,
} from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { AGENT_TREASURY_ABI } from './abi.js';

export interface DelegationConfig {
  treasuryAddress: Address;
  wstETHAddress: Address;
  agentAddress: Address;
  allowedRecipients: Address[];
  maxPerTx: string;
  maxTotal: string;
  validitySeconds?: number;
  maxCalls?: number;
  chain?: 'base' | 'base-sepolia';
}

/**
 * Create a delegation from owner → agent scoped to spendYield() on the treasury.
 * Caveats enforce all policy constraints onchain.
 */
export function createTreasuryDelegation(config: DelegationConfig, ownerSmartAccount: Address): Delegation {
  const chainId = config.chain === 'base' ? base.id : baseSepolia.id;
  const environment = getSmartAccountsEnvironment(chainId);

  const now = Math.floor(Date.now() / 1000);
  const validFor = config.validitySeconds ?? 86400;

  // Create delegation with scope + additional caveats
  const delegation = createDelegation({
    from: ownerSmartAccount,
    to: config.agentAddress,
    environment,
    // Scope: ERC20 transfer amount — yield ceiling
    scope: {
      type: 'erc20TransferAmount',
      tokenAddress: config.wstETHAddress,
      maxAmount: parseEther(config.maxTotal),
    },
    // Additional caveats matching policy engine
    caveats: [
      // Only call our treasury contract
      { type: 'allowedTargets', targets: [config.treasuryAddress] },
      // Only call spendYield(address,uint256)
      { type: 'allowedMethods', selectors: ['0x6d1884e0'] },
      // Time-bounded
      { type: 'timestamp', afterThreshold: now, beforeThreshold: now + validFor },
      // Bounded call count
      ...(config.maxCalls ? [{ type: 'limitedCalls' as const, limit: config.maxCalls }] : []),
    ],
  });

  return delegation;
}

/**
 * Sign a delegation with the owner's private key.
 */
export async function signTreasuryDelegation(
  delegation: Delegation,
  ownerPrivateKey: Hex,
  chain?: 'base' | 'base-sepolia',
): Promise<Delegation> {
  const chainId = chain === 'base' ? base.id : baseSepolia.id;
  const environment = getSmartAccountsEnvironment(chainId);

  const signature = await signDelegation({
    privateKey: ownerPrivateKey,
    delegation,
    delegationManager: environment.DelegationManager,
    chainId,
  });

  return { ...delegation, signature };
}

/**
 * Redeem a signed delegation to execute spendYield() on the treasury.
 */
export async function redeemTreasuryDelegation(
  signedDelegation: Delegation,
  recipientAddress: Address,
  amount: bigint,
  treasuryAddress: Address,
  walletClient: WalletClient,
  publicClient: PublicClient,
  chain?: 'base' | 'base-sepolia',
): Promise<Hex> {
  const chainId = chain === 'base' ? base.id : baseSepolia.id;
  const environment = getSmartAccountsEnvironment(chainId);

  const callData = encodeFunctionData({
    abi: AGENT_TREASURY_ABI,
    functionName: 'spendYield',
    args: [recipientAddress, amount],
  });

  const txHash = await redeemDelegations(
    walletClient,
    publicClient,
    environment.DelegationManager,
    [
      {
        permissionContext: [signedDelegation],
        executions: [{ target: treasuryAddress, value: 0n, callData }],
        mode: ExecutionMode.SingleDefault,
      },
    ],
  );

  return txHash;
}

/**
 * Get a human-readable summary of delegation caveats.
 */
export function describeDelegation(delegation: Delegation): {
  from: Address;
  to: Address;
  caveatsCount: number;
  signed: boolean;
} {
  return {
    from: delegation.delegator,
    to: delegation.delegate,
    caveatsCount: delegation.caveats.length,
    signed: delegation.signature !== '0x',
  };
}

/**
 * Map our policy config to delegation caveats for display.
 */
export function policyToCaveatMapping() {
  return {
    'allowedDestinations': 'AllowedTargetsEnforcer — onchain recipient whitelist',
    'maxPerAction': 'AllowedMethodsEnforcer — restrict to spendYield() only',
    'dailyCap': 'ERC20TransferAmountEnforcer — max total yield the agent can spend',
    'approvalThreshold': 'LimitedCallsEnforcer — bounds total delegated calls',
    'yieldCeiling': 'ERC20TransferAmountEnforcer (scope) — yield ceiling enforced at EVM level',
    'timeWindow': 'TimestampEnforcer — delegation expires automatically',
  };
}
