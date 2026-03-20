// Lido contract ABIs — minimal subsets for MCP tools

export const STETH_ABI = [
  {
    name: 'submit',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: '_referral', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getTotalPooledEther',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getTotalShares',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export const WSTETH_ABI = [
  {
    name: 'wrap',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_stETHAmount', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'unwrap',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_wstETHAmount', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'stEthPerToken',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getStETHByWstETH',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_wstETHAmount', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getWstETHByStETH',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_stETHAmount', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export const WITHDRAWAL_QUEUE_ABI = [
  {
    name: 'requestWithdrawals',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_amounts', type: 'uint256[]' },
      { name: '_owner', type: 'address' },
    ],
    outputs: [{ name: 'requestIds', type: 'uint256[]' }],
  },
  {
    name: 'getWithdrawalStatus',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_requestIds', type: 'uint256[]' }],
    outputs: [
      {
        name: 'statuses',
        type: 'tuple[]',
        components: [
          { name: 'amountOfStETH', type: 'uint256' },
          { name: 'amountOfShares', type: 'uint256' },
          { name: 'owner', type: 'address' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'isFinalized', type: 'bool' },
          { name: 'isClaimed', type: 'bool' },
        ],
      },
    ],
  },
] as const;

// Known contract addresses
export const LIDO_ADDRESSES = {
  ethereum: {
    stETH: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84' as const,
    wstETH: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0' as const,
    withdrawalQueue: '0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1' as const,
  },
  base: {
    wstETH: '0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452' as const,
  },
  arbitrum: {
    wstETH: '0x5979D7b546E38E414F7E9822514be443A4800529' as const,
  },
  optimism: {
    wstETH: '0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb' as const,
  },
  // Demo (Base Sepolia)
  baseSepolia: {
    wstETH: '0x4b8e084234edc18285cb57d8b29a59c2f1fb7a2d' as const,
    agentTreasury: '0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0' as const,
  },
} as const;
