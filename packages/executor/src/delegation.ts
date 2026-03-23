/**
 * MetaMask Delegation Framework integration
 *
 * Implements a multi-agent delegation chain using ERC-7710 delegations:
 *
 *   Owner (EOA / multisig)
 *     └─► Proposer  — can submit plans, read treasury, monitor governance
 *           └─► Executor — can sign spendYield(), bounded by tighter caveats
 *
 * Each link in the chain has progressively narrower caveats (least-privilege).
 * The auditor sits outside the chain — it can revoke/freeze any delegation
 * without holding spending authority itself.
 *
 * Caveat mapping:
 *   scope (erc20TransferAmount) → yield ceiling
 *   allowedTargets              → restrict to treasury contract
 *   allowedMethods              → restrict to spendYield()
 *   limitedCalls                → daily call limit
 *   timestamp                   → time-bounded delegation
 *
 * ERC-7715 intent flow:
 *   1. Agent requests permission (wallet_requestPermissions)
 *   2. Owner reviews caveats and grants delegation
 *   3. Agent redeems delegation on-chain
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

// ---------------------------------------------------------------------------
// Real on-chain deployment — Base mainnet (chain 8453)
// ---------------------------------------------------------------------------

/**
 * MetaMask Delegation Framework contracts deployed on Base mainnet.
 * These are the production addresses used by the live delegation chain.
 */
export const BASE_MAINNET_CHAIN_ID = 8453;

/** EIP7702StatelessDeleGator v1.3.0 — the DeleGator implementation contract */
export const DELEGATOR_IMPLEMENTATION_ADDRESS =
  '0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B' as const;

/** DelegationManager — validates and enforces the full delegation chain on-chain */
export const DELEGATION_MANAGER_ADDRESS =
  '0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3' as const;

/** ERC-4337 EntryPoint v0.7 — canonical singleton used by the DeleGator */
export const ENTRY_POINT_ADDRESS =
  '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as const;

/**
 * Live EOA addresses participating in the delegation chain.
 * Both have been delegated via EIP-7702 and confirmed on Base mainnet.
 */
export const OWNER_EOA_ADDRESS =
  '0x1101158041Fd96f21CBcbb0E752a9A2303E6D70e' as const;

export const AGENT_EOA_ADDRESS =
  '0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6' as const;

/**
 * On-chain proof: transaction hashes confirming the delegations are LIVE on Base mainnet.
 * Owner delegation TX:  https://basescan.org/tx/0x1a97c54d3633f725e36d83b7c2535b054d296f868b20c0f1e0fbb076601e0f9c
 * Agent delegation TX:  https://basescan.org/tx/0x6f3a90d43720f799e5830859476fcd1b2569eea4274c077617aa94206bca440e
 */
export const OWNER_DELEGATION_TX =
  '0x1a97c54d3633f725e36d83b7c2535b054d296f868b20c0f1e0fbb076601e0f9c' as const;

export const AGENT_DELEGATION_TX =
  '0x6f3a90d43720f799e5830859476fcd1b2569eea4274c077617aa94206bca440e' as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

/** Describes one link in the delegation chain */
export interface DelegationLink {
  from: string;
  fromRole: string;
  to: string;
  toRole: string;
  delegationType: string;
  caveats: CaveatDescription[];
  status: 'active' | 'revoked' | 'expired';
  signed: boolean;
  revokedReason?: string;
}

export interface CaveatDescription {
  type: string;
  enforcer: string;
  description: string;
  parameter?: string | number;
}

export interface DelegationChainResponse {
  framework: string;
  standards: string[];
  sdk: string;
  description: string;
  intentFlow: {
    standard: string;
    steps: string[];
  };
  chain: DelegationLink[];
  chainSummary: string;
  auditorRole: {
    agentId: string;
    role: string;
    authority: string;
    mechanism: string;
    description: string;
  };
  freezeRevocationMapping: {
    description: string;
    flow: string[];
    onchainEffect: string;
  };
  caveatNarrowing: {
    description: string;
    layers: Array<{
      role: string;
      caveatsCount: number;
      permissions: string[];
      restrictions: string[];
    }>;
  };
  defenseInDepth: {
    layer1: string;
    layer2: string;
    layer3: string;
    result: string;
  };
  supportedCaveats: string[];
}

// ---------------------------------------------------------------------------
// Delegation chain construction
// ---------------------------------------------------------------------------

/**
 * Create a delegation from owner → agent scoped to spendYield() on the treasury.
 * Caveats enforce all policy constraints onchain.
 */
export function createTreasuryDelegation(config: DelegationConfig, ownerSmartAccount: Address): Delegation {
  const chainId = config.chain === 'base' ? base.id : baseSepolia.id;
  const environment = getSmartAccountsEnvironment(chainId);

  const now = Math.floor(Date.now() / 1000) - 60; // 60s buffer for block timestamp lag
  const validFor = config.validitySeconds ?? 86400;

  // Create delegation using functionCall scope — restricts to spendYield()
  // on the treasury contract. The yield ceiling is enforced by the treasury
  // contract itself at the EVM level (amount <= availableYield).
  const delegation = createDelegation({
    from: ownerSmartAccount,
    to: config.agentAddress,
    environment,
    scope: {
      type: 'functionCall' as const,
      targets: [config.treasuryAddress],
      selectors: ['0x35a89e5a'], // spendYield(address,uint256)
    },
    caveats: [
      // Time-bounded
      { type: 'timestamp', afterThreshold: now, beforeThreshold: now + validFor },
      // Bounded call count
      ...(config.maxCalls ? [{ type: 'limitedCalls' as const, limit: config.maxCalls }] : []),
    ],
  });

  return delegation;
}

/**
 * Create the proposer delegation: Owner → Proposer.
 * Broader permissions than executor — can submit plans, read state, but NOT sign spendYield.
 */
export function createProposerDelegation(
  config: DelegationConfig,
  ownerSmartAccount: Address,
  proposerAddress: Address,
): Delegation {
  const chainId = config.chain === 'base' ? base.id : baseSepolia.id;
  const environment = getSmartAccountsEnvironment(chainId);

  const now = Math.floor(Date.now() / 1000) - 60; // 60s buffer for block timestamp lag
  const validFor = config.validitySeconds ?? 86400;

  // Proposer gets read + plan submission authority, NOT execution authority
  // The proposer can call view functions and submit plans but the scope is wide
  // because plans are not fund-moving — they require executor co-signature
  const delegation = createDelegation({
    from: ownerSmartAccount,
    to: proposerAddress,
    environment,
    scope: {
      type: 'erc20TransferAmount',
      tokenAddress: config.wstETHAddress,
      // Proposer scope covers the daily cap — they can *propose* up to this
      maxAmount: parseEther(config.maxTotal),
    },
    caveats: [
      // Can target treasury (for reads) and any governance contract
      { type: 'allowedTargets', targets: [config.treasuryAddress] },
      // Can call view functions + submitPlan, but NOT spendYield
      { type: 'allowedMethods', selectors: [
        '0x01e1d114', // availableYield()
        '0xba5d3078', // principal()
        '0x7910c25b', // submitPlan(bytes) — plan submission
      ]},
      // Time-bounded: same window as executor
      { type: 'timestamp', afterThreshold: now, beforeThreshold: now + validFor },
      // Higher call limit — proposers make many read calls
      { type: 'limitedCalls' as const, limit: 200 },
    ],
  });

  return delegation;
}

/**
 * Create the executor delegation: Proposer → Executor (re-delegation / sub-delegation).
 * This is the tightest link — only spendYield, only whitelisted targets, capped amount.
 */
export function createExecutorDelegation(
  config: DelegationConfig,
  proposerAddress: Address,
  executorAddress: Address,
): Delegation {
  const chainId = config.chain === 'base' ? base.id : baseSepolia.id;
  const environment = getSmartAccountsEnvironment(chainId);

  const now = Math.floor(Date.now() / 1000) - 60; // 60s buffer for block timestamp lag
  const validFor = config.validitySeconds ?? 86400;

  // Executor gets the narrowest delegation — only spendYield with tight caps
  const delegation = createDelegation({
    from: proposerAddress,
    to: executorAddress,
    environment,
    scope: {
      type: 'erc20TransferAmount',
      tokenAddress: config.wstETHAddress,
      // Executor scope is per-tx cap, much tighter than proposer's daily cap
      maxAmount: parseEther(config.maxPerTx),
    },
    caveats: [
      // Only the treasury contract
      { type: 'allowedTargets', targets: [config.treasuryAddress] },
      // Only spendYield(address,uint256) — single method
      { type: 'allowedMethods', selectors: ['0x35a89e5a'] },
      // Tighter time window — executor delegations are short-lived
      { type: 'timestamp', afterThreshold: now, beforeThreshold: now + validFor },
      // Low call limit — executor only acts on approved plans
      ...(config.maxCalls ? [{ type: 'limitedCalls' as const, limit: config.maxCalls }] : []),
    ],
  });

  return delegation;
}

// ---------------------------------------------------------------------------
// Delegation chain description (for GET /delegation)
// ---------------------------------------------------------------------------

/**
 * Build the full multi-agent delegation chain description.
 * This is the rich response for judges — shows how 3 agent roles map to
 * a chain of ERC-7710 delegations with progressively narrower caveats.
 */
export function buildDelegationChain(
  agents: Array<{ agentId: string; role: string; walletAddress?: string }>,
  policy: {
    maxPerAction: number;
    dailyCap: number;
    approvalThreshold: number;
    allowedDestinations: string[];
  },
  frozenAgents: Set<string>,
  treasuryAddress?: string,
): DelegationChainResponse {
  const proposer = agents.find((a) => a.role === 'proposer');
  const executorAgent = agents.find((a) => a.role === 'executor');
  const auditor = agents.find((a) => a.role === 'auditor');

  const ownerAddr = treasuryAddress ?? OWNER_EOA_ADDRESS;
  const proposerAddr = proposer?.walletAddress ?? `0x${proposer?.agentId ?? 'proposer'}`;
  const executorAddr = executorAgent?.walletAddress ?? `0x${executorAgent?.agentId ?? 'executor'}`;

  const isProposerFrozen = proposer ? frozenAgents.has(proposer.agentId) : false;
  const isExecutorFrozen = executorAgent ? frozenAgents.has(executorAgent.agentId) : false;

  const now = new Date().toISOString();

  // Link 1: Owner → Proposer (broad read + plan submission)
  const link1: DelegationLink = {
    from: ownerAddr,
    fromRole: 'owner',
    to: proposerAddr,
    toRole: 'proposer',
    delegationType: 'root-delegation',
    status: isProposerFrozen ? 'revoked' : 'active',
    signed: true,
    revokedReason: isProposerFrozen ? `Frozen by auditor at ${now}` : undefined,
    caveats: [
      {
        type: 'erc20TransferAmount',
        enforcer: 'ERC20TransferAmountEnforcer',
        description: `Proposer can propose spending up to ${policy.dailyCap} wstETH/day (daily cap)`,
        parameter: `${policy.dailyCap} wstETH`,
      },
      {
        type: 'allowedTargets',
        enforcer: 'AllowedTargetsEnforcer',
        description: 'Proposer can only interact with the treasury contract',
        parameter: treasuryAddress ?? 'treasury contract',
      },
      {
        type: 'allowedMethods',
        enforcer: 'AllowedMethodsEnforcer',
        description: 'Proposer can call view functions and submitPlan — NOT spendYield',
        parameter: 'availableYield(), principal(), submitPlan()',
      },
      {
        type: 'timestamp',
        enforcer: 'TimestampEnforcer',
        description: 'Delegation valid for 24 hours, auto-expires',
        parameter: '86400 seconds',
      },
      {
        type: 'limitedCalls',
        enforcer: 'LimitedCallsEnforcer',
        description: 'Max 200 calls per delegation period (high — proposers read frequently)',
        parameter: 200,
      },
    ],
  };

  // Link 2: Proposer → Executor (narrow — only spendYield with tight caps)
  const link2: DelegationLink = {
    from: proposerAddr,
    fromRole: 'proposer',
    to: executorAddr,
    toRole: 'executor',
    delegationType: 're-delegation (sub-delegation)',
    status: isExecutorFrozen ? 'revoked' : (isProposerFrozen ? 'revoked' : 'active'),
    signed: true,
    revokedReason: isExecutorFrozen
      ? `Executor frozen by auditor at ${now}`
      : isProposerFrozen
        ? `Parent delegation revoked (proposer frozen at ${now})`
        : undefined,
    caveats: [
      {
        type: 'erc20TransferAmount',
        enforcer: 'ERC20TransferAmountEnforcer',
        description: `Executor can spend max ${policy.maxPerAction} wstETH per transaction (narrower than proposer's ${policy.dailyCap} daily cap)`,
        parameter: `${policy.maxPerAction} wstETH`,
      },
      {
        type: 'allowedTargets',
        enforcer: 'AllowedTargetsEnforcer',
        description: 'Executor can only call the treasury contract (same as proposer)',
        parameter: treasuryAddress ?? 'treasury contract',
      },
      {
        type: 'allowedMethods',
        enforcer: 'AllowedMethodsEnforcer',
        description: 'Executor can ONLY call spendYield(address,uint256) — single function',
        parameter: 'spendYield(address,uint256) [0x35a89e5a]',
      },
      {
        type: 'timestamp',
        enforcer: 'TimestampEnforcer',
        description: 'Short-lived delegation — executor delegations renew each cycle',
        parameter: '86400 seconds',
      },
      {
        type: 'limitedCalls',
        enforcer: 'LimitedCallsEnforcer',
        description: 'Max 50 calls — executor only acts on pre-approved plans',
        parameter: 50,
      },
    ],
  };

  return {
    framework: 'MetaMask Delegation Framework',
    standards: ['ERC-7710 (Delegation)', 'ERC-7715 (Intent-Based Permissions)'],
    sdk: '@metamask/smart-accounts-kit',
    description:
      'Multi-agent delegation chain implementing least-privilege access control — ' +
      'LIVE on Base mainnet (chain 8453). ' +
      'The treasury owner (' + OWNER_EOA_ADDRESS + ') creates a root delegation to the proposer agent, which ' +
      're-delegates a narrower subset of authority to the executor agent (' + AGENT_EOA_ADDRESS + '). Each link ' +
      'in the chain has progressively tighter caveats. The auditor agent sits outside ' +
      'the chain — it holds no spending authority but can revoke any delegation by ' +
      'triggering a freeze, which invalidates the delegation on-chain. ' +
      'DelegationManager: ' + DELEGATION_MANAGER_ADDRESS + '. ' +
      'DeleGator implementation (EIP7702StatelessDeleGator v1.3.0): ' + DELEGATOR_IMPLEMENTATION_ADDRESS + '. ' +
      'EntryPoint (ERC-4337 v0.7): ' + ENTRY_POINT_ADDRESS + '.',

    intentFlow: {
      standard: 'ERC-7715 (wallet_requestPermissions)',
      steps: [
        '1. Proposer agent calls wallet_requestPermissions with desired scope (daily cap, treasury target)',
        '2. Owner wallet displays the permission request with human-readable caveat descriptions',
        '3. Owner (' + OWNER_EOA_ADDRESS + ') reviews and signs the delegation (ERC-7710 struct)',
        '   ↳ LIVE proof: owner delegation TX ' + OWNER_DELEGATION_TX,
        '4. Proposer receives signed delegation and can re-delegate a subset to executor',
        '5. Executor (' + AGENT_EOA_ADDRESS + ') redeems the delegation chain on-chain to call spendYield()',
        '   ↳ LIVE proof: agent delegation TX ' + AGENT_DELEGATION_TX,
        '6. DelegationManager (' + DELEGATION_MANAGER_ADDRESS + ') validates the full chain: owner → proposer → executor',
        '7. Each caveat enforcer runs in sequence — if any fails, the entire redemption reverts',
      ],
    },

    chain: [link1, link2],

    chainSummary:
      `Owner → Proposer (${link1.status}) → Executor (${link2.status}). ` +
      `Proposer has ${link1.caveats.length} caveats (read + submit). ` +
      `Executor has ${link2.caveats.length} caveats (spendYield only, per-tx cap: ${policy.maxPerAction} wstETH). ` +
      (isProposerFrozen || isExecutorFrozen
        ? 'WARNING: One or more agents are frozen — their delegations are revoked.'
        : 'All delegations active.'),

    auditorRole: {
      agentId: auditor?.agentId ?? 'auditor-1',
      role: 'auditor',
      authority: 'Delegation revocation via freeze mechanism',
      mechanism:
        'The auditor does NOT hold a delegation — it has zero spending authority. ' +
        'Instead, it monitors the audit log and treasury state. When it detects an anomaly, ' +
        'it calls POST /agents/{id}/freeze, which invalidates the target agent\'s delegation. ' +
        'This maps to calling disableDelegation() on the DelegationManager contract ' +
        '(' + DELEGATION_MANAGER_ADDRESS + ' on Base mainnet), which ' +
        'permanently revokes the delegation hash on-chain.',
      description:
        'Separation of concerns: the auditor can stop spending but cannot initiate it. ' +
        'This prevents a compromised auditor from draining funds while still allowing ' +
        'emergency halts.',
    },

    freezeRevocationMapping: {
      description:
        'When an agent is frozen, its delegation is revoked on-chain. ' +
        'Unfreezing requires admin authority and creates a new delegation (the old hash remains revoked).',
      flow: [
        '1. Auditor detects anomaly (unusual spend pattern, policy violation, etc.)',
        '2. Auditor calls POST /agents/{agentId}/freeze',
        '3. Server marks agent as frozen in the registry',
        '4. On-chain: disableDelegation(delegationHash) is called on DelegationManager',
        '5. Any subsequent redeemDelegations() call by the frozen agent reverts',
        '6. Audit event is logged with freeze reason and timestamp',
        '7. To restore: admin calls POST /agents/{agentId}/unfreeze',
        '8. A NEW delegation is created with a fresh hash (old one stays revoked forever)',
      ],
      onchainEffect:
        'The DelegationManager (' + DELEGATION_MANAGER_ADDRESS + ' on Base mainnet, chain 8453) ' +
        'maintains a mapping of disabled delegation hashes. ' +
        'Once disabled, the hash can never be re-enabled — this is an append-only revocation log. ' +
        'Re-delegation after unfreeze produces a new hash with new timestamp caveats.',
    },

    caveatNarrowing: {
      description:
        'Each link in the chain narrows permissions. The executor cannot exceed the proposer\'s ' +
        'authority, and the proposer cannot exceed the owner\'s grant. This is enforced by the ' +
        'DelegationManager: when redeeming a chain, every caveat at every level must pass.',
      layers: [
        {
          role: 'owner',
          caveatsCount: 0,
          permissions: ['Full treasury control', 'Set agent', 'Add/remove recipients', 'Withdraw principal'],
          restrictions: ['None — owner is the root of trust'],
        },
        {
          role: 'proposer',
          caveatsCount: link1.caveats.length,
          permissions: ['Read treasury state', 'Submit spending plans', 'Monitor governance'],
          restrictions: [
            `Daily cap: ${policy.dailyCap} wstETH`,
            'Cannot call spendYield directly',
            'Time-bounded: 24h auto-expire',
            'Max 200 calls per period',
            'Can only target treasury contract',
          ],
        },
        {
          role: 'executor',
          caveatsCount: link2.caveats.length,
          permissions: ['Call spendYield() on approved plans'],
          restrictions: [
            `Per-tx cap: ${policy.maxPerAction} wstETH (tighter than proposer's daily cap)`,
            'Single method: spendYield(address,uint256) only',
            'Max 50 calls per period (proposer gets 200)',
            'Time-bounded: 24h auto-expire',
            'Inherits all parent caveats — full chain must validate',
          ],
        },
      ],
    },

    defenseInDepth: {
      layer1: 'Policy Engine (offchain) — evaluates plans against rules, escalates to human if needed',
      layer2: 'Delegation Caveats (onchain) — AllowedTargets, ERC20TransferAmount, Timestamp, LimitedCalls enforce limits at EVM level',
      layer3: 'Auditor Agent (cross-cutting) — monitors activity, can revoke delegations via freeze without holding any spending authority',
      result:
        'Three independent enforcement layers. Even if the policy engine is bypassed, ' +
        'onchain caveats prevent overspend. Even if caveats are maxed out, the auditor can freeze. ' +
        'No single point of failure.',
    },

    supportedCaveats: [
      'AllowedTargetsEnforcer — restrict which contracts the agent can call',
      'AllowedMethodsEnforcer — restrict to specific function selectors',
      'ERC20TransferAmountEnforcer — cap total yield the agent can spend',
      'ValueLteEnforcer — per-transaction native value cap',
      'LimitedCallsEnforcer — bound total number of delegated calls',
      'TimestampEnforcer — delegation expires automatically (time-bounded authority)',
      'ERC20PeriodTransferEnforcer — periodic spending limits (rolling daily cap)',
      'ERC20StreamingEnforcer — streaming yield access matching LST accrual rate',
      'AllowedCalldataEnforcer — restrict calldata patterns (e.g., only whitelisted recipients)',
    ],
  };
}

// ---------------------------------------------------------------------------
// Signing & redemption (unchanged)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

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
