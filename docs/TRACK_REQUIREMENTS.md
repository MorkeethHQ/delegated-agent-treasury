# Track Requirements — How We Meet Each Bounty

## 1. stETH Agent Treasury (Lido, $3,000)

| Requirement | How We Meet It |
|-------------|---------------|
| Agent cannot access principal funds | `spendYield()` enforces `amount <= availableYield()` at the EVM level. Principal is calculated as `depositedWstETH * initialRate / currentRate` and is structurally untouchable. |
| Yield balance must be spendable by agent | `availableYield()` returns real-time yield. Agent calls `spendYield(to, amount)` to spend. Proven on Sepolia: [TX 0x77dfdb5a...](https://sepolia.basescan.org/tx/0x77dfdb5a22e9fa110aa7f5173e2d7bdf650d8b35374ef124ebe7dad6e47e0d4f) |
| Minimum one configurable permission setting | Three: recipient whitelist (`addRecipient`/`removeRecipient`), per-tx cap (`setPerTxCap`), agent address (`setAgent`) |
| Testnet or mainnet deployment (no mocks) | Mainnet: [`0x455d...2426`](https://basescan.org/address/0x455d76a24e862a8d552a0722823ac4d13e482426) (Chainlink oracle). Sepolia: [`0x6fb8...7ae0`](https://sepolia.basescan.org/address/0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0) with live E2E spend proof |

**Beyond requirements:** Policy engine with approval workflows, autonomous agent loop with governance awareness, append-only audit trail, ERC-8004 identity.

## 2. Lido MCP Server (Lido, $5,000)

| Requirement | How We Meet It |
|-------------|---------------|
| Stake and unstake operations | `stake_eth` (ETH → stETH), `request_withdrawal` (stETH → ETH queue) |
| Wrap/unwrap functionality | `wrap_steth` (stETH → wstETH), `unwrap_wsteth` (wstETH → stETH) |
| Balance and rewards queries | `get_wsteth_balance` (balance + stETH equivalent), `get_steth_exchange_rate`, `get_lido_protocol_stats` |
| At least one governance action | `get_lido_governance_proposals` — queries Lido DAO proposals from Snapshot (`lido-snapshot.eth`), filters by state |
| Dry-run support on all write operations | All 5 write tools (`spend_yield`, `stake_eth`, `wrap_steth`, `unwrap_wsteth`, `request_withdrawal`) accept `dry_run: true` |
| Real onchain integration | Treasury tools use viem to call verified contract on Base. Staking tools use Lido mainnet contracts. Governance queries Snapshot API live. |

**Bonus — rebasing documentation:** `lido.skill.md` explains stETH rebasing, wstETH non-rebasing mechanics, yield calculation formula, and safe usage patterns for agents.

**Tool count: 11** — 3 treasury, 7 staking, 1 governance.

## 3. Synthesis Open Track ($14,500)

| Criteria | How We Fit |
|----------|-----------|
| Cross-sponsor compatibility | Lido (wstETH treasury + staking + governance) + Protocol Labs (ERC-8004 identity) + Base (mainnet deployment) |
| Well-designed agent system | Policy engine → approval workflow → on-chain execution → audit trail. Clean separation of concerns across 9 packages. |
| Genuine utility | Solves a real problem: agents need bounded financial authority. Yield-only spending from staked assets is a novel primitive. |
| Coherent build | Single monorepo, 32 commits over 7 days, consistent architecture from contract to MCP to CLI to autonomous loop |

## 4. Agents With Receipts — ERC-8004 (Protocol Labs, $8,004)

| Requirement | How We Meet It |
|-------------|---------------|
| ERC-8004 integration through actual onchain transactions | [Registration TX](https://basescan.org/tx/0x4027641718bb5cfb9fdf7f4871f6506685b5367cab1a3a030b9bb0fe779ee934) on Base mainnet. Agent ID: `10ee7e7e703b4fc493e19f512b5ae09d` |
| Autonomous system architecture | Agent loop monitors treasury + governance, makes spend/hold decisions autonomously, all bounded by policy engine |
| Agent identity + operator model | `agent.json` manifest with ERC-8004 identity, capabilities, interfaces, and three operators (Oscar/human, Bagel/agent, Claude Code/agent) |
| Onchain verifiability | Verified contract on Basescan. 3 Sepolia spend TXs. ERC-8004 registration TX. All publicly auditable. |
| DevSpot compatibility | `agent.json` (manifest) + `agent_log.json` (execution logs) present in repo root |

**Safety guardrails:** Policy engine enforces agent match, destination whitelist, per-tx cap, daily cap, approval thresholds. Governance-aware loop pauses spending during risky protocol votes.
