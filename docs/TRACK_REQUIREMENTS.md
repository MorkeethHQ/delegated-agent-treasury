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

**Bonus — rebasing documentation:** `skill.md` explains stETH rebasing, wstETH non-rebasing mechanics, yield calculation formula, and safe usage patterns for agents.

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
| Live on Base | WETH → USDC swap confirmed on Base mainnet: [`0x9e3874...`](https://basescan.org/tx/0x9e387425cfddde0d2809d36a154b667ea37e8ea93a5943dda2c97416bc375ae9). Full flow: wrap → Permit2 approve → sign EIP-712 → POST /swap → broadcast. |
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
| Live on-chain | Real Uniswap swap on Base mainnet: [`0x9e3874...`](https://basescan.org/tx/0x9e387425cfddde0d2809d36a154b667ea37e8ea93a5943dda2c97416bc375ae9) — 0.001 WETH → 2.157 USDC |
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

## 10. Best Use of Delegations (MetaMask, $10,000)

| Requirement | How We Meet It |
|-------------|---------------|
| Use MetaMask Delegation Framework | `@metamask/smart-accounts-kit` integrated in `packages/executor/src/delegation.ts`. Creates delegations with caveats matching policy engine constraints. |
| Intent-based delegations | Owner delegates spendYield() authority to agent with 6 caveats: AllowedTargets (treasury contract only), AllowedMethods (spendYield only), ERC20TransferAmount (yield ceiling), Timestamp (auto-expiry), LimitedCalls (call cap). |
| Novel permission model | Defense-in-depth: offchain policy engine (TypeScript) + onchain delegation caveats (EVM). Two independent enforcement layers — if either is bypassed, the other still protects. |
| Sub-delegation potential | Multi-agent architecture (proposer/executor/auditor) maps to delegation chains: owner → proposer (suggest), proposer → executor (sign), auditor can revoke. |
| API endpoints | `GET /delegation` (framework info + caveat mapping), `POST /delegation/create` (create delegation with policy-matched caveats) |
| **Live EIP-7702 on-chain delegation** | Both owner and agent EOAs upgraded to EIP-7702 smart accounts on Base mainnet via MetaMask's EIP7702StatelessDeleGator v1.3.0. Real on-chain delegation, not just SDK integration. |

**Key insight:** Our policy engine constraints map 1:1 to MetaMask delegation caveats. The delegation framework provides the onchain enforcement layer that makes our offchain policy engine trustless.

**Live EIP-7702 delegation proof (March 22):**
- Owner EOA (`0x1101158041Fd96f21CBcbb0E752a9A2303E6D70e`) → EIP7702StatelessDeleGator v1.3.0: [`0x1a97c5...`](https://basescan.org/tx/0x1a97c54d3633f725e36d83b7c2535b054d296f868b20c0f1e0fbb076601e0f9c)
- Agent EOA (`0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6`) → same DeleGator contract: [`0x6f3a90...`](https://basescan.org/tx/0x6f3a90d43720f799e5830859476fcd1b2569eea4274c077617aa94206bca440e)
- DelegationManager: `0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3`
- DeleGator: `0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B` (MetaMask EIP7702StatelessDeleGator v1.3.0)

## 11. Best Agent on Celo (Celo, $5,000)

| Requirement | How We Meet It |
|-------------|---------------|
| Agentic application on Celo | AgentTreasuryCelo deployed on Celo mainnet: [`0xc976e4...`](https://celoscan.io/address/0xc976e463bd209e09cb15a168a275890b872aa1f0). Same yield-only spending pattern, adapted for Celo's stablecoin ecosystem. |
| Stablecoin-native infrastructure | Uses waCelUSDC (Wrapped Aave Celo USDC / stataUSDC) as the yield-bearing asset. USDC lending yield from Aave V3 on Celo. |
| Economic agency | Agent autonomously manages USDC lending yield — spends only accrued interest, never principal. Same 3 permission enforcements (recipient whitelist, per-tx cap, yield ceiling). |
| On-chain interaction | Live contract reads via ERC-4626 `convertToAssets()` for exchange rate. No external oracle needed — rate is computed on-chain from Aave's liquidity index. |
| Real-world applicability | Multi-chain agent treasury: Base (ETH staking yield via Lido) + Celo (USDC lending yield via Aave). Same agent, same policy engine, different yield sources. Demonstrates chain-agnostic design. |

**Deploy TX:** [`0x4a6058...`](https://celoscan.io/tx/0x4a6058ba5169e2db9dff908ed4bc5b2f8d96db70828244e84fde2e7de1095d12)

**Live Execution Proof (March 21):** Full 7-step E2E on Celo mainnet:
- Swap: 100 CELO → 6.67 USDC via Uniswap V3 [`0x0e1e99...`](https://celoscan.io/tx/0x0e1e99c29c5145c97076e11759ce6cb842c704e3908a59b09ced889c093b9cee)
- ERC-4626 deposit: USDC → 6.53 stataUSDC [`0x575789...`](https://celoscan.io/tx/0x575789f35d7e1ec6747ebd4cea357402f055aebd392894d471fb8d44d186f453)
- Treasury deposit: 6.53 stataUSDC [`0x504326...`](https://celoscan.io/tx/0x504326d7bb5b8d47d7e674e0d8a484c1a88f5a7c86836f395eb2138ad47b6a8f)
- setAgent + addRecipient + setPerTxCap configured
- **spendYield executed:** [`0xaac5f8...`](https://celoscan.io/tx/0xaac5f84913c34c661739274a39c9911f618b9a474c80e737fa81ca5afc533df5) — agent spent accrued Aave yield

## 12. ENS Identity ($400)

| Requirement | How We Meet It |
|-------------|---------------|
| ENS names for agent identity | 5 subdomains under `morke.eth`: treasury, bagel, bageldeployer, odawgagent + owner |
| Names replace hex addresses | API enriches all responses with ENS names. `GET /ens/resolve/:name` resolves both directions. |
| Agent identity via ENS | `bagel.morke.eth` identifies the agent signer. `treasury.morke.eth` identifies the contract. Human-readable identity for every participant. |

## 13. ENS Open Integration ($300)

| Requirement | How We Meet It |
|-------------|---------------|
| Meaningful ENS integration | ENS is core to identity — every address in the treasury system has an ENS name. API endpoints accept ENS names, audit trail shows names not hex. |
| Beyond an afterthought | `GET /ens/identities` maps the full treasury hierarchy. ENS resolution integrated into executor and API server. |
