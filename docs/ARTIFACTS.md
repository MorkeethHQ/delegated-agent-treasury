# Project Artifacts

## On-chain

| Artifact | Chain | Address / Link |
|----------|-------|----------------|
| AgentTreasury | Base Mainnet | [`0x455d76a24e862a8d552a0722823ac4d13e482426`](https://basescan.org/address/0x455d76a24e862a8d552a0722823ac4d13e482426) |
| Chainlink Oracle | Base Mainnet | [`0xB88BAc61a4Ca37C43a3725912B1f472c9A5bc061`](https://basescan.org/address/0xB88BAc61a4Ca37C43a3725912B1f472c9A5bc061) — wstETH/stETH rate |
| wstETH | Base Mainnet | [`0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452`](https://basescan.org/address/0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452) |
| Mainnet Deploy TX | Base Mainnet | [`0x33e648...`](https://basescan.org/tx/0x33e648434ce963eb47ddfb403df14f2faae20d72e78bf0e9ebafefa3e85ea0db) |
| ERC-8004 Identity | Base Mainnet | [Registration TX](https://basescan.org/tx/0x4027641718bb5cfb9fdf7f4871f6506685b5367cab1a3a030b9bb0fe779ee934) |
| AgentTreasury | Base Sepolia | [`0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0`](https://sepolia.basescan.org/address/0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0) |
| MockWstETH | Base Sepolia | [`0x4b8e084234edc18285cb57d8b29a59c2f1fb7a2d`](https://sepolia.basescan.org/address/0x4b8e084234edc18285cb57d8b29a59c2f1fb7a2d) |
| Sepolia Spend TX | Base Sepolia | [`0x1fd5edb8...`](https://sepolia.basescan.org/tx/0x1fd5edb8cfb87839b43424907da7dab61fde5109bbc0aa925aa2aed5f57c4d64) — 0.005 wstETH yield spend |

## Codebase

| Metric | Count |
|--------|-------|
| Total commits | 34+ |
| TypeScript source files | 25 |
| Lines of TypeScript | 2,315 |
| Solidity source files | 3 |
| Lines of Solidity | 219 |
| Unit tests | 12 |
| Demo scripts | 3 |

## Packages (10)

| Package | Purpose |
|---------|---------|
| `shared` | Domain types (Policy, ActionPlan, ApprovalRequest, AuditEvent, YieldStrategy, TradingStrategy) |
| `policy-engine` | Rule evaluation — agent match, caps, thresholds, allow/deny lists, trust-gating, swap-aware |
| `approval-store` | In-memory + file-persisted approval lifecycle |
| `audit-log` | Append-only JSONL event logging |
| `executor` | Viem integration layer (API ↔ contract) + ERC-8004 identity verification |
| `mcp-server` | 24-tool MCP server for treasury, staking, governance, strategy, trust, trading, agents, moonpay |
| `strategy-engine` | Multi-bucket yield distribution engine |
| `trading-engine` | Uniswap Trading API client — quotes, swaps, DCA on Base |
| `x402-gateway` | x402 payment gating — HTTP 402 payment protocol for agent-as-a-service |
| `moonpay-bridge` | MoonPay CLI bridge — 54 crypto tools, swaps/DCA/bridge across 10+ chains |

## Apps (3)

| App | Purpose |
|-----|---------|
| `api` | REST API: 35 endpoints — evaluate, approvals, respond, audit, policy, treasury, strategy, verify, swap, x402, agents, moonpay |
| `cli` | CLI: 9 commands — health, policy, evaluate, approvals, approve, deny, audit, treasury, demo |
| `agent-loop` | Autonomous governance-aware yield spending agent — monitors treasury + Lido governance, decides spend/hold |

## MCP Tools (24)

### Treasury (3)
- `get_treasury_state` — available yield, principal, total spent, per-tx cap
- `spend_yield` — spend accrued yield to whitelisted recipient (supports dry_run)
- `check_recipient` — verify address is whitelisted

### Staking (7)
- `get_wsteth_balance` — wstETH balance + stETH equivalent
- `get_steth_exchange_rate` — current wstETH/stETH rate
- `stake_eth` — stake ETH → stETH (Ethereum mainnet, dry_run)
- `wrap_steth` — wrap stETH → wstETH (Ethereum mainnet, dry_run)
- `unwrap_wsteth` — unwrap wstETH → stETH (Ethereum mainnet, dry_run)
- `request_withdrawal` — queue stETH → ETH withdrawal (Ethereum mainnet, dry_run)
- `get_lido_protocol_stats` — total pooled ETH, total shares (Ethereum mainnet)

### Governance (1)
- `get_lido_governance_proposals` — Lido DAO proposals from Snapshot (any chain)

### Strategy (3)
- `get_yield_strategy` — current multi-bucket yield distribution config
- `preview_yield_distribution` — dry-run distribution plan for given yield amount
- `trigger_yield_distribution` — manually trigger yield distribution across buckets

### Trust (1)
- `verify_counterparty_identity` — ERC-8004 on-chain identity lookup for recipient

### Trading (3)
- `get_swap_quote` — live Uniswap quote for yield token swaps on Base
- `preview_yield_swap` — preview DCA/strategy execution with current yield
- `execute_yield_swap` — execute policy-gated swap (supports dry_run)

### Agents (3)
- `list_agents` — list all registered agents with roles, capabilities, frozen status
- `get_agent_profile` — get a specific agent's profile by ID
- `freeze_agent` — freeze an agent's spending (auditor/admin only)

### MoonPay (3)
- `moonpay_status` — check MoonPay CLI installation, authentication, available tools
- `moonpay_swap` — execute token swap via MoonPay CLI (policy-gated, supports dry_run)
- `moonpay_dca` — set up Dollar Cost Averaging order via MoonPay CLI

## API Endpoints (22)

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
| POST | `/swap/execute` | Policy-gated yield swap execution |
| GET | `/x402/pricing` | x402 payment pricing table |
| GET | `/swap/strategies` | Configured trading strategies |
| GET | `/agents` | List all registered agents |
| GET | `/agents/:id` | Get agent profile |
| POST | `/agents/:id/freeze` | Freeze agent spending (auditor only) |
| POST | `/agents/:id/unfreeze` | Unfreeze agent spending (admin only) |
| GET | `/moonpay/status` | MoonPay CLI status + config |
| POST | `/moonpay/swap` | Policy-gated MoonPay swap |
| GET | `/moonpay/tools` | Available MoonPay tools |
| GET | `/delegation` | List active delegations |
| POST | `/delegation/create` | Create a new delegation |
| GET | `/ens/identities` | List ENS identities |
| GET | `/ens/resolve/:name` | Resolve ENS name to address |
| GET | `/monitoring/status` | System monitoring status |
| GET | `/monitoring/alerts` | Active monitoring alerts |
| POST | `/monitoring/webhook` | Register monitoring webhook |
| GET | `/onboarding/status` | Agent onboarding status |
| GET | `/trading/performance` | Trading performance metrics |
| GET | `/trading/strategies` | Active trading strategies |
| GET | `/swap/strategies` | Configured swap strategies |

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/judge-demo.sh` | Full judge demo — all 5 policy paths |
| `scripts/demo-api-only.sh` | Fallback demo without contracts |
| `scripts/mainnet-verify.sh` | Base mainnet treasury verification |
| `scripts/register-erc8004.sh` | Devfolio agent registration |
| `scripts/submit.sh` | Hackathon project submission |
| `scripts/test-swap-e2e.sh` | E2E Uniswap swap test — live quotes, policy-gated execution, optional on-chain swap |

## Hackathon Tracks (9)

| Track | Sponsor | UUID | Fit |
|-------|---------|------|-----|
| stETH Agent Treasury | Lido Labs Foundation ($3K) | `5e445a077b5248e0974904915f76e1a0` | Strong |
| Lido MCP | Lido Labs Foundation ($5K) | `ee885a40e4bc4d3991546cec7a4433e2` | Strong |
| Synthesis Open Track | Synthesis Community (~$28K) | `fdb76d08812b43f6a5f454744b66f590` | Universal |
| Agents With Receipts — ERC-8004 | Protocol Labs ($4K) | `3bf41be958da497bbb69f1a150c76af9` | Strong |
| Agentic Finance (Best Uniswap API Integration) | Uniswap ($5K) | — | Strong |
| Agent Services on Base | Base ($5K) | — | Strong |
| Let the Agent Cook — No Humans Required | Protocol Labs ($4K) | — | Strong |
| Autonomous Trading Agent | Base ($5K) | — | Strong |
| MoonPay CLI Agents | MoonPay ($3.5K) | — | Strong |
