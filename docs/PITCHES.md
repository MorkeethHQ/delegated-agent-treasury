# Pitch Variants

## 30 seconds

AI agents are getting wallets. That's the wrong abstraction. Agents don't need wallets. They need bounded authority.

We built a treasury where productive capital — Lido wstETH — earns yield, and agents can spend only what the capital earns. Principal is structurally locked at the EVM level. Three onchain controls cap every transaction. MetaMask Delegation caveats enforce the same limits as a second layer. ERC-8004 identity gates trust decisions before payment. Other agents pay USDC to access this financial service via x402.

Live on Base mainnet and Celo mainnet. Real yield accruing. Real transactions executed.

## 2 minutes

**Problem:** Agent financial authority today is binary — zero access or full wallet control. Both fail. Zero access means agents can't act. Full access means a single bug drains everything.

**The primitive:** A treasury that holds productive capital and gives agents authority over only the yield it generates. That's it. Everything else is enforcement and execution built on top.

Five layers make this work:

1. **Treasury Primitive** — Lido wstETH sits in a smart contract on Base, earning staking yield. The agent's entire spending power comes from what this capital produces. The treasury regenerates passively. No recurring top-ups from the human operator.

2. **Control Layer** — Yield ceiling, per-tx cap, recipient whitelist. Transfers and swaps have independent risk controls. A multi-role system (proposer/executor/auditor) enforces separation of duties. The auditor can freeze spending.

3. **Trust Layer** — Identity is used for decisioning, not just registration. ERC-8004 verification happens per-transaction. Offchain policy becomes onchain caveats via MetaMask Delegation — AllowedTargets, AllowedMethods, ERC20TransferAmount, Timestamp, LimitedCalls. Even if the policy engine is bypassed, the caveats hold.

4. **Execution Layer** — Uniswap for policy-gated yield deployment. x402 so other agents pay USDC to access this financial service. MoonPay as an alternative backend proving the control layer is execution-agnostic.

5. **Portability Layer** — Same primitive on Celo with stablecoin-native yield (stataUSDC). Different chain, different asset, same bounded authority.

**What makes it real:** Treasury funded with wstETH on Base mainnet. Chainlink oracle live. Agent has executed Uniswap swaps, spendYield transfers, and x402-gated requests. Both owner and agent EOAs are confirmed EIP-7702 smart accounts via MetaMask DeleGator. All onchain, all verifiable.

## 5 minutes

*Start with the 2-minute pitch above, then continue:*

**Why this matters now.** Every agent framework is converging on the same question: how does the agent pay for things? The default answer — give it a hot wallet with funds — is a liability. One prompt injection, one logic bug, and the balance is gone. There's no structural protection, just hope.

We took a different approach. Instead of funding an agent, we funded a position. Lido wstETH earns staking yield at ~3-4% APY. The smart contract tracks the exchange rate at deposit time and computes available yield deterministically: `yield = deposited - (deposited * initialRate / currentRate)`. The agent can spend up to that amount. The principal cannot move. This is not an allowance that depletes — it's a budget that regenerates from real economic activity.

**Why wstETH specifically.** stETH rebases — balances change daily, which breaks smart contract math. wstETH wraps it into a non-rebasing token where the balance stays constant but value increases. Clean accounting. On Base L2, bridged wstETH doesn't expose native rate functions, so the contract reads a Chainlink oracle. This is a solved problem, not a workaround.

**The control stack in practice.** A policy engine sits between the agent and the contract. Every action is classified — transfer or swap — and evaluated against its own set of caps. A transfer might have a 0.01 wstETH per-tx limit. A swap might allow 0.05 WETH with 50bps max slippage. These are independent controls. The multi-bucket strategy engine can route yield across operations, grants, and reserves with percentage-based allocation.

Three agent roles enforce separation: the proposer plans, the executor signs, the auditor watches. The auditor can freeze any agent at any time. This isn't role-based access control on a dashboard — it's structural separation enforced at the API level.

**Trust decisions at transaction time.** The ERC-8004 registry on Base stores verifiable agent identities. Before every payment, the policy engine checks: is this recipient registered? What's their verification status? Unverified recipients trigger human escalation. This means trust is re-evaluated continuously, not granted once at onboarding.

**Onchain caveats as defense in depth.** Both the owner and agent EOAs are live EIP-7702 smart accounts on Base mainnet via MetaMask's DeleGator framework. The delegation carries caveats — AllowedTargets restricts which contracts the agent can call, ERC20TransferAmount caps token movement, Timestamp bounds validity, LimitedCalls caps total invocations. These caveats mirror the offchain policy but enforce independently. If someone bypasses the API, the chain still says no.

**The commercial layer.** x402 turns this treasury into a payable service. Another agent sends an HTTP request, gets a 402 response with a USDC payment requirement, pays it, and receives the financial service — a swap quote, a trade execution. Other agents pay USDC to access this financial capability. This is agent-to-agent commerce with real money, not a demo.

**Portability proof.** The same treasury contract deploys on Celo with stataUSDC (Aave-wrapped stablecoin) as the yield source instead of wstETH. The agent has executed real spendYield and Uniswap transactions on Celo mainnet. Same control layer, same policy engine. The primitive is not chain-specific or asset-specific.

**How it was built.** One human orchestrating two AI agents. Oscar made architectural decisions — kill the web UI, go agent-native, fund the mainnet deployment. Bagel (Cursor) wrote Solidity and deployed contracts. Claude Code built the 10-package TypeScript system. They coordinated through a shared Git repo. No meetings, no tickets. Intent and code.

**Evidence:** Treasury contract live on Base mainnet. Uniswap swap executed onchain. Permit2 approval confirmed. x402 gateway serving priced endpoints. ERC-8004 identity registered. MetaMask EIP-7702 delegations confirmed for both EOAs. Celo treasury deployed with yield spent. MoonPay transfer executed. All transaction hashes in the submission links.

**The bottom line.** This project gives agents bounded financial authority over productive on-chain capital. Not unlimited access. Not zero access. Structural limits enforced by math, policy, identity, and onchain caveats — with proof that it works across chains, assets, and execution backends.
