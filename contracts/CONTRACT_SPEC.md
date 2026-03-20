# AgentTreasury Contract Spec

## One-liner
A minimal contract where a human deposits wstETH, an AI agent can spend only accrued yield, and all actions are permission-scoped and auditable.

## Lido Bounty Requirements (all 3 satisfied)
1. **Principal structurally inaccessible to agent** — only `owner` can withdraw principal
2. **Spendable yield balance agent can query and draw from** — `availableYield()` view + `spendYield()`
3. **Configurable permission** — recipient whitelist set by owner

## Roles
- **Owner** (human): deposits wstETH, sets permissions, withdraws principal, approves agent
- **Agent**: queries yield, spends yield to whitelisted recipients only

## Yield Math
wstETH is non-rebasing. Its value in stETH increases over time.

```
initialValue = depositedWstETH * initialRate    (stEthPerToken at deposit time)
currentValue = depositedWstETH * currentRate    (stEthPerToken now)
accruedYield = currentValue - initialValue      (in stETH terms)

// But we work in wstETH units for simplicity:
yieldInWstETH = depositedWstETH - (depositedWstETH * initialRate / currentRate)
availableYield = yieldInWstETH - alreadySpent
```

## Required Functions

### Owner-only
| Function | What |
|----------|------|
| `deposit(uint256 amount)` | Transfer wstETH into treasury, record initial rate |
| `withdrawPrincipal()` | Withdraw original deposit minus spent yield |
| `setAgent(address agent)` | Authorize the agent address |
| `addRecipient(address to)` | Add to whitelist |
| `removeRecipient(address to)` | Remove from whitelist |
| `setPerTxCap(uint256 cap)` | Max wstETH per spend |

### Agent-only
| Function | What |
|----------|------|
| `spendYield(address to, uint256 amount)` | Send wstETH from yield to whitelisted `to` |

### View (anyone)
| Function | Returns |
|----------|---------|
| `availableYield()` | Spendable yield in wstETH |
| `principal()` | Locked principal in wstETH |
| `isRecipient(address)` | Whitelist check |
| `totalSpent()` | Cumulative agent spend |

### Events
```solidity
event Deposited(address indexed owner, uint256 amount, uint256 initialRate);
event YieldSpent(address indexed agent, address indexed to, uint256 amount);
event PrincipalWithdrawn(address indexed owner, uint256 amount);
event AgentSet(address indexed agent);
event RecipientAdded(address indexed to);
event RecipientRemoved(address indexed to);
event PerTxCapSet(uint256 cap);
```

## Demo Flow (2 minutes for judge)

```
1. Owner deposits 1 wstETH into AgentTreasury
   → Deposited(owner, 1e18, initialRate)

2. Owner whitelists a recipient address + sets per-tx cap
   → RecipientAdded(recipient)
   → PerTxCapSet(0.01e18)

3. Owner authorizes agent address
   → AgentSet(agent)

4. Time passes, yield accrues (or we fork mainnet state where yield exists)

5. Agent calls availableYield() → sees spendable balance

6. Agent calls spendYield(recipient, amount)
   → YieldSpent(agent, recipient, amount)
   → wstETH transferred to recipient
   → Principal untouched

7. Agent tries to spend more than yield → REVERTS
8. Agent tries non-whitelisted recipient → REVERTS
9. Agent tries over per-tx cap → REVERTS
```

## Deployment Recommendation: Base Sepolia

**Why Sepolia over mainnet:**
- No real funds at risk during demo
- Faster iteration (free testnet ETH)
- Bounty explicitly says "any L2 or mainnet accepted"
- Frame README as "production-ready for Base mainnet" with same contract

**wstETH on Base mainnet**: `0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452`

**Problem**: wstETH doesn't exist on Base Sepolia. Options:
1. **Deploy a mock wstETH on Base Sepolia** with simulated yield accrual (owner can call `simulateYield()` to bump the rate) — **RECOMMENDED for demo**
2. Fork Base mainnet locally with Anvil for testing
3. Deploy on Base mainnet with real (small) wstETH — riskier but more impressive

**Recommended approach**: Option 1 for deployment + Option 2 for local testing. The mock has the same interface as real wstETH but lets us control yield accrual for the demo. Judges will see the mechanics work; the README explains it targets real wstETH in production.

## Contract Size Target
- AgentTreasury: ~120 lines
- MockWstETH (testnet only): ~40 lines
- Deploy script: ~30 lines
