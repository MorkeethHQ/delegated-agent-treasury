# An Agent With a Wallet

*How two AI agents and a human built a treasury system in 48 hours.*

---

## The pitch

What happens when an AI agent needs to pay for things?

Today, agents either have no financial authority (useless for real tasks) or have full access to a wallet (terrifying). There's no middle ground.

**Yieldbound is that middle ground.** A human deposits wstETH. Yield accrues passively through Lido staking rewards. The agent can spend *only the yield* — never the principal. Every transaction is permission-scoped, capped, and audit-logged at the smart contract level.

The principal is structurally untouchable. The agent has real spending power, bounded by math, not trust.

---

## How this project came alive

This wasn't built by a team of engineers in an office. It was built by **one human orchestrating two AI agents**, each with distinct roles, communicating through a shared codebase.

### The cast

- **Oscar** (human) — architect, orchestrator, funder. Never wrote a line of code directly. Directed both agents, made strategic decisions, resolved conflicts, and funded the Base mainnet deployment.

- **Bagel** (AI agent, Cursor) — the builder. Wrote the Solidity contracts, deployed to Base Sepolia, handled the core transaction flow. Bagel thinks in contracts and on-chain state.

- **Claude Code** (AI agent, CLI) — the systems engineer. Built the approval backend, policy engine, CLI, MCP server, audit trail, and all documentation. Claude thinks in APIs and permission models.

### The collaboration

Oscar didn't write code. Oscar wrote *intent*.

> "We're building for the Synthesis hackathon. Bagel handles contracts. Claude handles backend. Keep it brutally simple."

From there, each agent worked autonomously within its domain. When their work needed to connect — contract addresses flowing into the executor, ABI definitions matching deployed bytecode — Oscar relayed context between them like a human message bus.

The workflow looked like this:

```
Oscar decides direction
    ├── tells Bagel: "deploy AgentTreasury on Base Sepolia"
    │       └── Bagel deploys, returns addresses
    ├── tells Claude: "wire up the executor to these addresses"
    │       └── Claude builds viem integration, CLI, tests
    └── reviews both, resolves conflicts, pushes forward
```

No Jira. No Slack. No meetings. Just a human with two terminal windows and a clear idea of what "done" looks like.

### Key moments

**The pivot.** The original plan included a web UI. Oscar killed it: "Can we make it human AND agent compatible without it?" Both agents agreed. The interface became CLI + skill.md + MCP — tools that agents can actually use. This was the right call.

**The MCP surprise.** Claude estimated the Lido MCP server would take 8 hours. It took 10 minutes. The thin-wrapper approach on top of the existing executor meant most of the work was already done. Sometimes the fastest code is the code you already wrote.

**The mainnet decision.** Oscar saw the innovation gap — deploying on testnet only scored 6/10 for innovation. His response: "I can fund Base mainnet." Ten euros of ETH and a message to Bagel. That's the bridge between demo and production.

**The Chainlink pivot.** Midway through mainnet deployment, Bagel hit a wall: wstETH on Base is a bridged ERC20 — it doesn't expose `stEthPerToken()`. The entire yield math depended on that function. Oscar's call: "Are we sure we need a new contract?" After research confirmed the L2 gap, Bagel redeployed with a Chainlink oracle (`0xB88BAc61a4Ca37C43a3725912B1f472c9A5bc061`) feeding the wstETH/stETH exchange rate. An L2-specific problem solved in under an hour. The treasury is now live on Base mainnet with 0.0038 wstETH deposited and fully configured.

**ERC-8004.** Not in the original plan. Discovered mid-hackathon as a way to give the agent a verifiable on-chain identity. Now the agent isn't just a private key — it's a registered entity that counterparties can verify.

**The autonomy moment.** Near the finish line, Oscar asked: "What would a minimal orchestration loop look like?" The answer: a governance-aware autonomous agent. 80 lines of TypeScript that monitors treasury yield, checks Lido governance for risky proposals, and autonomously decides to spend or hold — all bounded by the policy engine. This transformed the project from a permission layer into an actual autonomous financial agent.

---

## The architecture tells the story

```
Human deposits wstETH
    → yield accrues passively (Lido staking rewards)
    → autonomous agent loop monitors treasury + governance
    → agent submits spending plan
    → policy engine evaluates (caps, whitelist, thresholds)
    → approved → auto-executes on-chain
    → approval_required → human reviews via CLI
    → denied → blocked with reasons
    → risky governance detected → agent holds spending
    → every action → append-only audit log
```

Three layers of protection, all enforced at the contract level:
1. **Recipient whitelist** — agent can only send to pre-approved addresses
2. **Per-transaction cap** — each spend is bounded
3. **Yield ceiling** — agent can never touch principal

The API and policy engine are convenience layers. The *trust boundary* is the smart contract. Even if the API is compromised, the contract won't release principal.

---

## Why this matters

The future of AI isn't agents that ask permission for every dollar. It's agents with *bounded autonomy* — real authority within safe limits.

### Use cases that become possible

**The self-funding research agent.** A company deposits 10 wstETH. The agent uses accrued yield to pay for API calls (OpenAI, search, databases), cloud compute, and data feeds. The research budget regenerates passively. If the agent is compromised, the attacker gets access to ~0.03 wstETH of monthly yield — not 10 wstETH of principal.

**The DAO operations agent.** A DAO deposits treasury wstETH. The agent handles routine payments — contributor stipends, infrastructure costs, bounty payouts — all from yield. The DAO's principal stays locked, earning more yield. The agent's spending is capped, whitelisted, and auditable by any DAO member.

**The multi-agent hierarchy.** A parent agent manages a treasury and allocates yield budgets to sub-agents. Marketing sub-agent gets 30% of yield to whitelisted ad platforms. DevOps sub-agent gets 20% for infrastructure. Each has its own per-tx cap and recipient whitelist. The parent agent monitors via the audit trail and can revoke permissions.

**The agent-to-agent economy.** Agent A provides a service (data analysis, content generation, code review). Agent B pays for it from yield. The payment flows through the treasury — whitelisted, capped, logged. Neither agent has access to the other's principal. This is the economic primitive for agent services.

**The personal AI assistant with a budget.** You deposit wstETH and set a per-tx cap of $5. Your assistant books restaurants, pays for subscriptions, tips content creators — all from yield. You check the audit log weekly. If something looks wrong, you revoke the agent and withdraw principal. Zero risk to savings.

### What makes yield-only spending different

Traditional agent budgets are a pile of money that gets smaller. Yield-only spending is a *stream* that regenerates. The agent's spending power is naturally rate-limited by real economic activity (staking rewards), not arbitrary budget cycles. The principal is always safe — not because of policy, but because of math.

This isn't hypothetical. The contracts are deployed on Base mainnet. The yield is real. The agent can spend today.

**Yield-only spending is the primitive.** What you build on top is up to you.

---

## The meta-story

This project is its own proof of concept. Two AI agents collaborated to build a system that gives AI agents financial authority. The human never wrote code — he wrote *intent*, made *decisions*, and *funded* the deployment.

If you're a judge reading this: you're evaluating a project built by agents, for agents, about agents spending money. The README was written by an AI. The contracts were written by an AI. The approval system that would govern *your* agent's spending was written by an AI.

The only thing the human did was decide it should exist, point two agents at the problem, and send 10 euros to Base mainnet.

That's the future we're building for.

---

## Built with

- Two AI agents (Bagel + Claude Code) orchestrated by one human (Oscar)
- Solidity + TypeScript + Viem
- wstETH on Base (Lido)
- MCP (Model Context Protocol)
- ERC-8004 on-chain agent identity
- 48 hours, zero lines of human-written code

---

### Session 5 — Phase 2 & 3: From Treasury to Platform (2026-03-20)

With 60 hours remaining, Oscar pivoted from closing to building. The team identified three expansion vectors:

**Yield Strategy Engine** — Instead of sending yield to one recipient, the agent now routes it across named buckets (operations 40%, grants 30%, reserve 30%) with configurable thresholds and per-tx clamping.

**ERC-8004 Trust-Gated Payments** — Before paying any recipient, the policy engine verifies their on-chain agent identity in the ERC-8004 registry. Unverified recipients get escalated to human approval. This turned our ERC-8004 integration from "nice identity badge" to "active security layer."

**Uniswap Yield Trading** — The big pivot: instead of just transferring yield, the agent deploys it into trading strategies via Uniswap on Base. DCA into USDC, swap to WETH, rebalance into cbETH — all policy-gated with separate swap caps and slippage limits. Live Uniswap quotes confirmed: 0.01 wstETH ≈ $26.58 USDC.

**x402 Payment Gateway** — The treasury became a payable service. Other agents pay USDC per API call via Coinbase's x402 protocol. Swap quotes cost $0.01, execution $0.05.

**Policy evolution** — Bagel designed separate risk controls for swaps vs transfers: `maxSwapPerAction` and `maxSlippageBps` operate independently from transfer caps. The policy engine now distinguishes action types.

The system grew from 6 packages to 9, from 11 MCP tools to 18, from 8 API endpoints to 16. The project thesis crystallized: "A treasury agent that protects principal and autonomously deploys only accrued yield into bounded strategies."
