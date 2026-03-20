# Synthesis Agent Treasury

Yield-only spending for AI agents. Human deposits wstETH, agent spends only accrued yield. Principal is structurally locked. Every action is permission-scoped and audit-logged.

Built for the [Synthesis hackathon](https://synthesis.md/) — **Agents that Pay** track.

## How it works

```
Human deposits wstETH → yield accrues via staking rewards
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

## Live deployment (Base Sepolia)

| Contract | Address |
|----------|---------|
| AgentTreasury | [`0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0`](https://sepolia.basescan.org/address/0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0) |
| MockWstETH | [`0x4b8e084234edc18285cb57d8b29a59c2f1fb7a2d`](https://sepolia.basescan.org/address/0x4b8e084234edc18285cb57d8b29a59c2f1fb7a2d) |
| Chain | Base Sepolia (84532) |
| Deployer | `0x3d7d7712ad32efD8Cb05249d0C7a3De1B1A3bb43` |

Connect to the live treasury:

```bash
export TREASURY_ADDRESS=0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0
export WSTETH_ADDRESS=0x4b8e084234edc18285cb57d8b29a59c2f1fb7a2d
export BASE_SEPOLIA_RPC=https://sepolia.base.org
export AGENT_PRIVATE_KEY=0x...
export OWNER_PRIVATE_KEY=0x...   # for setup/demo only
```

Then run the full demo:

```bash
node dist/apps/cli/src/cli.js demo
```

This will: mint mock wstETH → deposit → set permissions → simulate yield → agent spends from yield → verify principal untouched.

## Architecture

```
contracts/
  src/AgentTreasury.sol     — wstETH treasury, yield-only spending, permission enforcement
  src/MockWstETH.sol        — testnet mock with simulateYield() for demo
  src/IWstETH.sol           — interface matching real wstETH

apps/
  api/                      — REST API: evaluate, approvals, audit, treasury state
  cli/                      — CLI: approve, deny, treasury, audit, demo

packages/
  shared/                   — Domain types (Policy, ActionPlan, ApprovalRequest, AuditEvent)
  policy-engine/            — Rule evaluation (agent match, caps, thresholds, allow/deny lists)
  approval-store/           — In-memory + file-persisted approval lifecycle
  audit-log/                — Append-only JSONL event logging
  executor/                 — Viem integration layer (API ↔ contract)
```

## API endpoints

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

## Hackathon tracks

- **stETH Agent Treasury** (Lido) — yield-only spending from wstETH with permission controls
- **Agents that Pay** (bond.credit) — transparent payment authority for agent transactions
- **Agent Services on Base** (Base) — discoverable agent services on Base
- **Synthesis Open Track** — community-funded prize pool

## Roadmap

**Current (hackathon):** Single-agent treasury on Base Sepolia with mock wstETH yield.

**Post-hackathon:**
- Deploy to Base mainnet with real wstETH (`0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452`)
- Multi-agent support — parent agents allocate yield budgets to sub-agents
- Time-windowed permissions (spending windows, cooldown periods)
- MCP server — make the treasury natively callable from Claude, Cursor, etc.
- Policy authoring UI — visual editor for permission rules
- Cross-chain support — wstETH on Arbitrum, Optimism, Polygon

## Built with

- TypeScript, Node.js, Viem
- Solidity (Foundry)
- Base Sepolia
- wstETH (Lido)
- Claude Code + Bagel (human-agent collaboration)
