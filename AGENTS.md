# AGENTS.md — For Agentic Judges

## What this project does

Yieldbound gives autonomous agents bounded financial authority over productive on-chain capital. An agent can spend only the yield earned by locked principal — never the principal itself. This is enforced at the EVM level.

## Quick interface

**Base URL:** `http://localhost:3001` (start with `node --env-file=.env dist/apps/api/src/server.js`)

**Core endpoints:**

| Endpoint | What it does |
|----------|-------------|
| `GET /health` | Service status |
| `GET /treasury` | On-chain treasury state: principal, yield, spent, caps |
| `POST /plans/evaluate` | Submit a spending plan for policy evaluation |
| `GET /policy` | Current policy config (caps, thresholds, whitelist) |
| `GET /approvals?status=pending` | Pending human approvals |
| `POST /approvals/:id/respond` | Approve or deny a pending plan |
| `GET /audit` | Full append-only audit trail |
| `GET /agents` | List all agent roles (proposer, executor, auditor) |
| `POST /delegation/execute` | Execute spendYield through MetaMask delegation chain (ERC-7710) |
| `GET /delegation` | Full delegation chain info with execution status |
| `GET /onboarding/status` | Agent self-discovery: capabilities, readiness, boot sequence |

**Try it:**

```bash
# Check treasury state
curl -s http://localhost:3001/treasury | jq '.treasury.availableYield.formatted'

# Submit a spending plan
curl -X POST http://localhost:3001/plans/evaluate \
  -H 'content-type: application/json' \
  -d '{"planId":"test-1","agentId":"bagel","type":"transfer","amount":0.005,"destination":"0xf3476b36fc9942083049C04e9404516703369ef3","reason":"Test spend"}'

# Check what capabilities are available
curl -s http://localhost:3001/onboarding/status | jq '.capabilities'
```

## Architecture (5 layers)

1. **Treasury Primitive** — Lido wstETH on Base. Principal locked, yield spendable. Chainlink oracle for exchange rate.
2. **Control Layer** — Policy engine: per-tx caps, daily caps, recipient whitelist, approval thresholds. Three outcomes: approved, approval_required, denied.
3. **Trust Layer** — ERC-8004 on-chain identity. MetaMask Delegation caveats (ERC-7710). Multi-agent roles (proposer/executor/auditor) with freeze circuit breaker.
4. **Execution Layer** — Uniswap Trading API for yield deployment. MoonPay CLI as alternative backend. x402 for agent-to-agent payments.
5. **Portability** — Base mainnet (primary) + Celo mainnet (stataUSDC). Same model, different yield sources.

## MCP tools (25)

The MCP server at `packages/mcp-server/` exposes 25 tools for agent integration:

- `treasury_state`, `available_yield`, `spend_yield` — core treasury operations
- `evaluate_plan`, `list_approvals`, `respond_approval` — policy workflow
- `get_strategy`, `preview_distribution`, `distribute_yield` — yield strategy
- `swap_quote`, `swap_execute`, `swap_tokens` — Uniswap trading
- `verify_identity`, `list_agents`, `freeze_agent` — trust & governance
- `audit_events`, `monitoring_status`, `monitoring_alerts` — observability
- `moonpay_swap`, `moonpay_dca` — alternative execution

## On-chain contracts

| Contract | Chain | Address |
|----------|-------|---------|
| AgentTreasury | Base (8453) | `0x455d76a24e862a8d552a0722823ac4d13e482426` |
| AgentTreasuryCelo | Celo (42220) | `0xc976e463bd209e09cb15a168a275890b872aa1f0` |
| wstETH | Base | `0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452` |
| ERC-8004 Agent ID | Base | `10ee7e7e703b4fc493e19f512b5ae09d` |

## Delegation execution

The agent loop supports `USE_DELEGATION=true` env var to route all spendYield calls through the MetaMask Delegation Framework (ERC-7710) instead of direct contract calls. When enabled:
- Transactions flow through the delegation chain: Owner -> Proposer -> Executor
- Each link enforces progressively narrower caveats (AllowedTargets, AllowedMethods, ERC20TransferAmount, Timestamp, LimitedCalls)
- The auditor can freeze any agent, revoking its delegation on-chain via `disableDelegation()`
- Policy engine evaluation still runs before delegation redemption (defense-in-depth)

```bash
# Execute via delegation chain
curl -X POST http://localhost:3001/delegation/execute \
  -H 'content-type: application/json' \
  -d '{"to":"0xf3476b36fc9942083049C04e9404516703369ef3","amount":0.005,"delegationMode":true}'
```

## Key proofs

- 11 autonomous spendYield TXs on Base mainnet (zero human intervention)
- 27 total mainnet TXs across Base + Celo
- EIP-7702 MetaMask delegations live on Base
- Full E2E on Celo: CELO → USDC → stataUSDC → deposit → spendYield

## How this was built

1 human (Oscar) orchestrating 3 AI agents (Claude Code, Cursor, Anthropic). Zero lines of human-written code.
