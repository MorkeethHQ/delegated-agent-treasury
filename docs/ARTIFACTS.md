# Project Artifacts

## On-chain

| Artifact | Chain | Address / Link |
|----------|-------|----------------|
| AgentTreasury | Base Mainnet | `0x4b8e084234edc18285cb57d8b29a59c2f1fb7a2d` |
| wstETH | Base Mainnet | [`0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452`](https://basescan.org/address/0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452) |
| ERC-8004 Identity | Base Mainnet | [Registration TX](https://basescan.org/tx/0x4027641718bb5cfb9fdf7f4871f6506685b5367cab1a3a030b9bb0fe779ee934) |
| AgentTreasury | Base Sepolia | [`0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0`](https://sepolia.basescan.org/address/0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0) |
| MockWstETH | Base Sepolia | [`0x4b8e084234edc18285cb57d8b29a59c2f1fb7a2d`](https://sepolia.basescan.org/address/0x4b8e084234edc18285cb57d8b29a59c2f1fb7a2d) |

## Codebase

| Metric | Count |
|--------|-------|
| Total commits | 23 |
| TypeScript source files | 18 |
| Lines of TypeScript | 2,127 |
| Solidity source files | 3 |
| Lines of Solidity | 219 |
| Unit tests | 12 |
| Demo scripts | 3 |

## Packages (6)

| Package | Purpose |
|---------|---------|
| `shared` | Domain types (Policy, ActionPlan, ApprovalRequest, AuditEvent) |
| `policy-engine` | Rule evaluation — agent match, caps, thresholds, allow/deny lists |
| `approval-store` | In-memory + file-persisted approval lifecycle |
| `audit-log` | Append-only JSONL event logging |
| `executor` | Viem integration layer (API ↔ contract) |
| `mcp-server` | 11-tool MCP server for treasury, Lido staking, governance |

## Apps (2)

| App | Purpose |
|-----|---------|
| `api` | REST API: 8 endpoints — evaluate, approvals, respond, audit, policy, treasury |
| `cli` | CLI: 9 commands — health, policy, evaluate, approvals, approve, deny, audit, treasury, demo |

## MCP Tools (11)

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

## API Endpoints (8)

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

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/judge-demo.sh` | Full judge demo — all 5 policy paths |
| `scripts/demo-api-only.sh` | Fallback demo without contracts |
| `scripts/mainnet-verify.sh` | Base mainnet treasury verification |
| `scripts/register-erc8004.sh` | Devfolio agent registration |
| `scripts/submit.sh` | Hackathon project submission |

## Hackathon Tracks (4)

| Track | Sponsor | UUID | Fit |
|-------|---------|------|-----|
| stETH Agent Treasury | Lido | `5e445a077b5248e0974904915f76e1a0` | Strong |
| Lido MCP | Lido | `ee885a40e4bc4d3991546cec7a4433e2` | Strong |
| Synthesis Open Track | Community | `fdb76d08812b43f6a5f454744b66f590` | Universal |
| Agents With Receipts — ERC-8004 | Protocol Labs | `3bf41be958da497bbb69f1a150c76af9` | Partial |
