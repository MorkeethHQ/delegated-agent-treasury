# Synthesis Agent Treasury

Yield-only spending for AI agents. Human deposits wstETH, agent spends only accrued yield. Principal is structurally locked. Every action is permission-scoped and audit-logged.

Built for the [Synthesis hackathon](https://synthesis.md/) — **Agents that Pay** track.

## How it works

```
Human deposits wstETH → yield accrues via staking rewards
                         ↓
Autonomous agent loop → monitors treasury + governance
                         ↓
Agent submits action plan → policy engine evaluates
                            ↓
        ┌─────────────────────────────────────┐
        │ approved        → auto-execute       │
        │ approval_required → human reviews    │
        │ denied          → blocked + logged   │
        └─────────────────────────────────────┘
                            ↓
            All actions → append-only audit trail
```

**Three permission enforcements** at the contract level:
1. Recipient whitelist — agent can only send to pre-approved addresses
2. Per-transaction cap — each spend is bounded
3. Yield ceiling — agent can never touch principal

**Yield Strategy Engine** — multi-bucket distribution. Configure named buckets (ops, grants, reserve) with percentages. The agent distributes yield across buckets automatically, with per-tx cap clamping and threshold gating.

**ERC-8004 Trust-Gated Payments** — before sending to a recipient, the policy engine verifies their on-chain agent identity via the ERC-8004 registry. Unverified recipients are escalated to human approval.

**Uniswap Yield Trading** — the agent can swap yield into any token on Base via Uniswap. Supports DCA, swap-to-stable, and rebalance strategies. Every swap goes through the policy engine. Live quotes from Uniswap Trading API, same chain as treasury — no bridging.

**MoonPay CLI Integration** — alternative execution backend via [MoonPay CLI](https://www.npmjs.com/package/@moonpay/cli), providing 54 crypto tools across 10+ chains. Supports multi-chain swaps, DCA, bridges, portfolio management, and fiat on/off ramps. MoonPay runs as a separate MCP server (`mp mcp`), and our bridge wraps every action through the policy engine. Install: `npm i -g @moonpay/cli && mp login && mp mcp`.

## Quick start

```bash
# Install + build
npm install && npm run build

# Start API (runs without contract env vars in API-only mode)
node dist/apps/api/src/server.js

# CLI
node dist/apps/cli/src/cli.js help
```

### Submit a plan

```bash
curl -X POST http://localhost:3001/plans/evaluate \
  -H 'content-type: application/json' \
  -d '{
    "planId": "plan-1",
    "agentId": "bagel",
    "type": "transfer",
    "amount": 80,
    "destination": "0xApprovedDestination1",
    "reason": "Fund approved workflow"
  }'
```

### Approve a pending request

```bash
# List pending
node dist/apps/cli/src/cli.js approvals pending

# Approve
node dist/apps/cli/src/cli.js approve <approval-id> operator-name
```

### Check treasury state (requires deployed contract)

```bash
node dist/apps/cli/src/cli.js treasury
```

## Live deployments

### Base Mainnet (production)

| Contract | Address |
|----------|---------|
| AgentTreasury | [`0x455d76a24e862a8d552a0722823ac4d13e482426`](https://basescan.org/address/0x455d76a24e862a8d552a0722823ac4d13e482426) |
| wstETH | [`0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452`](https://basescan.org/address/0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452) |
| Chain | Base (8453) |
| Agent Identity (ERC-8004) | `10ee7e7e703b4fc493e19f512b5ae09d` |

```bash
export CHAIN=base
export RPC_URL=https://mainnet.base.org
export TREASURY_ADDRESS=0x455d76a24e862a8d552a0722823ac4d13e482426
export WSTETH_ADDRESS=0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452
export AGENT_PRIVATE_KEY=0x...
```

### Base Sepolia (demo with instant yield)

| Contract | Address |
|----------|---------|
| AgentTreasury | [`0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0`](https://sepolia.basescan.org/address/0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0) |
| MockWstETH | [`0x4b8e084234edc18285cb57d8b29a59c2f1fb7a2d`](https://sepolia.basescan.org/address/0x4b8e084234edc18285cb57d8b29a59c2f1fb7a2d) |
| Chain | Base Sepolia (84532) |
| Deployer | `0x3d7d7712ad32efD8Cb05249d0C7a3De1B1A3bb43` |

```bash
export CHAIN=base-sepolia
export RPC_URL=https://sepolia.base.org
export TREASURY_ADDRESS=0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0
export WSTETH_ADDRESS=0x4b8e084234edc18285cb57d8b29a59c2f1fb7a2d
export AGENT_PRIVATE_KEY=0x...
export OWNER_PRIVATE_KEY=0x...   # for setup/demo only
```

### Run the demo

```bash
node dist/apps/cli/src/cli.js demo
```

This will: mint mock wstETH → deposit → set permissions → simulate yield → agent spends from yield → verify principal untouched.

### Judge scripts

```bash
# Full 14-step live demo (start API first, then run in another terminal)
npm run build && node --env-file=.env dist/apps/api/src/server.js
bash scripts/screen-demo.sh

# Storytelling demo for screen recording (same API server)
bash scripts/record-demo.sh

# E2E Uniswap integration test (dry-run or live with LIVE_SWAP=true)
bash scripts/test-swap-e2e.sh

# Unit tests
npm run build && npm test
```

## Architecture

```
contracts/
  src/AgentTreasury.sol     — wstETH treasury, yield-only spending, permission enforcement
  src/MockWstETH.sol        — testnet mock with simulateYield() for demo
  src/IWstETH.sol           — interface matching real wstETH

apps/
  api/                      — REST API: evaluate, approvals, audit, treasury state
  cli/                      — CLI: approve, deny, treasury, audit, demo
  agent-loop/               — Autonomous governance-aware yield spending agent

packages/
  shared/                   — Domain types (Policy, ActionPlan, ApprovalRequest, AuditEvent)
  policy-engine/            — Rule evaluation (agent match, caps, thresholds, allow/deny lists)
  approval-store/           — In-memory + file-persisted approval lifecycle
  audit-log/                — Append-only JSONL event logging
  executor/                 — Viem integration layer (API ↔ contract) + ERC-8004 identity verification
  mcp-server/               — MCP server: 24 tools for treasury, staking, strategy, trust, trading, MoonPay
  strategy-engine/          — Multi-bucket yield distribution engine
  trading-engine/           — Uniswap Trading API client (quotes, swaps, DCA)
  moonpay-bridge/           — MoonPay CLI bridge: 54 crypto tools via MCP (swaps, DCA, bridges, fiat on/off ramp)
  x402-gateway/             — x402 payment gating for agent-as-a-service
```

## Multi-agent architecture

The treasury supports three agent roles:

| Role | Capabilities | Example |
|------|-------------|---------|
| **Proposer** | Submit plans, monitor treasury, execute strategies | Autonomous yield agent |
| **Executor** | Sign transactions, execute approved plans | On-chain signer |
| **Auditor** | Read all activity, flag anomalies, freeze agents | Compliance watchdog |

Agents are registered in `config/agents.json`. The auditor can freeze any agent's spending — frozen agents have all plans denied until unfrozen by an admin.

## API endpoints (23)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health + executor status |
| POST | `/plans/evaluate` | Submit action plan for policy evaluation |
| GET | `/approvals` | List approvals (filter: `?status=pending`) |
| GET | `/approvals/:id` | Get single approval |
| POST | `/approvals/:id/respond` | Approve or deny |
| GET | `/audit` | Full audit event stream |
| GET | `/policy` | Current policy config |
| GET | `/treasury` | On-chain treasury state |
| GET | `/strategy` | Current yield strategy config |
| GET | `/strategy/preview` | Dry-run yield distribution preview |
| POST | `/strategy/distribute` | Trigger manual yield distribution |
| GET | `/verify/:address` | ERC-8004 identity verification |
| GET | `/swap/tokens` | Supported tokens on Base |
| GET | `/swap/quote` | Live Uniswap swap quote |
| POST | `/swap/execute` | Execute yield swap (policy-gated, dry_run) |
| GET | `/moonpay/status` | MoonPay CLI connection status and config |
| POST | `/moonpay/swap` | Execute swap via MoonPay CLI (policy-gated) |
| GET | `/moonpay/tools` | List available MoonPay tools |
| GET | `/x402/pricing` | x402 payment pricing table |
| GET | `/agents` | List all registered agents with roles |
| GET | `/agents/:id` | Get agent profile |
| POST | `/agents/:id/freeze` | Auditor: freeze agent spending |
| POST | `/agents/:id/unfreeze` | Admin: unfreeze agent spending |

## Smart contract

**AgentTreasury** on Base (Sepolia for demo, production-ready for mainnet).

Yield math: wstETH is non-rebasing — its value in stETH increases as staking rewards accrue. The contract records the exchange rate at deposit time, calculates accrued yield as the rate increases, and enforces that agent spending never exceeds the yield portion.

```
yield = depositedWstETH - (depositedWstETH * initialRate / currentRate)
available = yield - totalSpent
```

wstETH on Base mainnet: `0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452`

## For agents

See [`skill.md`](skill.md) for the agent-callable interface.

## Agent identity (ERC-8004)

The treasury agent is registered on Base mainnet via [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004), providing on-chain verifiable identity for the AI agent managing this treasury.

- **Agent ID**: `10ee7e7e703b4fc493e19f512b5ae09d`
- **Registry**: Base mainnet
- **Linked wallet**: Agent signing key (same as `AGENT_PRIVATE_KEY`)

This ties the agent's on-chain spending authority to a discoverable, verifiable identity — judges and counterparties can verify who (or what) is spending from the treasury.

## Bounty track alignment

| Track | Feature | Evidence |
|-------|---------|----------|
| stETH Agent Treasury (Lido, $3K) | Yield-only spending, principal locked | `AgentTreasury.sol`: `require(amount <= availableYield())` |
| Lido MCP (Lido, $5K) | 11 staking/governance tools, dry_run | `packages/mcp-server/src/tools/staking.ts` + `governance.ts` |
| Synthesis Open (~$28K) | Cross-sponsor system | Lido + Protocol Labs + Base + Uniswap in one project |
| ERC-8004 (Protocol Labs, $4K) | On-chain identity + trust-gated payments | Agent `10ee7e7e703b4fc493e19f512b5ae09d` on Base mainnet |
| Agentic Finance (Uniswap, $5K) | Uniswap Trading API + live swap | TX [`0x9e3874...`](https://basescan.org/tx/0x9e387425cfddde0d2809d36a154b667ea37e8ea93a5943dda2c97416bc375ae9) |
| Agent Services on Base ($5K) | x402 USDC payment-gated API | `packages/x402-gateway/` + `/x402/pricing` |
| Let the Agent Cook (PL, $4K) | Autonomous loop + multi-agent + governance | `apps/agent-loop/` monitors yield + governance |
| Autonomous Trading (Base, $5K) | Multi-strategy yield trading | `config/sample-trading-strategies.json` + live swap |
| MoonPay CLI ($3.5K) | 54-tool bridge, 10+ chains | `packages/moonpay-bridge/` |

## Hackathon tracks (9)

- **stETH Agent Treasury** (Lido Labs Foundation, $3K) — yield-only spending from wstETH with permission controls
- **Lido MCP** (Lido Labs Foundation, $5K) — 24 MCP tools for treasury, staking, governance, trading
- **Synthesis Open Track** (Synthesis Community, ~$28K) — community-funded prize pool
- **Agents With Receipts — ERC-8004** (Protocol Labs, $4K) — ERC-8004 identity, agent.json, on-chain verifiability
- **Agentic Finance** (Uniswap, $5K) — yield-to-swap via Uniswap Trading API on Base
- **Agent Services on Base** (Base, $5K) — agent treasury as a payable service via x402
- **Let the Agent Cook** (Protocol Labs, $4K) — multi-agent orchestration, safety guardrails, autonomous operation
- **Autonomous Trading Agent** (Base, $5K) — DCA + yield trading strategies on Base
- **MoonPay CLI Agents** (MoonPay, $3.5K) — 54 crypto tools, multi-chain swaps/DCA/bridges

## Roadmap

**Current (hackathon):** Multi-chain treasury — Base mainnet (wstETH yield) + Base Sepolia (demo) + Celo (stablecoin yield via Aave stataUSDC).

**Post-hackathon:**
- Multi-agent support — parent agents allocate yield budgets to sub-agents
- Time-windowed permissions (spending windows, cooldown periods)
- Policy authoring UI — visual editor for permission rules
- Cross-chain support — wstETH on Arbitrum, Optimism, Polygon

## Built with

- TypeScript, Node.js, Viem
- Solidity (Foundry)
- Base (mainnet + Sepolia)
- wstETH (Lido)
- MCP (Model Context Protocol)
- ERC-8004 (on-chain agent identity)
- Claude Code + Bagel (human-agent collaboration)
