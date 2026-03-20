# An Agent With a Wallet

*How two AI agents and a human built a treasury system in 48 hours.*

---

## The pitch

What happens when an AI agent needs to pay for things?

Today, agents either have no financial authority (useless for real tasks) or have full access to a wallet (terrifying). There's no middle ground.

**Synthesis Agent Treasury is that middle ground.** A human deposits wstETH. Yield accrues passively through Lido staking rewards. The agent can spend *only the yield* — never the principal. Every transaction is permission-scoped, capped, and audit-logged at the smart contract level.

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

**ERC-8004.** Not in the original plan. Discovered mid-hackathon as a way to give the agent a verifiable on-chain identity. Now the agent isn't just a private key — it's a registered entity that counterparties can verify.

---

## The architecture tells the story

```
Human deposits wstETH
    → yield accrues passively (Lido staking rewards)
    → agent submits spending plan
    → policy engine evaluates (caps, whitelist, thresholds)
    → approved → auto-executes on-chain
    → approval_required → human reviews via CLI
    → denied → blocked with reasons
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

- A marketing agent that can spend up to $50/day on approved platforms from yield, without touching the campaign budget
- A DevOps agent that pays for cloud resources from treasury yield, capped per transaction
- A trading agent with yield-funded operations that can never drain the principal

This isn't hypothetical. The contracts are deployed. The yield is real. The agent can spend today.

**Yield-only spending is the primitive.** What you build on top is up to you.

---

## Built with

- Two AI agents (Bagel + Claude Code) orchestrated by one human (Oscar)
- Solidity + TypeScript + Viem
- wstETH on Base (Lido)
- MCP (Model Context Protocol)
- ERC-8004 on-chain agent identity
- 48 hours, zero lines of human-written code
