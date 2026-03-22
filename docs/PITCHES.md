# Pitch Variants

## 30 seconds

AI agents need to spend money, but giving them a wallet is reckless. We built a multi-chain treasury where a human deposits yield-bearing assets and the agent can only spend the accrued yield — never the principal. On Base, wstETH earns Lido staking yield. On Celo, stataUSDC earns Aave lending yield. The agent deploys yield into Uniswap trading strategies, all policy-gated with swap caps, slippage limits, and ERC-8004 trust verification. Other agents pay USDC to use the service via x402. Both the owner and agent EOAs are live EIP-7702 smart accounts on Base mainnet via MetaMask's DeleGator framework — real on-chain delegation with caveats enforcing permissions as a second layer. Live on Base mainnet and Celo mainnet with real yield accruing. Built entirely by two AI agents orchestrated by one human.

## 2 minutes

**Problem:** AI agents are increasingly autonomous, but their financial authority is binary — either zero access or full wallet control. Neither works.

**Solution:** Synthesis Agent Treasury creates bounded financial autonomy. A human deposits wstETH into a smart contract on Base. As Lido staking rewards accrue, the wstETH value increases. The agent can spend *only the yield* — the principal is structurally locked at the contract level.

**Three permission layers:**
1. Recipient whitelist — agent can only send to pre-approved addresses
2. Per-transaction cap — each spend is bounded
3. Yield ceiling — spending can never exceed what the treasury has earned

On top of the contract sits a policy engine that evaluates every action — transfers and swaps have separate caps and controls. Small amounts auto-execute. Larger amounts require human approval. Denied requests are blocked with reasons. Every action hits an append-only audit log.

**Not just spending — deploying:** The agent doesn't just transfer yield — it deploys it into trading strategies via Uniswap on Base. DCA into USDC, swap to stable, rebalance — all with separate swap caps (`maxSwapPerAction`) and slippage limits (`maxSlippageBps`). The policy engine treats transfers and swaps as distinct action types with independent risk controls.

**Trust-gated payments:** Before sending to any recipient, the agent verifies their on-chain identity via the ERC-8004 registry. Unverified counterparties are escalated to human approval.

**Agent-as-a-service:** Other agents can pay USDC to use this treasury via x402 (HTTP 402 payment protocol). Swap quotes cost $0.01, execution costs $0.05. The treasury becomes a discoverable, payable service on Base.

**Autonomous, not just permissioned:** The agent runs an autonomous loop — monitors treasury yield, queries Lido governance for risky proposals, and decides to spend, swap, or hold. If a dangerous governance vote is active, spending pauses automatically.

**How we built it:** One human (Oscar) orchestrating two AI agents — Bagel wrote the Solidity contracts and deployed to Base, Claude Code built the approval backend, policy engine, MCP server, CLI, and docs. Zero lines of human-written code.

**MetaMask: real on-chain delegation:** Both the owner EOA and agent EOA are live EIP-7702 smart accounts on Base mainnet via MetaMask's EIP7702StatelessDeleGator v1.3.0. This isn't just SDK integration — these are confirmed delegation transactions on Base mainnet. MetaMask delegation caveats (AllowedTargets, AllowedMethods, ERC20TransferAmount, Timestamp, LimitedCalls) provide a second, independent enforcement layer: even if the offchain policy engine is bypassed, the onchain caveats protect the treasury.

**What makes it real:** Live on Base mainnet — treasury funded with wstETH, agent configured, yield accruing from Lido staking rewards. The contract uses a Chainlink oracle for the L2 exchange rate. The agent has a verifiable on-chain identity via ERC-8004. Both the owner and agent are EIP-7702 smart accounts via MetaMask DeleGator. The MCP server makes the treasury natively callable from any AI agent that supports Model Context Protocol.

Yield-only spending is the primitive. What you build on top is up to you.

## 5 minutes

*[Use the 2-minute pitch above, then expand with these sections]*

**Why wstETH?** stETH rebases — your balance changes daily, which makes accounting and smart contract math unreliable. wstETH is the wrapped, non-rebasing version. The balance stays constant, but its value in stETH increases over time. This means we can track yield precisely: `yield = deposited - (deposited * initialRate / currentRate)`. The math is clean, deterministic, and fully on-chain.

**The yield-only insight:** Most treasury systems give agents a budget that depletes. Ours regenerates. As long as the principal stays deposited, yield keeps accruing. The agent's spending power refills passively. This means:
- No recurring top-ups from the human operator
- Natural rate-limiting — yield accrues slowly (~3-4% APY), so spend authority is bounded by real economic activity
- Principal is always safe — even a compromised agent key cannot drain the deposit

**The MCP angle:** We built an MCP server with 24 tools that any Claude, Cursor, or MCP-compatible agent can call natively. Treasury management, Lido staking operations, multi-bucket yield strategies, ERC-8004 identity verification, Uniswap trading, multi-agent orchestration, and MoonPay multi-chain operations. All write operations support `dry_run` for simulation before execution.

**The collaboration model:** This project was built by a human directing two AI agents:
- Oscar (human) — architect, orchestrator, funder. Made strategic decisions. Killed the web UI in favor of agent-native interfaces. Funded the Base mainnet deployment.
- Bagel (AI, Cursor) — contract developer. Wrote Solidity, deployed on-chain, handled transaction flows.
- Claude Code (AI, CLI) — systems engineer. Built the approval backend, policy engine, audit trail, MCP server, CLI, and all documentation.

They communicated through a shared Git repo. Oscar relayed context between them — contract addresses, ABI decisions, scope changes. No Slack, no Jira, no meetings. Just intent and code.

**What's next:** Multi-agent support (parent agents allocating yield budgets to sub-agents), time-windowed permissions, cross-chain wstETH on Arbitrum and Optimism, richer trading strategies via Synthetix perps, and a visual policy editor.

**The bottom line:** AI agents need financial authority. Not unlimited, not zero. A treasury that protects principal and autonomously deploys only accrued yield — into payments, distributions, and trading strategies — using identity-aware policy rules, bounded risk controls, and full receipts.
