# Yieldbound — Agent Treasury

**This project gives agents bounded financial authority over productive on-chain capital.**

Live on Base mainnet. An agent deposits into a yield-bearing position, accrues yield over time, and spends only the yield. Principal is structurally locked at the contract level. Every action passes through a policy engine and is logged to an append-only audit trail.

```
┌──────────────────────────────────────────────────┐
│                  Treasury State                  │
├──────────────┬───────────┬───────┬───────────────┤
│  Principal   │ Avail.    │ Spent │  Remaining    │
│  (locked)    │ Yield     │       │  Yield        │
│  1.000 wstETH│ 0.032     │ 0.010 │  0.022        │
│  untouchable │ spendable │ used  │  still usable │
└──────────────┴───────────┴───────┴───────────────┘
```

---

## 1. Treasury Primitive

The base economic primitive is a yield-bearing deposit. Human deposits wstETH (Lido) into the treasury contract. As staking rewards accrue, the wstETH exchange rate rises. The contract records the rate at deposit time and computes available yield as the delta:

```
yield = depositedWstETH - (depositedWstETH * initialRate / currentRate)
available = yield - totalSpent
```

The agent can spend up to `available`. It can never touch principal. This is enforced at the Solidity level, not by policy alone.

On Celo, the same primitive uses stablecoin lending yield (USDC via Aave stataUSDC) instead of ETH staking yield. Different yield source, identical spending constraint.

## 2. Control Layer

Every agent action passes through a policy engine that returns one of three outcomes:

```
Agent submits action plan → policy engine evaluates
                            ↓
        ┌─────────────────────────────────────┐
        │ approved        → auto-execute       │
        │ approval_required → human reviews    │
        │ denied          → blocked + logged   │
        └─────────────────────────────────────┘
```

**Spending caps** — per-transaction limits and daily aggregate limits. No single action can drain available yield.

**Recipient whitelists** — the agent can only send to pre-approved addresses. Everything else is denied.

**Multi-agent roles** — three roles (proposer, executor, auditor) with distinct capabilities:

| Role | Capabilities | Example |
|------|-------------|---------|
| **Proposer** | Submit plans, monitor treasury, execute strategies | Autonomous yield agent |
| **Executor** | Sign transactions, execute approved plans | On-chain signer |
| **Auditor** | Read all activity, flag anomalies, freeze agents | Compliance watchdog |

**Freeze circuit breaker** — the auditor can freeze any agent instantly. Frozen agents have all plans denied until an admin unfreezes them.

## 3. Trust Layer

**ERC-8004 identity** — the agent is registered on-chain via [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004). Identity gates trust: before sending to any recipient, the policy engine verifies their on-chain agent identity. Unverified counterparties escalate to human approval. Agent ID: `10ee7e7e703b4fc493e19f512b5ae09d` on Base mainnet.

**MetaMask Delegations** — offchain policy becomes onchain caveats. The policy engine enforces constraints offchain; MetaMask Delegation caveats (ERC-7710) enforce the same constraints onchain. Even if the offchain layer is bypassed, onchain caveats protect the treasury.

| Policy Rule | Delegation Caveat | Enforcement |
|-------------|-------------------|-------------|
| Recipient whitelist | AllowedTargetsEnforcer | Onchain |
| spendYield() only | AllowedMethodsEnforcer | Onchain |
| Yield ceiling | ERC20TransferAmountEnforcer | Onchain |
| Time-bounded access | TimestampEnforcer | Onchain |
| Call count limit | LimitedCallsEnforcer | Onchain |

**Audit trail** — append-only JSONL log. Every action, approval, denial, and freeze event is recorded with timestamps. Nothing is mutable.

## 4. Execution Layer

**Uniswap** — policy-gated yield deployment. The agent swaps yield into target tokens on Base via Uniswap Trading API. Supports DCA, swap-to-stable, and rebalance strategies. Every swap passes through the policy engine. Same chain as treasury, no bridging required.

**x402** — agent-to-agent commercial layer. Other agents pay to access this treasury's financial capabilities via x402 micropayments. The treasury becomes a service, not just a wallet.

**MoonPay** — alternative execution backend. 54 crypto tools across 10+ chains via [MoonPay CLI](https://www.npmjs.com/package/@moonpay/cli): multi-chain swaps, DCA, bridges, fiat on/off ramps. Every action is policy-gated through the same engine.

## 5. Portability Layer

**Base** is the primary live home. Treasury contract, Uniswap swaps, ERC-8004 identity, MetaMask delegations, and x402 payments all run on Base mainnet.

**Celo** proves the design is chain-agnostic. Same yield-only spending pattern, different yield source: USDC lending yield from Aave instead of ETH staking yield from Lido. Uses ERC-4626 `convertToAssets()` for the exchange rate instead of Chainlink oracle.

Live E2E proof on Celo (March 21): 100 CELO → USDC (Uniswap V3) → stataUSDC (Aave) → Treasury deposit → `spendYield()` executed by agent.

---

## Live deployments

### Base Mainnet

| Contract | Address |
|----------|---------|
| AgentTreasury | [`0x455d76a24e862a8d552a0722823ac4d13e482426`](https://basescan.org/address/0x455d76a24e862a8d552a0722823ac4d13e482426) |
| wstETH | [`0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452`](https://basescan.org/address/0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452) |
| Chain | Base (8453) |
| Agent Identity (ERC-8004) | `10ee7e7e703b4fc493e19f512b5ae09d` |

### Celo Mainnet

| Contract | Address |
|----------|---------|
| AgentTreasuryCelo | [`0xc976e463bd209e09cb15a168a275890b872aa1f0`](https://celoscan.io/address/0xc976e463bd209e09cb15a168a275890b872aa1f0) |
| waCelUSDC (stataUSDC) | [`0xba3ae0F0A78579a5e8C4188dcde60DcCc0Dd4Fab`](https://celoscan.io/address/0xba3ae0F0A78579a5e8C4188dcde60DcCc0Dd4Fab) |
| Chain | Celo (42220) |

### Base Sepolia (testnet demo)

| Contract | Address |
|----------|---------|
| AgentTreasury | [`0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0`](https://sepolia.basescan.org/address/0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0) |
| MockWstETH | [`0x4b8e084234edc18285cb57d8b29a59c2f1fb7a2d`](https://sepolia.basescan.org/address/0x4b8e084234edc18285cb57d8b29a59c2f1fb7a2d) |
| Chain | Base Sepolia (84532) |

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
| **MetaMask delegation (owner)** | Base | [`0x1a97c5...`](https://basescan.org/tx/0x1a97c54d3633f725e36d83b7c2535b054d296f868b20c0f1e0fbb076601e0f9c) | Owner EOA delegated to DeleGator v1.3.0 |
| **MetaMask delegation (agent)** | Base | [`0x6f3a90...`](https://basescan.org/tx/0x6f3a90d43720f799e5830859476fcd1b2569eea4274c077617aa94206bca440e) | Agent EOA delegated to DeleGator |
| **MoonPay USDC transfer** | Base | [`0x82c733...`](https://basescan.org/tx/0x82c733d5acbcbbe441e3118ecfc3a45e5ac78544ca42a522e27f9d00ce46a96c) | 0.10 USDC → morke.eth via MoonPay CLI |
| addRecipient | Base | [`0xbc213e...`](https://basescan.org/tx/0xbc213e0f341b74b28e95d15c3c165bd8e6ae1719d101f2f5bcf6033eff5aceaa) | Owner whitelisted morke.eth as recipient on Base mainnet |
| **_AUTONOMOUS spendYield #1_** | **_Base_** | **_[`0x13bf6f...`](https://basescan.org/tx/0x13bf6fdca6796982ab201eeac4c35594402819e2bd47aff25fb28cd992893515)_** | **_Agent loop autonomously spent ~0.0000001237 wstETH yield. No human intervention._** |
| **_AUTONOMOUS spendYield #2_** | **_Base_** | **_[`0x185feb...`](https://basescan.org/tx/0x185feb8ebc692e98a4ed12d95bfc86ba5fdc66dab8e00ed424ea2a4ce55940f2)_** | **_Second autonomous cycle — ~0.0000000618 wstETH._** |
| **_AUTONOMOUS spendYield #3_** | **_Base_** | **_[`0x7ce7c5...`](https://basescan.org/tx/0x7ce7c5866dccbcb9e74a95af10ee85e86fbc503bfd610781fc19fc82cce2083c)_** | **_Third cycle — ~0.0000000114 wstETH. Continuous autonomy._** |

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
  policy-engine/            — Rule evaluation (caps, thresholds, allow/deny lists)
  approval-store/           — In-memory + file-persisted approval lifecycle
  audit-log/                — Append-only JSONL event logging
  executor/                 — Viem integration (API ↔ contract) + ERC-8004 identity
  mcp-server/               — MCP server: tools for treasury, staking, strategy, trust, trading
  strategy-engine/          — Multi-bucket yield distribution engine
  trading-engine/           — Uniswap Trading API client (quotes, swaps, DCA)
  moonpay-bridge/           — MoonPay CLI bridge: multi-chain swaps, DCA, bridges, fiat ramps
  x402-gateway/             — x402 payment gating for agent-as-a-service
```

## Quick start

```bash
npm install && npm run build

# Start API
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
node dist/apps/cli/src/cli.js approvals pending
node dist/apps/cli/src/cli.js approve <approval-id> operator-name
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
| GET | `/treasury` | On-chain treasury state (ENS-enriched) |
| GET | `/strategy` | Current yield strategy config |
| GET | `/strategy/preview` | Dry-run yield distribution preview |
| POST | `/strategy/distribute` | Trigger manual yield distribution |
| GET | `/verify/:address` | ERC-8004 identity verification |
| GET | `/swap/tokens` | Supported tokens on Base |
| GET | `/swap/quote` | Live Uniswap swap quote |
| POST | `/swap/execute` | Execute yield swap (policy-gated) |
| GET | `/moonpay/status` | MoonPay CLI connection status |
| POST | `/moonpay/swap` | Execute swap via MoonPay CLI (policy-gated) |
| GET | `/moonpay/tools` | List available MoonPay tools |
| GET | `/x402/pricing` | x402 payment pricing table + stats |
| GET | `/x402/receipts` | Verified x402 payment receipts |
| GET | `/agents` | List all registered agents with roles |
| GET | `/agents/:id` | Get agent profile |
| POST | `/agents/:id/freeze` | Auditor: freeze agent spending |
| POST | `/agents/:id/unfreeze` | Admin: unfreeze agent spending |
| GET | `/delegation` | MetaMask Delegation Framework info |
| POST | `/delegation/create` | Create delegation with policy-matched caveats |
| GET | `/ens/identities` | All ENS identities for treasury participants |
| GET | `/ens/resolve/:name` | Resolve ENS name to address |
| GET | `/swap/strategies` | Configured trading strategies |
| GET | `/trading/performance` | PnL tracking — aggregated swap performance |
| GET | `/trading/strategies` | Trading strategies with execution counts |
| GET | `/monitoring/status` | System health dashboard |
| GET | `/monitoring/alerts` | Spend velocity, denial rate, frozen agent alerts |
| POST | `/monitoring/webhook` | Register webhook for event-driven alerts |
| GET | `/onboarding/status` | Agent self-discovery protocol |

## For agents

See [`skill.md`](skill.md) for the agent-callable interface.

## Built with

TypeScript, Node.js, Viem, Solidity (Foundry), Base, Celo, Lido wstETH, Aave stataUSDC, Uniswap Trading API, MoonPay CLI, MetaMask Delegation Framework, ERC-8004, MCP, x402, ENS.
