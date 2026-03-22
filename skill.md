# Yieldbound 

A permission layer for AI agents managing yield-bearing treasuries. Agents spend only accrued wstETH yield — principal is structurally locked. Supports multi-bucket yield distribution, Uniswap trading, ERC-8004 trust gating, Lido governance awareness, and x402 paid API access.

## What this does

You are interacting with a delegated agent treasury backed by wstETH on Base. A human owner deposits wstETH, and you (the agent) can spend only the yield that accrues over time. The principal is never accessible to agents.

Three permission enforcements protect every transaction:
1. **Recipient whitelist** — you can only send to pre-approved addresses
2. **Per-transaction cap** — each spend is bounded
3. **Yield ceiling** — you cannot spend more than what the treasury has earned

Additional capabilities:
- **Multi-bucket yield strategies** — distribute yield across configurable buckets (operations, savings, DCA, etc.)
- **Uniswap trading** — swap yield tokens on Base via Uniswap, with separate swap caps and slippage limits
- **ERC-8004 trust gating** — verify counterparty on-chain identity before payments
- **Lido governance awareness** — monitor DAO proposals that affect the underlying staking protocol
- **x402 payment protocol** — certain API endpoints require USDC micropayments on Base

Every action is logged to an append-only audit trail.

---

## MCP Tools (28 tools)

Connect via MCP server at `packages/mcp-server`. These are the direct on-chain and protocol tools an agent can call.

### Treasury (3 tools)

#### `get_treasury_state`
Get the full on-chain state of the Agent Treasury: available yield, locked principal, total spent, deposited wstETH, per-tx cap, and authorized agent address.
- **Parameters:** none
- **Returns:** `{ availableYield, principal, totalSpent, depositedWstETH, perTxCap, agent, unit }`

#### `spend_yield`
Spend accrued wstETH yield from the Agent Treasury to a whitelisted recipient. Only available yield can be spent — principal is locked. Requires agent wallet.
- **Parameters:**
  - `to` (string) — Recipient address (must be whitelisted by treasury owner)
  - `amount` (string) — Amount of wstETH to spend (e.g. `"0.005"`)
  - `dry_run` (boolean, default false) — If true, simulate without executing
- **Returns:** `{ status, hash, blockNumber, amount, to }` or dry-run result

#### `check_recipient`
Check if an address is whitelisted as a valid recipient in the Agent Treasury.
- **Parameters:**
  - `address` (string) — Address to check
- **Returns:** `{ address, whitelisted }`

### Staking (7 tools)

#### `get_wsteth_balance`
Get the wstETH balance of an address, plus its equivalent value in stETH at the current exchange rate.
- **Parameters:**
  - `address` (string) — Wallet address to check
- **Returns:** `{ address, wstETH, stETHValue, exchangeRate }`

#### `get_steth_exchange_rate`
Get the current wstETH/stETH exchange rate. wstETH is non-rebasing — the rate increases over time as staking rewards accrue.
- **Parameters:** none
- **Returns:** `{ stEthPerWstETH, explanation }`

#### `stake_eth`
Stake ETH with Lido to receive stETH. Submits ETH to the Lido staking pool. Ethereum mainnet only.
- **Parameters:**
  - `amount` (string) — Amount of ETH to stake (e.g. `"1.0"`)
  - `dry_run` (boolean, default false) — Simulate without executing
- **Returns:** `{ status, action, hash, blockNumber, amount }`

#### `wrap_steth`
Wrap stETH into wstETH. wstETH is non-rebasing and easier to use in DeFi. Requires stETH balance and approval. Ethereum mainnet only.
- **Parameters:**
  - `amount` (string) — Amount of stETH to wrap (e.g. `"1.0"`)
  - `dry_run` (boolean, default false) — Simulate without executing
- **Returns:** `{ status, action, hash, blockNumber, amount }`

#### `unwrap_wsteth`
Unwrap wstETH back to stETH. Returns the stETH equivalent at the current exchange rate. Ethereum mainnet only.
- **Parameters:**
  - `amount` (string) — Amount of wstETH to unwrap (e.g. `"0.5"`)
  - `dry_run` (boolean, default false) — Simulate without executing
- **Returns:** `{ status, action, hash, blockNumber, amount }`

#### `request_withdrawal`
Request a withdrawal of stETH back to ETH. Enters the Lido withdrawal queue. Must be claimed after finalization (typically 1-5 days). Ethereum mainnet only.
- **Parameters:**
  - `amount` (string) — Amount of stETH to withdraw (e.g. `"1.0"`)
  - `dry_run` (boolean, default false) — Simulate without executing
- **Returns:** `{ status, action, hash, blockNumber, amount, note }`

#### `get_lido_protocol_stats`
Get Lido protocol statistics: total pooled ETH, total shares, and the implied stETH/ETH exchange rate. Ethereum mainnet only.
- **Parameters:** none
- **Returns:** `{ totalPooledETH, totalShares, impliedRate }`

### Governance (1 tool)

#### `get_lido_governance_proposals`
Get recent Lido DAO governance proposals from Snapshot. Returns proposal title, state, vote counts, and links. Use this to understand ongoing or past governance decisions affecting the Lido protocol.
- **Parameters:**
  - `state` (enum: `active`, `closed`, `pending`, `all` — default `all`) — Filter by proposal state
  - `limit` (number, 1-20, default 5) — Number of proposals to return
- **Returns:** `{ proposals: [{ id, title, state, author, created, voting, results, totalVotingPower, totalVotes, link }] }`

### Strategy (3 tools)

#### `get_yield_strategy`
Get the current yield distribution strategy configuration: buckets, percentages, thresholds.
- **Parameters:** none
- **Returns:** The full strategy JSON (strategyId, agentId, buckets with destinations, percentages, labels)

#### `preview_yield_distribution`
Preview what the next yield distribution would look like based on current treasury state and strategy config. Does not execute anything.
- **Parameters:** none
- **Returns:** Distribution plan with per-bucket amounts and totals

#### `trigger_yield_distribution`
Manually trigger a full yield distribution cycle. Computes the plan and submits each bucket through the policy engine for evaluation and execution.
- **Parameters:**
  - `dry_run` (boolean, default false) — If true, only preview the plan without executing
- **Returns:** `{ plan, results: [{ bucketId, decision, execution? }] }`

### Trust (1 tool)

#### `verify_counterparty_identity`
Verify whether an address has a registered ERC-8004 on-chain agent identity on the Base mainnet registry. Use this before making payments to check if the recipient is a trusted, verified agent.
- **Parameters:**
  - `address` (string) — Ethereum address to verify against the ERC-8004 registry
- **Returns:** `{ address, verified, agentId, details, name }`

### Trading (3 tools)

#### `get_swap_quote`
Get a Uniswap quote for swapping yield tokens on Base. Returns expected output amount, price impact, and gas estimate.
- **Parameters:**
  - `tokenIn` (string) — Address of the input token (e.g. wstETH)
  - `tokenOut` (string) — Address of the output token (e.g. USDC)
  - `amount` (string) — Amount of input token in wei
- **Returns:** Quote with expected output, price impact, gas estimate

#### `preview_yield_swap`
Preview what a DCA/swap strategy would do with the current available yield. Calls Uniswap for indicative quotes without executing anything.
- **Parameters:** none
- **Returns:** `{ availableTokens, yieldPreview, hint }`

#### `execute_yield_swap`
Execute a yield swap through the policy engine. Swaps yield tokens on Uniswap via Base chain. Supports dry_run mode.
- **Parameters:**
  - `tokenOut` (string) — Address of the output token to swap yield into
  - `amount` (string) — Amount of yield token (wstETH) to swap, in wei
  - `reason` (string) — Reason for the swap (for audit trail)
  - `dry_run` (boolean, default true) — If true, simulate only
- **Returns:** `{ result, swap }` with policy evaluation and swap execution details

### MoonPay (7 tools)

MoonPay CLI provides 54 crypto tools across 10+ chains. These MCP tools wrap MoonPay operations through our policy engine.

#### `moonpay_status`
Check whether MoonPay CLI is installed, authenticated, and what tools are available.
- **Parameters:** none
- **Returns:** `{ config, status: { installed, cliVersion, authenticated, availableTools, setupInstructions? } }`

#### `moonpay_swap`
Execute a token swap via MoonPay CLI across 10+ chains (Base, Ethereum, Arbitrum, Polygon, Optimism, etc.). Goes through policy engine for approval.
- **Parameters:**
  - `fromToken` (string) — Symbol or address of input token (e.g. "ETH", "USDC")
  - `toToken` (string) — Symbol or address of output token (e.g. "USDC", "wstETH")
  - `amount` (string) — Amount of input token (e.g. "0.1")
  - `chain` (string, default "base") — Chain to execute on
  - `reason` (string) — Reason for the swap (audit trail)
  - `dry_run` (boolean, default true) — If true, simulate only
- **Returns:** `{ result, swap }` with policy evaluation and MoonPay execution details

#### `moonpay_dca`
Set up a Dollar Cost Averaging order via MoonPay CLI. Automatically buys a token at a set frequency.
- **Parameters:**
  - `token` (string) — Token to DCA into (e.g. "ETH", "BTC")
  - `amount` (string) — Amount per purchase
  - `frequency` (enum: `daily`, `weekly`, `monthly`)
  - `chain` (string, default "base") — Chain to execute on
  - `reason` (string) — Reason for the DCA (audit trail)
  - `dry_run` (boolean, default true) — If true, simulate only
- **Returns:** `{ result, swap }` with policy evaluation and DCA setup details

#### `moonpay_quote`
Get a swap quote from MoonPay CLI without executing the trade. Returns estimated output and price impact.
- **Parameters:**
  - `fromToken` (string) — Symbol or address of input token (e.g. "ETH", "USDC")
  - `toToken` (string) — Symbol or address of output token (e.g. "USDC", "wstETH")
  - `amount` (string) — Amount of input token (e.g. "0.1")
  - `chain` (string, default "base") — Chain to get quote on
- **Returns:** `{ success, fromToken, toToken, amount, chain, estimatedOutput?, priceImpact? }`

#### `moonpay_balance`
Check the balance of a specific token on a specific chain via MoonPay CLI.
- **Parameters:**
  - `token` (string) — Token symbol to check (e.g. "ETH", "USDC", "wstETH")
  - `chain` (string, default "base") — Chain to check balance on
- **Returns:** `{ token, chain, balance }`

#### `moonpay_bridge`
Bridge tokens from one chain to another via MoonPay CLI. Goes through policy engine for approval.
- **Parameters:**
  - `token` (string) — Token to bridge (e.g. "ETH", "USDC")
  - `amount` (string) — Amount to bridge (e.g. "0.1")
  - `fromChain` (string) — Source chain (e.g. "ethereum", "base")
  - `toChain` (string) — Destination chain (e.g. "base", "arbitrum")
  - `reason` (string) — Reason for the bridge (audit trail)
  - `dry_run` (boolean, default true) — If true, simulate only
- **Returns:** `{ result, bridge }` with policy evaluation and bridge execution details

#### `moonpay_portfolio`
Get a portfolio overview across all supported chains via MoonPay CLI.
- **Parameters:** none
- **Returns:** `{ success, portfolio }` with token holdings and balances across chains

---

## REST API (39 endpoints)

Base URL: `{API_URL}` (default `http://localhost:3001`)

### Core Treasury

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check — returns service status, executor connection, x402 state |
| `GET` | `/treasury` | Full on-chain treasury state (yield, principal, spent, cap, agent) |
| `GET` | `/policy` | Active policy: spending limits, allowed/denied destinations, approval threshold |
| `GET` | `/audit` | All audit events in reverse chronological order |

### Plans & Approvals

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/plans/evaluate` | Submit an action plan for policy evaluation. Returns `approved`, `approval_required`, or `denied` |
| `GET` | `/approvals` | List all approvals (filter with `?status=pending`) |
| `GET` | `/approvals/{id}` | Get a specific approval by ID |
| `POST` | `/approvals/{id}/respond` | Respond to a pending approval (`{ "decision": "approved" }` or `"denied"`) |

### Strategy & Distribution

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/strategy` | Get the current yield distribution strategy config |
| `GET` | `/strategy/preview` | Preview next distribution (supports `?yield=X&perTxCap=Y` for offline mode) |
| `POST` | `/strategy/distribute` | Trigger a full yield distribution cycle through the policy engine |

### Trading & Swaps

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/swap/tokens` | List available tokens for swapping on Base (addresses, symbols) |
| `GET` | `/swap/quote` | Get a Uniswap quote (`?tokenIn=&tokenOut=&amount=`) |
| `POST` | `/swap/execute` | Execute a policy-gated yield swap via Uniswap |

### MoonPay

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/moonpay/status` | Check if MoonPay CLI is installed, authenticated, and available tools |
| `POST` | `/moonpay/swap` | Execute a multi-chain swap via MoonPay CLI (policy-gated) |
| `GET` | `/moonpay/tools` | List all available MoonPay tools (54 tools across 17 skills) |
| `GET` | `/moonpay/quote` | Get a swap quote (`?fromToken=&toToken=&amount=&chain=`) |
| `GET` | `/moonpay/balance` | Get token balance (`?token=&chain=`) |
| `POST` | `/moonpay/bridge` | Bridge tokens cross-chain via MoonPay CLI (policy-gated) |
| `GET` | `/moonpay/portfolio` | Portfolio overview across all chains |

### Identity & Payments

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/verify/{address}` | Verify ERC-8004 on-chain agent identity for an address |
| `GET` | `/x402/pricing` | Get the x402 pricing table for all paid endpoints |

### Agents

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/agents` | List all registered agents with roles and freeze status |
| `GET` | `/agents/{id}` | Get agent profile by ID |
| `POST` | `/agents/{id}/freeze` | Auditor: freeze agent spending |
| `POST` | `/agents/{id}/unfreeze` | Admin: unfreeze agent spending |

### Delegation

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/delegation` | MetaMask Delegation Framework info and caveat mapping |
| `POST` | `/delegation/create` | Create delegation with policy-matched caveats (ERC-7710) |

### ENS

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/ens/identities` | All ENS identities for treasury participants (morke.eth subdomains) |
| `GET` | `/ens/resolve/{name}` | Resolve ENS name to address or address to ENS name |

### Trading Performance

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/swap/strategies` | Configured trading strategies with allocation percentages |
| `GET` | `/trading/performance` | PnL tracking — aggregated swap results from audit log |
| `GET` | `/trading/strategies` | Trading strategies enriched with execution counts and stats |

### Monitoring & Onboarding

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/monitoring/status` | System health dashboard (uptime, treasury, active alerts) |
| `GET` | `/monitoring/alerts` | Spend velocity, denial rate, frozen agent alerts |
| `POST` | `/monitoring/webhook` | Register webhook for event-driven alerts |
| `GET` | `/onboarding/status` | Agent self-discovery protocol (capabilities, boot sequence) |

---

## x402 Payment Protocol

When `ENABLE_X402=true`, certain endpoints require USDC micropayments on Base via the [x402 protocol](https://x402.org).

### Paid endpoints

| Endpoint | Price (USDC) | Description |
|----------|-------------|-------------|
| `GET /swap/quote` | $0.01 | Live Uniswap swap quote |
| `POST /swap/execute` | $0.05 | Execute a policy-gated yield swap |
| `GET /strategy/preview` | $0.01 | Preview yield distribution |
| `GET /verify/{address}` | $0.01 | ERC-8004 identity verification |

### Free endpoints

`GET /health`, `GET /policy`, `GET /treasury`, `GET /swap/tokens`, `GET /audit`, `GET /x402/pricing`

### How it works

1. Client sends a request to a paid endpoint without payment
2. Server responds `HTTP 402` with `X-PAYMENT-REQUIRED` header (base64-encoded JSON with payment requirements)
3. Client signs a USDC `TransferWithAuthorization` and retries with `X-PAYMENT` header
4. Server verifies via the x402 facilitator, settles on-chain, responds with `X-PAYMENT-RESPONSE` header
5. Compatible with `@x402/fetch`, `@x402/axios`, and any x402-compliant client

**Payment details:**
- Asset: USDC on Base (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- Pay to: `0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6`
- Chain ID: 8453

---

## Typical agent flow

1. Check `get_treasury_state` (or `GET /treasury`) to see available yield
2. Optionally run `get_lido_governance_proposals` to check for active proposals that might affect the protocol
3. Optionally run `verify_counterparty_identity` to verify the recipient has an ERC-8004 identity
4. Submit a plan via `spend_yield` (MCP) or `POST /plans/evaluate` (REST) with amount, destination, and reason
5. If `approved`, the transaction executes automatically — check the `execution` field in the response
6. If `approval_required`, wait for a human to respond — poll `/approvals/{id}` or retry later
7. If `denied`, review the `reasons` array and adjust your plan
8. For yield distribution, use `preview_yield_distribution` then `trigger_yield_distribution` to distribute across strategy buckets
9. For trading, use `get_swap_quote` to check prices, then `execute_yield_swap` to swap yield tokens on Uniswap

## Constraints

- You can only spend yield, never principal
- Destinations must be whitelisted by the treasury owner
- Each transaction must be under the per-tx cap
- Swaps have a separate `maxSwapPerAction` cap and `maxSlippageBps` slippage limit
- Your agent ID must match the policy
- If `requireVerifiedIdentity` is enabled, recipients must have an ERC-8004 identity
- All actions are permanently logged to the audit trail

## On-chain contracts

The treasury is an `AgentTreasury` smart contract on Base backed by wstETH. Yield accrues as the wstETH exchange rate increases over time. The contract enforces all permission rules at the EVM level — the API is a convenience layer, not a trust boundary.

**Base Mainnet (chain 8453):**
- AgentTreasury: `0x455d76a24e862a8d552a0722823ac4d13e482426`
- wstETH: `0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452`
- Chainlink wstETH/stETH Oracle: `0xB88BAc61a4Ca37C43a3725912B1f472c9A5bc061`

**Base Sepolia (chain 84532, demo):**
- AgentTreasury: `0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0`
- MockWstETH: `0x4b8e084234edc18285cb57d8b29a59c2f1fb7a2d`

**Celo Mainnet (chain 42220):**
- AgentTreasuryCelo: `0xc976e463bd209e09cb15a168a275890b872aa1f0`
- waCelUSDC (stataUSDC): `0xba3ae0F0A78579a5e8C4188dcde60DcCc0Dd4Fab`
