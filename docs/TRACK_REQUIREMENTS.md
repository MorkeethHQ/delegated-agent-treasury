# Track Requirements — How We Meet Each Bounty

## 1. stETH Agent Treasury (Lido, $3,000)

| Requirement | How We Meet It |
|-------------|---------------|
| Agent cannot access principal funds | `spendYield()` enforces `amount <= availableYield()` at the EVM level. Principal is calculated as `depositedWstETH * initialRate / currentRate` and is structurally untouchable. |
| Yield balance must be spendable by agent | `availableYield()` returns real-time yield. Agent calls `spendYield(to, amount)` to spend. Proven on Sepolia: [TX 0x77dfdb5a...](https://sepolia.basescan.org/tx/0x77dfdb5a22e9fa110aa7f5173e2d7bdf650d8b35374ef124ebe7dad6e47e0d4f) |
| Minimum one configurable permission setting | Three: recipient whitelist (`addRecipient`/`removeRecipient`), per-tx cap (`setPerTxCap`), agent address (`setAgent`) |
| Testnet or mainnet deployment (no mocks) | Mainnet: [`0x455d...2426`](https://basescan.org/address/0x455d76a24e862a8d552a0722823ac4d13e482426) (Chainlink oracle). Sepolia: [`0x6fb8...7ae0`](https://sepolia.basescan.org/address/0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0) with live E2E spend proof |

**Beyond requirements:** Policy engine with approval workflows, autonomous agent loop with governance awareness, append-only audit trail, ERC-8004 identity.

## 2. Lido MCP Server (Lido, $5,000)

| Requirement | How We Meet It |
|-------------|---------------|
| Stake and unstake operations | `stake_eth` (ETH → stETH), `request_withdrawal` (stETH → ETH queue) |
| Wrap/unwrap functionality | `wrap_steth` (stETH → wstETH), `unwrap_wsteth` (wstETH → stETH) |
| Balance and rewards queries | `get_wsteth_balance` (balance + stETH equivalent), `get_steth_exchange_rate`, `get_lido_protocol_stats` |
| At least one governance action | `get_lido_governance_proposals` — queries Lido DAO proposals from Snapshot (`lido-snapshot.eth`), filters by state |
| Dry-run support on all write operations | All 5 write tools (`spend_yield`, `stake_eth`, `wrap_steth`, `unwrap_wsteth`, `request_withdrawal`) accept `dry_run: true` |
| Real onchain integration | Treasury tools use viem to call verified contract on Base. Staking tools use Lido mainnet contracts. Governance queries Snapshot API live. |

**Bonus — rebasing documentation:** `lido.skill.md` explains stETH rebasing, wstETH non-rebasing mechanics, yield calculation formula, and safe usage patterns for agents.

**Tool count: 11** — 3 treasury, 7 staking, 1 governance.

## 3. Synthesis Open Track (~$28,000)

| Criteria | How We Fit |
|----------|-----------|
| Cross-sponsor compatibility | Lido (wstETH treasury + staking + governance) + Protocol Labs (ERC-8004 identity) + Base (mainnet deployment) |
| Well-designed agent system | Policy engine → approval workflow → on-chain execution → audit trail. Clean separation of concerns across 10 packages. |
| Genuine utility | Solves a real problem: agents need bounded financial authority. Yield-only spending from staked assets is a novel primitive. |
| Coherent build | Single monorepo, 32 commits over 7 days, consistent architecture from contract to MCP to CLI to autonomous loop |

## 4. Agents With Receipts — ERC-8004 (Protocol Labs, $4,000)

| Requirement | How We Meet It |
|-------------|---------------|
| ERC-8004 integration through actual onchain transactions | [Registration TX](https://basescan.org/tx/0x4027641718bb5cfb9fdf7f4871f6506685b5367cab1a3a030b9bb0fe779ee934) on Base mainnet. Agent ID: `10ee7e7e703b4fc493e19f512b5ae09d` |
| Autonomous system architecture | Agent loop monitors treasury + governance, makes spend/hold decisions autonomously, all bounded by policy engine |
| Agent identity + operator model | `agent.json` manifest with ERC-8004 identity, capabilities, interfaces, and three operators (Oscar/human, Bagel/agent, Claude Code/agent) |
| Onchain verifiability | Verified contract on Basescan. 3 Sepolia spend TXs. ERC-8004 registration TX. All publicly auditable. |
| DevSpot compatibility | `agent.json` (manifest) + `agent_log.json` (execution logs) present in repo root |

**Safety guardrails:** Policy engine enforces agent match, destination whitelist, per-tx cap, daily cap, approval thresholds. Governance-aware loop pauses spending during risky protocol votes.

## 5. Agentic Finance — Best Uniswap API Integration (Uniswap, $5,000)

| Requirement | How We Meet It |
|-------------|---------------|
| Use the Uniswap Trading API | Full integration: `POST /quote`, `POST /check_approval`, `POST /swap` via `packages/trading-engine/` |
| On-chain swap execution | `executeSwapLive()` — check approval → get quote → sign EIP-712 permitData → POST /swap → broadcast tx via viem WalletClient |
| Live on Base | wstETH → USDC swaps via Uniswap V3 pools on Base (chain 8453). Live quotes returning real prices. |
| Meaningful use case | Agent deploys yield-only into bounded trading strategies (DCA, swap-to-stable, rebalance). Principal never touches Uniswap. |

**Endpoints:** `GET /swap/quote` (live Uniswap prices), `POST /swap/execute` (policy-gated yield swap), `GET /swap/tokens`, `GET /swap/strategies`.
**MCP tools:** `get_swap_quote`, `preview_yield_swap`, `execute_yield_swap` — all with dry_run support.
**Policy controls:** Separate `maxSwapPerAction` (0.01 wstETH) and `maxSlippageBps` (100 = 1%) caps for swaps vs transfers.
**E2E test:** `scripts/test-swap-e2e.sh` — 7-step integration test with optional `LIVE_SWAP=true` on-chain execution.

## 6. Agent Services on Base ($5,000)

| Requirement | How We Meet It |
|-------------|---------------|
| Agent-as-a-service on Base | Treasury API is a discoverable, payable service. Other agents pay USDC to use it via x402. |
| x402 payment protocol | `packages/x402-gateway/` — HTTP 402 payment gating using Coinbase's x402 standard. Server returns 402 + payment instructions, client signs USDC payment. |
| USDC payments on Base | Pricing: swap quotes $0.01, swap execution $0.05, strategy preview $0.01, identity verification $0.01. All in USDC on Base. |
| Multi-agent architecture | 3-role system (proposer/executor/auditor) with freeze/unfreeze. Auditor can halt spending. API: `/agents`, `/agents/:id/freeze`, `/agents/:id/unfreeze`. |
| On Base mainnet | AgentTreasury deployed at `0x455d76a24e862a8d552a0722823ac4d13e482426`. USDC payments at `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`. |

**Free endpoints:** /health, /policy, /treasury, /swap/tokens, /audit, /x402/pricing.
**Paid endpoints:** /swap/quote, /swap/execute, /strategy/preview, /verify/:address.
**MoonPay integration:** Additional execution backend via MoonPay CLI — 54 crypto tools across 10+ chains, policy-gated through same engine.

## 7. Let the Agent Cook — No Humans Required (Protocol Labs, $4,000)

| Requirement | How We Meet It |
|-------------|---------------|
| Multi-tool agent orchestration | 24 MCP tools across treasury, staking, governance, trading, strategy, identity, agents |
| ERC-8004 identity | Registered on Base mainnet. Agent ID: `10ee7e7e703b4fc493e19f512b5ae09d`. Trust-gated payments verify counterparties. |
| Agent manifest | `agent.json` in repo root — ERC-8004 identity, capabilities, interfaces, operators |
| Execution logs | `agent_log.json` — structured execution logs with phases and timestamps |
| Safety guardrails | Policy engine (caps, thresholds, whitelists), frozen agent denial, governance-aware pause, approval escalation |
| Autonomous operation | Agent loop monitors yield + governance, auto-executes below threshold, escalates above. Multi-agent roles: proposer/executor/auditor with freeze/unfreeze. |

## 8. Autonomous Trading Agent (Base, $5,000)

| Requirement | How We Meet It |
|-------------|---------------|
| Autonomous trading on Base | Agent deploys yield into Uniswap V3 trading strategies — DCA-USDC (50%), swap-to-ETH (30%), rebalance-cbETH (20%) |
| Policy-gated execution | Separate `maxSwapPerAction` (0.01 wstETH) and `maxSlippageBps` (100 = 1%) caps for swaps |
| Live on-chain | Real Uniswap swap executed on Base mainnet via Trading API (quote → Permit2 → sign → broadcast) |
| Risk controls | Principal never touches trading. Only accrued yield is deployed. Per-tx caps, daily limits, slippage bounds. |
| Configurable strategies | `config/sample-trading-strategies.json` — 3 strategies with allocation percentages, thresholds, slippage limits |

## 9. MoonPay CLI Agents (MoonPay, $3,500)

| Requirement | How We Meet It |
|-------------|---------------|
| MoonPay CLI integration | `packages/moonpay-bridge/` — full bridge with CLI detection, graceful degradation, policy-gated execution |
| Multi-chain support | 10+ chains: Base, Ethereum, Arbitrum, Polygon, Optimism, BNB, Avalanche, Solana, Tron |
| MCP tools | 3 tools: `moonpay_status`, `moonpay_swap`, `moonpay_dca` — all policy-gated with dry_run |
| API endpoints | `GET /moonpay/status`, `POST /moonpay/swap`, `GET /moonpay/tools` |
| 54 crypto tools exposed | Bridge catalogs all MoonPay tool categories: wallet, trading, DCA, orders, portfolio, market, onramp, offramp, transfers |
