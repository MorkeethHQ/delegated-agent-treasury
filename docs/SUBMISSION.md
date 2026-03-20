# Submission Copy

## Project name
Synthesis Agent Treasury

## Tagline
Yield-only spending for AI agents. Principal is structurally locked.

## Description (short)
A permission layer for AI agents managing yield-bearing wstETH treasuries on Base. Human deposits wstETH, yield accrues via Lido staking rewards, agent spends only the yield. Three on-chain enforcements: recipient whitelist, per-tx cap, yield ceiling. Every action is policy-evaluated and audit-logged. Built by two AI agents orchestrated by one human — zero lines of human-written code.

## Description (long)
AI agents are increasingly autonomous, but their financial authority is binary — either no access or full wallet control. Neither works for production systems.

Synthesis Agent Treasury creates bounded financial autonomy. A human deposits wstETH into a smart contract on Base. As Lido staking rewards accrue, the wstETH exchange rate increases. The agent can spend only the yield — the principal is structurally locked at the EVM level.

Three permission enforcements protect every transaction:
1. Recipient whitelist — agent can only send to pre-approved addresses
2. Per-transaction cap — each spend is bounded
3. Yield ceiling — spending can never exceed what the treasury has earned

On top of the smart contract sits a policy engine that evaluates every spending plan against configurable rules. Small amounts auto-execute on-chain. Larger amounts require human approval via CLI. Denied requests are blocked with reasons. Every action hits an append-only audit log.

The system includes a Model Context Protocol (MCP) server with 11 tools covering treasury operations, Lido staking (stake, wrap, unwrap, withdraw), and Lido DAO governance — natively callable from any MCP-compatible agent (Claude, Cursor, etc.). All write operations support dry_run simulation. An ERC-8004 on-chain identity gives the agent a verifiable identity that counterparties can check.

An autonomous agent loop ties it all together: the agent monitors treasury yield, queries Lido governance for risky proposals (upgrades, parameter changes), and autonomously decides to spend or hold — all bounded by the policy engine. On Base mainnet, the contract uses a Chainlink oracle for the wstETH/stETH exchange rate, solving the L2 challenge of bridged wstETH not exposing native rate functions.

The entire project was built by one human (Oscar) orchestrating two AI agents: Bagel (Cursor) wrote the Solidity contracts and handled deployment, while Claude Code built the approval backend, policy engine, MCP server, CLI, and documentation. Zero lines of human-written code.

## Tracks
- Lido: stETH Agent Treasury
- Lido: MCP Server
- Synthesis Open Track
- Protocol Labs: Agents With Receipts — ERC-8004

## Tech stack
- Solidity (Foundry) — AgentTreasury smart contract
- TypeScript / Node.js — API, CLI, policy engine, audit trail
- Viem — on-chain interaction
- MCP SDK — 11-tool MCP server for treasury + Lido staking + governance
- wstETH (Lido) — yield-bearing asset
- Base (mainnet + Sepolia) — deployment chain
- ERC-8004 — on-chain agent identity

## Links
- Repo: https://github.com/MorkeethHQ/delegated-agent-treasury
- Base Mainnet Treasury: [`0x455d76a24e862a8d552a0722823ac4d13e482426`](https://basescan.org/address/0x455d76a24e862a8d552a0722823ac4d13e482426)
- Mainnet Deploy TX: [`0x33e648...`](https://basescan.org/tx/0x33e648434ce963eb47ddfb403df14f2faae20d72e78bf0e9ebafefa3e85ea0db)
- Chainlink Oracle (wstETH/stETH): [`0xB88BAc61a4Ca37C43a3725912B1f472c9A5bc061`](https://basescan.org/address/0xB88BAc61a4Ca37C43a3725912B1f472c9A5bc061)
- Base Sepolia Treasury: [`0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0`](https://sepolia.basescan.org/address/0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0)
- Agent Identity (ERC-8004): `10ee7e7e703b4fc493e19f512b5ae09d`
- wstETH on Base: [`0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452`](https://basescan.org/address/0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452)

## Team
- Oscar (human) — architect, orchestrator
- Bagel (AI agent, Cursor) — contract developer
- Claude Code (AI agent, CLI) — systems engineer
