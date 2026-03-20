# Pitch Variants

## 30 seconds

AI agents need to spend money, but giving them a wallet is reckless. We built a treasury where a human deposits wstETH, yield accrues through Lido staking, and the agent can only spend the yield — never the principal. The agent runs autonomously — it monitors governance, detects risky proposals, and decides to spend or hold — all bounded by three on-chain enforcements: recipient whitelist, per-tx cap, yield ceiling. Deployed on Base mainnet with real wstETH. Built entirely by two AI agents orchestrated by one human.

## 2 minutes

**Problem:** AI agents are increasingly autonomous, but their financial authority is binary — either zero access or full wallet control. Neither works.

**Solution:** Synthesis Agent Treasury creates bounded financial autonomy. A human deposits wstETH into a smart contract on Base. As Lido staking rewards accrue, the wstETH value increases. The agent can spend *only the yield* — the principal is structurally locked at the contract level.

**Three permission layers:**
1. Recipient whitelist — agent can only send to pre-approved addresses
2. Per-transaction cap — each spend is bounded
3. Yield ceiling — spending can never exceed what the treasury has earned

On top of the contract sits a policy engine that evaluates every spending plan. Small amounts auto-execute. Larger amounts require human approval. Denied requests are blocked with reasons. Every action hits an append-only audit log.

**Autonomous, not just permissioned:** The agent doesn't just wait for instructions — it runs an autonomous loop that monitors treasury yield, queries Lido governance for risky proposals (protocol upgrades, parameter changes), and decides to spend or hold. If a dangerous governance vote is active, the agent pauses spending automatically. All decisions flow through the policy engine.

**How we built it:** One human (Oscar) orchestrating two AI agents — Bagel wrote the Solidity contracts and deployed to Base, Claude Code built the approval backend, policy engine, MCP server, CLI, and docs. Zero lines of human-written code.

**What makes it real:** Deployed on Base mainnet with real wstETH. The agent has a verifiable on-chain identity via ERC-8004. The MCP server makes the treasury natively callable from any AI agent that supports Model Context Protocol.

Yield-only spending is the primitive. What you build on top is up to you.

## 5 minutes

*[Use the 2-minute pitch above, then expand with these sections]*

**Why wstETH?** stETH rebases — your balance changes daily, which makes accounting and smart contract math unreliable. wstETH is the wrapped, non-rebasing version. The balance stays constant, but its value in stETH increases over time. This means we can track yield precisely: `yield = deposited - (deposited * initialRate / currentRate)`. The math is clean, deterministic, and fully on-chain.

**The yield-only insight:** Most treasury systems give agents a budget that depletes. Ours regenerates. As long as the principal stays deposited, yield keeps accruing. The agent's spending power refills passively. This means:
- No recurring top-ups from the human operator
- Natural rate-limiting — yield accrues slowly (~3-4% APY), so spend authority is bounded by real economic activity
- Principal is always safe — even a compromised agent key cannot drain the deposit

**The MCP angle:** We didn't just build an API — we built an MCP server with 11 tools that any Claude, Cursor, or MCP-compatible agent can call natively. `get_treasury_state`, `spend_yield`, `check_recipient` for the treasury. Plus full Lido staking operations: `stake_eth`, `wrap_steth`, `unwrap_wsteth`, `request_withdrawal`, balance and rate queries. All write operations support `dry_run` for simulation before execution.

**The collaboration model:** This project was built by a human directing two AI agents:
- Oscar (human) — architect, orchestrator, funder. Made strategic decisions. Killed the web UI in favor of agent-native interfaces. Funded the Base mainnet deployment.
- Bagel (AI, Cursor) — contract developer. Wrote Solidity, deployed on-chain, handled transaction flows.
- Claude Code (AI, CLI) — systems engineer. Built the approval backend, policy engine, audit trail, MCP server, CLI, and all documentation.

They communicated through a shared Git repo. Oscar relayed context between them — contract addresses, ABI decisions, scope changes. No Slack, no Jira, no meetings. Just intent and code.

**What's next:** Multi-agent support (parent agents allocating yield budgets to sub-agents), time-windowed permissions, cross-chain wstETH on Arbitrum and Optimism, and a visual policy editor.

**The bottom line:** AI agents need financial authority. Not unlimited, not zero. Yield-only spending from staked assets is the right primitive — bounded by math, enforced on-chain, transparent by default.
