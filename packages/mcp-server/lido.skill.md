# Lido Agent Treasury — MCP Skill

You have access to a Lido-powered Agent Treasury on Base. This skill lets you manage wstETH staking positions and spend yield from a delegated treasury.

## Mental model

**stETH** is Lido's liquid staking token. When you stake ETH with Lido, you get stETH that earns ~3-4% APY from Ethereum validator rewards. stETH rebases daily — your balance increases automatically.

**wstETH** is the wrapped, non-rebasing version. The balance stays constant, but its value in stETH increases over time. This makes accounting simpler. The exchange rate (`stEthPerToken`) is the key metric — it only goes up.

**The Agent Treasury** holds wstETH deposited by a human owner. You (the agent) can spend only the yield that accrues as the exchange rate increases. The principal is structurally locked — you cannot access it.

## What you can do

### Read operations (always available)
- `get_treasury_state` — see available yield, locked principal, total spent, per-tx cap
- `get_wsteth_balance` — check any address's wstETH balance and its stETH equivalent
- `get_steth_exchange_rate` — current wstETH/stETH rate (increases over time)
- `check_recipient` — verify if an address is whitelisted for treasury spending
- `get_lido_protocol_stats` — total pooled ETH, total shares (Ethereum mainnet only)

### Write operations (require wallet)
- `spend_yield` — spend accrued yield to a whitelisted recipient (the main action)
- `stake_eth` — stake ETH to get stETH (Ethereum mainnet only)
- `wrap_steth` — wrap stETH into wstETH (Ethereum mainnet only)
- `unwrap_wsteth` — unwrap wstETH back to stETH (Ethereum mainnet only)
- `request_withdrawal` — queue stETH for ETH withdrawal (Ethereum mainnet only)

All write operations support `dry_run: true` to simulate without executing.

## Spending from the treasury

Before spending, always:
1. Call `get_treasury_state` to check `availableYield`
2. Call `check_recipient` to verify the destination is whitelisted
3. Ensure your spend amount is under the `perTxCap`

If any check fails, the transaction will revert. Use `dry_run: true` first if unsure.

## Key concepts

- **Yield** = the wstETH value increase since deposit. Calculated as: `deposited - (deposited * initialRate / currentRate)`
- **Principal** = the original deposit value, always locked
- **Per-tx cap** = maximum wstETH per single spend, set by the owner
- **Recipient whitelist** = only pre-approved addresses can receive treasury funds

## Chain support

- **Base mainnet** (production): AgentTreasury at `<MAINNET_TREASURY_ADDRESS>`, real wstETH at `0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452`
- **Base Sepolia** (demo): AgentTreasury + MockWstETH deployed, `simulateYield()` for instant demo
- **Ethereum mainnet**: Full Lido staking (stake, wrap, unwrap, withdraw)
- **Base/Arbitrum/Optimism**: wstETH balance queries via bridged wstETH contracts
