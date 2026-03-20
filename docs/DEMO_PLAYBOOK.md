# Demo Playbook — One Clean Judge Demo

Optimized for one path, no extra abstractions.

---

## Contract Interface (exact)

### AgentTreasury

```solidity
constructor(address _wstETH)

// Owner-only
function deposit(uint256 amount) external                    // Transfer wstETH in, records initial rate
function withdrawPrincipal() external                        // Withdraw locked principal
function setAgent(address _agent) external                   // Authorize one agent address
function addRecipient(address to) external                   // Whitelist a spend target
function removeRecipient(address to) external                // Remove from whitelist
function setPerTxCap(uint256 cap) external                   // Max wstETH per agent spend (0 = uncapped)

// Agent-only
function spendYield(address to, uint256 amount) external     // Spend yield to whitelisted recipient

// View (anyone)
function availableYield() public view returns (uint256)      // Spendable yield in wstETH
function principal() external view returns (uint256)         // Locked principal in wstETH
function isRecipient(address) public view returns (bool)     // Whitelist check
function totalSpent() public view returns (uint256)          // Cumulative agent spend
function depositedWstETH() public view returns (uint256)     // Original deposit amount
function initialRate() public view returns (uint256)         // stEthPerToken at deposit time
function agent() public view returns (address)               // Current authorized agent
function owner() public view returns (address)               // Treasury owner
function perTxCap() public view returns (uint256)            // Current per-tx cap
```

### Events (6 total)

```solidity
event Deposited(address indexed owner, uint256 amount, uint256 rate)
event YieldSpent(address indexed agent, address indexed to, uint256 amount)
event PrincipalWithdrawn(address indexed owner, uint256 amount)
event AgentSet(address indexed agent)
event RecipientAdded(address indexed to)
event PerTxCapSet(uint256 cap)
```

### MockWstETH (testnet only)

```solidity
constructor()                                          // Starts at rate 1.15e18
function mint(address to, uint256 amount) external     // Faucet (owner-only)
function simulateYield(uint256 basisPoints) external   // Bump rate (owner-only, e.g. 500 = 5%)
function stEthPerToken() external view returns (uint256)
function balanceOf(address) external view returns (uint256)
// Standard ERC20: transfer, transferFrom, approve, allowance
```

---

## Demo Sequence (step by step)

### Setup (one-time, before demo)

```bash
# Env vars needed
export PRIVATE_KEY=<deployer-private-key>
export BASE_SEPOLIA_RPC=https://sepolia.base.org
export AGENT_PRIVATE_KEY=<agent-wallet-key>

# Deploy
cd contracts
forge script script/Deploy.s.sol --rpc-url $BASE_SEPOLIA_RPC --broadcast

# Record deployed addresses
export MOCK_WSTETH=<deployed-mock-address>
export TREASURY=<deployed-treasury-address>
```

### Step 1: Owner funds the treasury

```bash
# Mint 1 wstETH to owner
cast send $MOCK_WSTETH "mint(address,uint256)" $OWNER_ADDR 1000000000000000000 \
  --rpc-url $BASE_SEPOLIA_RPC --private-key $PRIVATE_KEY

# Approve treasury to pull wstETH
cast send $MOCK_WSTETH "approve(address,uint256)" $TREASURY 1000000000000000000 \
  --rpc-url $BASE_SEPOLIA_RPC --private-key $PRIVATE_KEY

# Deposit into treasury
cast send $TREASURY "deposit(uint256)" 1000000000000000000 \
  --rpc-url $BASE_SEPOLIA_RPC --private-key $PRIVATE_KEY
```

**Expected result**: `Deposited(owner, 1e18, 1.15e18)` event. Treasury holds 1 wstETH.

### Step 2: Owner configures permissions

```bash
# Set agent address
cast send $TREASURY "setAgent(address)" $AGENT_ADDR \
  --rpc-url $BASE_SEPOLIA_RPC --private-key $PRIVATE_KEY

# Whitelist recipient
cast send $TREASURY "addRecipient(address)" $RECIPIENT_ADDR \
  --rpc-url $BASE_SEPOLIA_RPC --private-key $PRIVATE_KEY

# Set per-tx cap: 0.01 wstETH
cast send $TREASURY "setPerTxCap(uint256)" 10000000000000000 \
  --rpc-url $BASE_SEPOLIA_RPC --private-key $PRIVATE_KEY
```

**Expected result**: `AgentSet`, `RecipientAdded`, `PerTxCapSet` events.

### Step 3: Yield accrues

```bash
# Simulate 5% yield (500 basis points)
cast send $MOCK_WSTETH "simulateYield(uint256)" 500 \
  --rpc-url $BASE_SEPOLIA_RPC --private-key $PRIVATE_KEY

# Check available yield
cast call $TREASURY "availableYield()" --rpc-url $BASE_SEPOLIA_RPC
# Expected: ~0.0435 wstETH (1 * (1 - 1.15/1.2075))
```

### Step 4: Agent spends yield (the money shot)

```bash
# Agent spends 0.01 wstETH to whitelisted recipient
cast send $TREASURY "spendYield(address,uint256)" $RECIPIENT_ADDR 10000000000000000 \
  --rpc-url $BASE_SEPOLIA_RPC --private-key $AGENT_PRIVATE_KEY
```

**Expected result**: `YieldSpent(agent, recipient, 0.01e18)` event. Recipient gets wstETH. Principal untouched.

### Step 5: Permission enforcement (show it works)

```bash
# Over cap → REVERT
cast send $TREASURY "spendYield(address,uint256)" $RECIPIENT_ADDR 20000000000000000 \
  --rpc-url $BASE_SEPOLIA_RPC --private-key $AGENT_PRIVATE_KEY
# Expected: "exceeds per-tx cap"

# Non-whitelisted → REVERT
cast send $TREASURY "spendYield(address,uint256)" 0xDEAD000000000000000000000000000000000000 10000000000000000 \
  --rpc-url $BASE_SEPOLIA_RPC --private-key $AGENT_PRIVATE_KEY
# Expected: "recipient not whitelisted"

# More than yield → REVERT
cast send $TREASURY "spendYield(address,uint256)" $RECIPIENT_ADDR 900000000000000000 \
  --rpc-url $BASE_SEPOLIA_RPC --private-key $AGENT_PRIVATE_KEY
# Expected: "exceeds available yield"
```

### Step 6: Verify principal is safe

```bash
cast call $TREASURY "principal()" --rpc-url $BASE_SEPOLIA_RPC
# Expected: ~0.9565 wstETH (original minus spent yield portion)

cast call $TREASURY "totalSpent()" --rpc-url $BASE_SEPOLIA_RPC
# Expected: 0.01e18
```

---

## API/CLI Integration

### How the API calls the contract

The API server uses **viem** to interact with the deployed contract.

```bash
# Additional env vars for API
export TREASURY_ADDRESS=<deployed-treasury-address>
export WSTETH_ADDRESS=<deployed-mock-address>
export AGENT_PRIVATE_KEY=<agent-wallet-key>
export BASE_SEPOLIA_RPC=https://sepolia.base.org
```

### API flow when approval is granted

```
1. Agent submits plan → POST /plans/evaluate
2. Policy engine returns approval_required
3. Approval created automatically
4. Human responds → POST /approvals/:id/respond { decision: "approved" }
5. API calls treasury.spendYield(to, amount) using agent wallet
6. Audit log: approval_granted + execution_result with tx hash
```

### CLI commands (planned)

```bash
# List pending approvals
synthesis approvals list --status pending

# Approve
synthesis approvals respond <id> --decision approved

# Check treasury state
synthesis treasury balance
synthesis treasury yield

# View audit trail
synthesis audit --limit 10
```

---

## Fallback Plan

If the on-chain path breaks (RPC issues, gas problems, contract bug):

**Fallback A**: Run Anvil locally forking Base Sepolia
```bash
anvil --fork-url $BASE_SEPOLIA_RPC
# Use http://127.0.0.1:8545 as RPC
# All contract calls work the same, just local
```

**Fallback B**: Demo the API + policy engine without on-chain execution
- Show the full evaluate → approve → audit flow via curl
- Show the contract source + spec as "ready to deploy"
- Less impressive but still demonstrates the permission model

**Fallback C**: Deploy on Anvil with real wstETH fork of Base mainnet
```bash
anvil --fork-url https://mainnet.base.org
# Real wstETH at 0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452
# Real yield data, no mock needed
```

---

## Chain Decision

**Base Sepolia with MockWstETH** (recommended)

| Consideration | Sepolia | Mainnet |
|---------------|---------|---------|
| Cost | Free | Gas costs |
| Risk | None | Real funds |
| Yield demo | Simulated (instant) | Real (slow, ~3-4% APY) |
| Bounty eligible | Yes ("any L2") | Yes |
| Judge impression | Good with README framing | Better but riskier |

The MockWstETH `simulateYield()` is actually a **demo advantage** — we can show yield accrual instantly instead of waiting days for real staking rewards. README frames production path with real wstETH.
