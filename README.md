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
    "amount": 0.005,
    "destination": "0xf3476b36fc9942083049C04e9404516703369ef3",
    "reason": "Fund morke.eth from yield"
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

### Celo Mainnet (stablecoin yield via Aave)

| Contract | Address |
|----------|---------|
| AgentTreasuryCelo | [`0xc976e463bd209e09cb15a168a275890b872aa1f0`](https://celoscan.io/address/0xc976e463bd209e09cb15a168a275890b872aa1f0) |
| waCelUSDC (stataUSDC) | [`0xba3ae0F0A78579a5e8C4188dcde60DcCc0Dd4Fab`](https://celoscan.io/address/0xba3ae0F0A78579a5e8C4188dcde60DcCc0Dd4Fab) |
| Chain | Celo (42220) |
| Deploy TX | [`0x4a6058...`](https://celoscan.io/tx/0x4a6058ba5169e2db9dff908ed4bc5b2f8d96db70828244e84fde2e7de1095d12) |

Same yield-only spending pattern as Base, different yield source: USDC lending yield from Aave instead of ETH staking yield from Lido. Uses ERC-4626 `convertToAssets()` for the exchange rate instead of Chainlink oracle.

**Live E2E proof (March 21):** 100 CELO → USDC (Uniswap V3) → stataUSDC (Aave ERC-4626) → Treasury deposit → `spendYield()` executed by agent.
- Swap TX: [`0x0e1e99...`](https://celoscan.io/tx/0x0e1e99c29c5145c97076e11759ce6cb842c704e3908a59b09ced889c093b9cee)
- spendYield TX: [`0xaac5f8...`](https://celoscan.io/tx/0xaac5f84913c34c661739274a39c9911f618b9a474c80e737fa81ca5afc533df5)

```bash
export CHAIN=celo
export RPC_URL=https://forno.celo.org
export TREASURY_ADDRESS=0xc976e463bd209e09cb15a168a275890b872aa1f0
export WSTETH_ADDRESS=0xba3ae0F0A78579a5e8C4188dcde60DcCc0Dd4Fab
export AGENT_PRIVATE_KEY=0x...
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

## Live mainnet proof

Every major feature has been executed on-chain with real assets:

| Feature | Chain | Transaction | What it proves |
|---------|-------|-------------|---------------|
| Treasury deploy | Base | [`0x33e648...`](https://basescan.org/tx/0x33e648434ce963eb47ddfb403df14f2faae20d72e78bf0e9ebafefa3e85ea0db) | Contract live on mainnet |
| Uniswap swap | Base | [`0x9e3874...`](https://basescan.org/tx/0x9e387425cfddde0d2809d36a154b667ea37e8ea93a5943dda2c97416bc375ae9) | WETH→USDC via Trading API |
| Permit2 approve | Base | [`0x536b75...`](https://basescan.org/tx/0x536b75fd78f78106db68efcd3cdd7d162e8c6fe074e81dffa5841f8b888f462d) | Full EIP-712 Permit2 flow |
| ERC-8004 register | Base | [`0x402764...`](https://basescan.org/tx/0x4027641718bb5cfb9fdf7f4871f6506685b5367cab1a3a030b9bb0fe779ee934) | On-chain agent identity |
| Celo deploy | Celo | [`0x4a6058...`](https://celoscan.io/tx/0x4a6058ba5169e2db9dff908ed4bc5b2f8d96db70828244e84fde2e7de1095d12) | Multi-chain treasury |
| CELO→USDC swap | Celo | [`0x0e1e99...`](https://celoscan.io/tx/0x0e1e99c29c5145c97076e11759ce6cb842c704e3908a59b09ced889c093b9cee) | Uniswap V3 on Celo |
| USDC→stataUSDC | Celo | [`0x575789...`](https://celoscan.io/tx/0x575789f35d7e1ec6747ebd4cea357402f055aebd392894d471fb8d44d186f453) | Aave V3 ERC-4626 deposit |
| Treasury deposit | Celo | [`0x504326...`](https://celoscan.io/tx/0x504326d7bb5b8d47d7e674e0d8a484c1a88f5a7c86836f395eb2138ad47b6a8f) | stataUSDC into treasury |
| **spendYield** | Celo | [`0xaac5f8...`](https://celoscan.io/tx/0xaac5f84913c34c661739274a39c9911f618b9a474c80e737fa81ca5afc533df5) | **Agent spent yield on mainnet** |
| Sepolia E2E | Sepolia | [`0x77dfdb...`](https://sepolia.basescan.org/tx/0x77dfdb5a22e9fa110aa7f5173e2d7bdf650d8b35374ef124ebe7dad6e47e0d4f) | Full spend proof on testnet |
| **MetaMask EIP-7702 delegation (owner)** | Base | [`0x1a97c5...`](https://basescan.org/tx/0x1a97c54d3633f725e36d83b7c2535b054d296f868b20c0f1e0fbb076601e0f9c) | Owner EOA (`0x1101...70e`) delegated to EIP7702StatelessDeleGator v1.3.0 |
| **MetaMask EIP-7702 delegation (agent)** | Base | [`0x6f3a90...`](https://basescan.org/tx/0x6f3a90d43720f799e5830859476fcd1b2569eea4274c077617aa94206bca440e) | Agent EOA (`0x4fD6...ce6`) delegated to same DeleGator contract |

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

## API endpoints (34)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health + executor status |
| POST | `/plans/evaluate` | Submit action plan for policy evaluation |
| GET | `/approvals` | List approvals (filter: `?status=pending`) |
| GET | `/approvals/:id` | Get single approval |
| POST | `/approvals/:id/respond` | Approve or deny |
| GET | `/audit` | Full audit event stream |
| GET | `/policy` | Current policy config |
| GET | `/treasury` | On-chain treasury state (ENS-enriched) |
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
| GET | `/delegation` | MetaMask Delegation Framework info |
| POST | `/delegation/create` | Create delegation with policy-matched caveats |
| GET | `/ens/identities` | All ENS identities for treasury participants |
| GET | `/ens/resolve/:name` | Resolve ENS name ↔ address |
| GET | `/swap/strategies` | Configured trading strategies |
| GET | `/trading/performance` | PnL tracking — aggregated swap performance |
| GET | `/trading/strategies` | Trading strategies enriched with execution counts |

### Monitoring & Onboarding

| Method | Path | Description |
|--------|------|-------------|
| GET | `/monitoring/status` | System health dashboard (uptime, treasury, active alerts) |
| GET | `/monitoring/alerts` | Spend velocity, denial rate, frozen agent alerts |
| POST | `/monitoring/webhook` | Register webhook for event-driven alerts |
| GET | `/onboarding/status` | Agent self-discovery protocol (capabilities, boot sequence) |

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

## Integration depth

| Partner | What we built | Evidence |
|---------|---------------|----------|
| **Lido** | Yield-only treasury + 11 MCP staking tools + governance | `AgentTreasury.sol` + `packages/mcp-server/src/tools/staking.ts` |
| **Uniswap** | Full Trading API: quote → Permit2 → EIP-712 → swap | Live TX [`0x9e3874...`](https://basescan.org/tx/0x9e387425cfddde0d2809d36a154b667ea37e8ea93a5943dda2c97416bc375ae9) |
| **Protocol Labs** | ERC-8004 identity + trust-gated payments + autonomous loop | Agent `10ee7e7e703b4fc493e19f512b5ae09d` on Base |
| **Base** | Treasury + trading + x402 agent-as-a-service, all on Base mainnet | `packages/x402-gateway/` + live swaps |
| **MetaMask** | EIP-7702 smart accounts on Base mainnet via DeleGator + delegation caveats as onchain policy enforcement (ERC-7710) | Owner TX [`0x1a97c5...`](https://basescan.org/tx/0x1a97c54d3633f725e36d83b7c2535b054d296f868b20c0f1e0fbb076601e0f9c) · Agent TX [`0x6f3a90...`](https://basescan.org/tx/0x6f3a90d43720f799e5830859476fcd1b2569eea4274c077617aa94206bca440e) |
| **Celo** | Stablecoin yield treasury via Aave stataUSDC | [`0xc976e4...`](https://celoscan.io/address/0xc976e463bd209e09cb15a168a275890b872aa1f0) |
| **MoonPay** | 54-tool CLI bridge, 10+ chains, policy-gated | `packages/moonpay-bridge/` |
| **ENS** | Agent identity via subdomains — morke.eth → treasury, agents, deployers | `packages/executor/src/ens.ts` + `GET /ens/identities` |

## ENS Agent Identity

Every participant in the treasury has a human-readable ENS name under `morke.eth`:

| ENS Name | Address | Role |
|----------|---------|------|
| `morke.eth` | `0xf347...ef3` | Owner (human) |
| `bagel.morke.eth` | `0x4fD6...ce6` | Agent signer (Bagel) |
| `treasury.morke.eth` | `0x455d...426` | AgentTreasury contract (Base) |
| `bageldeployer.morke.eth` | `0x3d7d...b43` | Bagel deployer |
| `odawgagent.morke.eth` | `0x1101...70e` | Secondary agent wallet |

The API resolves ENS names anywhere an address is accepted, and enriches responses with ENS names:

```bash
# Resolve ENS name to address
curl http://localhost:3001/ens/resolve/bagel.morke.eth

# List all ENS identities
curl http://localhost:3001/ens/identities
```

## MetaMask Delegation Framework

Defense-in-depth: the policy engine enforces constraints offchain, and MetaMask Delegation caveats enforce them onchain. Even if the offchain layer is bypassed, the onchain caveats protect the treasury.

| Policy Rule | Delegation Caveat | Enforcement |
|-------------|-------------------|-------------|
| Recipient whitelist | AllowedTargetsEnforcer | Onchain |
| spendYield() only | AllowedMethodsEnforcer | Onchain |
| Yield ceiling | ERC20TransferAmountEnforcer | Onchain |
| Time-bounded access | TimestampEnforcer | Onchain |
| Call count limit | LimitedCallsEnforcer | Onchain |

```bash
# View delegation framework info
curl http://localhost:3001/delegation

# Create a delegation with caveats matching current policy
curl -X POST http://localhost:3001/delegation/create
```

SDK: `@metamask/smart-accounts-kit` | Standards: ERC-7710, ERC-7715

## Hackathon tracks

Built for the [Synthesis hackathon](https://synthesis.md/) — submissions across 11 partner tracks:

- **Lido** — stETH Agent Treasury ($3K) + Lido MCP Server ($5K)
- **Uniswap** — Agentic Finance via Trading API with live mainnet swaps
- **Protocol Labs** — ERC-8004 agent identity + autonomous multi-tool orchestration (2 tracks)
- **Base** — Agent Services with x402 micropayments + Autonomous Trading Agent (2 tracks)
- **MetaMask** — Delegation Framework caveats as onchain policy enforcement (ERC-7710)
- **Celo** — Stablecoin yield treasury via Aave stataUSDC
- **MoonPay** — 54-tool CLI bridge across 10+ chains
- **ENS** — Agent identity via ENS subdomains (morke.eth) — integrated across all endpoints
- **Synthesis Open Track** — cross-sponsor integration

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
