# Submission Copy

## Project name
Synthesis Agent Treasury

## Tagline
Principal-protected, yield-activated agent treasury with autonomous trading strategies on Base.

## Description (short)
A treasury where AI agents can only spend accrued yield — never principal. Agents deploy yield into Uniswap trading strategies on Base, all policy-gated with separate swap caps and slippage limits. Trust-gated payments via ERC-8004 identity verification. Other agents pay USDC to use the service via x402. 18 MCP tools, 16 API endpoints, live on Base mainnet with real Lido staking yield. Built by two AI agents orchestrated by one human.

## Description (long)
AI agents are increasingly autonomous, but their financial authority is binary — either no access or full wallet control. Neither works for production systems.

Synthesis Agent Treasury creates bounded financial autonomy. A human deposits wstETH into a smart contract on Base. As Lido staking rewards accrue, the wstETH exchange rate increases. The agent can spend only the yield — the principal is structurally locked at the EVM level.

**Three on-chain enforcements protect every transaction:**
1. Recipient whitelist — agent can only send to pre-approved addresses
2. Per-transaction cap — each spend is bounded
3. Yield ceiling — spending can never exceed what the treasury has earned

**Not just spending — deploying:** The agent deploys yield into trading strategies via Uniswap on Base. DCA into USDC, swap to stable, rebalance — all with separate swap caps (`maxSwapPerAction`) and slippage limits (`maxSlippageBps`). The policy engine treats transfers and swaps as distinct action types with independent risk controls.

**Multi-bucket yield distribution:** A configurable strategy engine routes yield across named buckets (operations, grants, reserve) with percentage-based allocation, threshold gating, and per-tx clamping.

**Trust-gated payments:** Before sending to any recipient, the policy engine verifies their on-chain agent identity via the ERC-8004 registry on Base. Unverified counterparties are escalated to human approval.

**Agent-as-a-service:** Other agents pay USDC to use this treasury via x402 (HTTP 402 payment protocol by Coinbase). Swap quotes cost $0.01, execution $0.05. The treasury becomes a discoverable, payable service on Base.

**Autonomous governance-aware agent:** The agent loop monitors treasury yield, queries Lido governance for risky proposals, and autonomously decides to spend, swap, or hold. Dangerous governance votes pause spending automatically.

**MCP-native:** 18 MCP tools covering treasury management, Lido staking (stake, wrap, unwrap, withdraw), governance, multi-bucket strategies, ERC-8004 identity verification, and Uniswap trading — natively callable from Claude, Cursor, or any MCP-compatible agent. All write operations support dry_run simulation.

On Base mainnet, the contract uses a Chainlink oracle for the wstETH/stETH exchange rate, solving the L2 challenge of bridged wstETH not exposing native rate functions.

Built by one human (Oscar) orchestrating two AI agents: Bagel (Cursor) wrote Solidity and deployed on-chain. Claude Code built the 9-package TypeScript system — policy engine, trading engine, strategy engine, x402 gateway, MCP server, API, CLI, and docs. Zero lines of human-written code.

## Tracks
- Lido: stETH Agent Treasury ($3K)
- Lido: MCP Server ($5K)
- Synthesis Open Track ($14.5K)
- Protocol Labs: Agents With Receipts — ERC-8004 ($8K)
- Uniswap ($5K) — yield-to-swap via Trading API on Base
- Agent Services on Base ($5K) — x402 payment-gated agent service

## Tech stack
- Solidity (Foundry) — AgentTreasury smart contract with Chainlink oracle
- TypeScript / Node.js — 9 packages: API, CLI, policy engine, strategy engine, trading engine, x402 gateway, audit trail, executor, MCP server
- Viem — on-chain interaction (treasury + ERC-8004 registry)
- Uniswap Trading API — yield swap execution on Base
- x402 (Coinbase) — HTTP 402 payment-gated agent service
- MCP SDK — 18-tool MCP server
- wstETH (Lido) — yield-bearing asset
- Base (mainnet + Sepolia) — deployment chain
- ERC-8004 — on-chain agent identity + trust-gated payments
- Chainlink — wstETH/stETH oracle on Base L2

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

## Team
- Oscar (human) — architect, orchestrator, funder
- Bagel (AI agent, Cursor) — contract developer, on-chain architecture
- Claude Code (AI agent, CLI) — systems engineer (9 packages, 18 MCP tools, 16 endpoints)
