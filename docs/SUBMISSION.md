# Submission Copy

## Project name
Yieldbound (Synthesis Agent Treasury)

## Tagline
Bounded financial authority over productive on-chain capital for autonomous agents.

## Description (short)
Agents don't need wallets. They need bounded authority. Yieldbound locks principal in yield-bearing positions (Lido wstETH on Base, stataUSDC on Celo) and gives agents permission to spend only what the capital earns. Three contract-level controls — yield ceiling, per-tx cap, recipient whitelist — make overspend structurally impossible. MetaMask Delegation caveats enforce the same boundaries onchain as a second layer. Agents deploy yield through policy-gated Uniswap swaps. Other agents pay USDC to access this financial service via x402. ERC-8004 identity gates trust decisions before any payment executes. Live on Base mainnet and Celo mainnet with real yield accruing.

## Description (long)

This project gives agents bounded financial authority over productive on-chain capital.

AI agents are increasingly autonomous, but their financial authority is binary — either no access or full wallet control. Neither works for production systems. We built a five-layer stack that solves this.

### Layer 1 — Treasury Primitive (Lido / stETH)

The source of productive capital. A human deposits wstETH into a smart contract on Base. Lido staking rewards cause the wstETH exchange rate to rise over time, generating yield passively. The agent's entire spending power derives from this yield. Principal is structurally locked at the EVM level — even a compromised agent key cannot drain the deposit. The treasury regenerates: as long as principal stays deposited, spending authority refills from real economic activity at ~3-4% APY. On Celo, the same primitive uses stataUSDC earning Aave lending yield.

On Base L2, bridged wstETH doesn't expose native rate functions, so the contract reads a Chainlink oracle for the wstETH/stETH exchange rate. Yield math is deterministic: `yield = deposited - (deposited * initialRate / currentRate)`.

### Layer 2 — Control Layer (Caps, Whitelists, Approvals, Freeze)

Three onchain enforcements protect every transaction:
1. **Yield ceiling** — spending can never exceed what the treasury has earned
2. **Per-transaction cap** — each spend is bounded to a configured maximum
3. **Recipient whitelist** — the agent can only send to pre-approved addresses

On top of the contract sits a policy engine that evaluates every action. Transfers and swaps have separate caps and independent risk controls (`maxSwapPerAction`, `maxSlippageBps`). Small amounts auto-execute. Larger amounts require human approval. Denied requests are blocked with reasons. Every action hits an append-only audit log.

A multi-bucket strategy engine routes yield across named buckets (operations, grants, reserve) with percentage-based allocation, threshold gating, and per-tx clamping.

Three agent roles (proposer/executor/auditor) enforce separation of duties. The auditor can freeze any agent's spending. The proposer submits plans. The executor signs transactions. All enforced at the API level.

### Layer 3 — Trust Layer (ERC-8004, Delegations, Audit)

Identity is used for decisioning, not just registration. Before sending to any recipient, the policy engine verifies their onchain agent identity via the ERC-8004 registry on Base. Unverified counterparties are escalated to human approval. This means trust is evaluated per-transaction, not granted once and forgotten.

Offchain policy becomes onchain caveats. Both the owner EOA and agent EOA are live EIP-7702 smart accounts on Base mainnet via MetaMask's EIP7702StatelessDeleGator v1.3.0. The owner creates a delegation to the agent with caveats — AllowedTargets, AllowedMethods, ERC20TransferAmount, Timestamp, LimitedCalls — that mirror the policy engine constraints. Even if the offchain policy is bypassed, onchain caveats protect the treasury. This is real onchain delegation confirmed in transactions on Base mainnet, not SDK integration alone.

Every action produces a receipt in the append-only audit trail. Governance awareness adds another dimension: the agent loop monitors Lido governance for risky proposals and autonomously pauses spending when dangerous votes are active.

### Layer 4 — Execution Layer (Uniswap, x402, MoonPay)

**Uniswap — policy-gated yield deployment.** The agent deploys yield into trading strategies via Uniswap on Base: DCA into USDC, swap to stable, rebalance. Each swap is bounded by its own cap and slippage limit, independent from transfer controls. This is yield deployment under policy, not a trading bot.

**x402 — agent-to-agent commercial layer.** Other agents pay USDC to access this financial service via Coinbase's HTTP 402 payment protocol. Swap quotes cost $0.01, execution costs $0.05. The treasury is a discoverable, payable service on Base. This proves agents can offer financial capability to other agents and get paid for it.

**MoonPay — alternative execution backend.** 54 crypto tools across 10+ chains (Base, Ethereum, Arbitrum, Polygon, etc.) integrated as an alternative execution path, all policy-gated through the same engine. This proves the control layer is backend-agnostic.

### Layer 5 — Portability Layer (Base, Celo)

The same treasury primitive deploys to multiple chains. On Celo, the contract uses stataUSDC (Aave-wrapped stablecoin) instead of wstETH, proving the yield-only spending model works across different asset types and chain environments. The agent has executed real spendYield and Uniswap swap transactions on Celo mainnet. Same control layer, same policy engine, different chain and asset — the primitive is portable.

---

**How it was built:** One human (Oscar) orchestrating two AI agents. Bagel (Cursor) wrote Solidity and deployed onchain. Claude Code built the 10-package TypeScript system — policy engine, trading engine, strategy engine, x402 gateway, MoonPay bridge, MCP server, API, CLI, and docs. Zero lines of human-written code. They communicated through a shared Git repo with Oscar relaying context between them.

## Tracks
- stETH Agent Treasury (Lido Labs Foundation, $3K)
- Lido MCP (Lido Labs Foundation, $5K)
- Synthesis Open Track (Synthesis Community, ~$28K)
- Agents With Receipts — ERC-8004 (Protocol Labs, $4K)
- Agentic Finance — Best Uniswap API Integration (Uniswap, $5K)
- Agent Services on Base (Base, $5K)
- Let the Agent Cook — No Humans Required (Protocol Labs, $4K)
- Autonomous Trading Agent (Base, $5K)
- MoonPay CLI Agents (MoonPay, $3.5K)
- Best Use of Delegations (MetaMask, $10K)
- Best Agent on Celo (Celo, $5K)

## Tech stack
- Solidity (Foundry) — AgentTreasury smart contract with Chainlink oracle
- TypeScript / Node.js — 10 packages: API, CLI, policy engine, strategy engine, trading engine, x402 gateway, audit trail, executor, MCP server
- Viem — onchain interaction (treasury + ERC-8004 registry)
- Uniswap Trading API — policy-gated yield deployment on Base
- x402 (Coinbase) — HTTP 402 payment-gated agent-to-agent commerce
- MCP SDK — 24-tool MCP server
- MoonPay CLI — alternative execution backend (swaps, DCA, bridges across 10+ chains)
- wstETH (Lido) — yield-bearing productive capital
- Base (mainnet + Sepolia) — primary deployment chain
- Celo (mainnet) — portability proof with stablecoin-native yield
- ERC-8004 — onchain agent identity for trust-gated payment decisions
- Chainlink — wstETH/stETH oracle on Base L2
- MetaMask Delegation Framework — ERC-7710/ERC-7715 onchain caveats as second enforcement layer

## Links
- Repo: https://github.com/MorkeethHQ/delegated-agent-treasury
- Base Mainnet Treasury: [`0x455d76a24e862a8d552a0722823ac4d13e482426`](https://basescan.org/address/0x455d76a24e862a8d552a0722823ac4d13e482426)
- Mainnet Deploy TX: [`0x33e648...`](https://basescan.org/tx/0x33e648434ce963eb47ddfb403df14f2faae20d72e78bf0e9ebafefa3e85ea0db)
- Chainlink Oracle (wstETH/stETH): [`0xB88BAc61a4Ca37C43a3725912B1f472c9A5bc061`](https://basescan.org/address/0xB88BAc61a4Ca37C43a3725912B1f472c9A5bc061)
- Base Sepolia Treasury: [`0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0`](https://sepolia.basescan.org/address/0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0)
- Agent Identity (ERC-8004): `10ee7e7e703b4fc493e19f512b5ae09d`
- wstETH on Base: [`0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452`](https://basescan.org/address/0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452)
- x402 Pricing: `GET /x402/pricing` on API
- Uniswap Swap Quote: `GET /swap/quote` on API
- Live Uniswap Swap TX: [`0x9e3874...`](https://basescan.org/tx/0x9e387425cfddde0d2809d36a154b667ea37e8ea93a5943dda2c97416bc375ae9) — WETH→USDC on Base mainnet
- Permit2 Approval TX: [`0x536b75...`](https://basescan.org/tx/0x536b75fd78f78106db68efcd3cdd7d162e8c6fe074e81dffa5841f8b888f462d)
- Celo Treasury: [`0xc976e4...`](https://celoscan.io/address/0xc976e463bd209e09cb15a168a275890b872aa1f0)
- Celo Deploy TX: [`0x4a6058...`](https://celoscan.io/tx/0x4a6058ba5169e2db9dff908ed4bc5b2f8d96db70828244e84fde2e7de1095d12)
- Celo spendYield TX: [`0xaac5f8...`](https://celoscan.io/tx/0xaac5f84913c34c661739274a39c9911f618b9a474c80e737fa81ca5afc533df5) — agent spent yield on Celo mainnet
- Celo Uniswap Swap TX: [`0x0e1e99...`](https://celoscan.io/tx/0x0e1e99c29c5145c97076e11759ce6cb842c704e3908a59b09ced889c093b9cee) — 100 CELO → USDC via Uniswap V3
- MetaMask EIP-7702 Delegation (owner EOA): [`0x1a97c5...`](https://basescan.org/tx/0x1a97c54d3633f725e36d83b7c2535b054d296f868b20c0f1e0fbb076601e0f9c) — `0x1101...70e` → EIP7702StatelessDeleGator v1.3.0 on Base mainnet
- MetaMask EIP-7702 Delegation (agent EOA): [`0x6f3a90...`](https://basescan.org/tx/0x6f3a90d43720f799e5830859476fcd1b2569eea4274c077617aa94206bca440e) — `0x4fD6...ce6` → same DeleGator contract on Base mainnet
- DelegationManager: [`0xdb9B1e...`](https://basescan.org/address/0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3)
- MoonPay USDC Transfer TX: [`0x82c733...`](https://basescan.org/tx/0x82c733d5acbcbbe441e3118ecfc3a45e5ac78544ca42a522e27f9d00ce46a96c) — 0.10 USDC → morke.eth (`0xf3476b36fc9942083049C04e9404516703369ef3`) via MoonPay CLI v1.12.4 on Base mainnet
- addRecipient TX: [`0xbc213e...`](https://basescan.org/tx/0xbc213e0f341b74b28e95d15c3c165bd8e6ae1719d101f2f5bcf6033eff5aceaa) — owner whitelisted morke.eth as recipient on Base mainnet contract
- **Autonomous spendYield TX: [`0x13bf6f...`](https://basescan.org/tx/0x13bf6fdca6796982ab201eeac4c35594402819e2bd47aff25fb28cd992893515) — agent loop autonomously read treasury state, computed spend (50% of available yield = ~0.0000001237 wstETH), submitted plan, received auto-approval, and executed on-chain on Base mainnet. Agent: `0x3d7d7712ad32efD8Cb05249d0C7a3De1B1A3bb43`. No human intervention.**

## Team
- Oscar (human) — architect, orchestrator, funder
- Bagel (AI agent, Cursor) — contract developer, onchain architecture
- Claude Code (AI agent, CLI) — systems engineer (10 packages, 24 MCP tools, 35 endpoints)
