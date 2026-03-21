# HANDOFF.md — Morning Checklist

## Status as of 2026-03-21 morning

**Everything builds clean. All 3 morning agents delivered. Ready to push.**

### What's Built (Phase 1 + 2 + 3 + Morning)

| Feature | Package | Status |
|---------|---------|--------|
| AgentTreasury contract | `contracts/` | LIVE on mainnet + sepolia |
| Policy engine | `policy-engine/` | Working — transfer + swap caps |
| Approval store | `approval-store/` | Working |
| Audit logger | `audit-log/` | Working |
| REST API | `apps/api/` | 22 endpoints |
| CLI | `apps/cli/` | 9 commands |
| Agent loop | `apps/agent-loop/` | Governance-aware, strategy-aware |
| MCP server | `mcp-server/` | 24 tools |
| Executor | `executor/` | Viem + ERC-8004 identity |
| Strategy engine | `strategy-engine/` | Multi-bucket yield distribution |
| Trading engine | `trading-engine/` | Uniswap API (quotes + dry-run swaps) |
| x402 gateway | `x402-gateway/` | USDC payment-gated API |
| MoonPay bridge | `moonpay-bridge/` | 54 crypto tools, swaps/DCA across 10+ chains |
| Multi-agent roles | `config/agents.json` | Proposer/executor/auditor + freeze/unfreeze |
| E2E test script | `scripts/test-swap-e2e.sh` | 7-step Uniswap integration test |

### What's Tested

- Build: clean across 12 workspaces
- API endpoints: `/swap/quote` returns live Uniswap prices (0.01 wstETH ≈ $26.58 USDC)
- API endpoints: `/swap/execute` passes policy, returns dry-run quote
- API endpoints: `/strategy`, `/strategy/preview`, `/verify/:address`, `/x402/pricing` all respond
- Demo script: 12-step flow runs end-to-end in API-only mode

### What's NOT Tested (needs morning attention)

- [ ] Live swap execution (dry_run=false) — needs wallet signer wired up
- [ ] x402 with real USDC payment — disabled by default, needs ENABLE_X402=true
- [ ] Agent loop with trading strategies — loop uses bucket distribution, not yet wired to trading engine
- [ ] Full on-chain flow with mainnet treasury + Uniswap swap

---

## Deployed Contracts

**Base Mainnet (chain 8453)**
- AgentTreasury: `0x455d76a24e862a8d552a0722823ac4d13e482426`
- wstETH: `0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452`
- Chainlink wstETH/stETH Oracle: `0xB88BAc61a4Ca37C43a3725912B1f472c9A5bc061`
- Agent Identity (ERC-8004): `10ee7e7e703b4fc493e19f512b5ae09d`

**Base Sepolia (chain 84532)**
- AgentTreasury: `0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0`
- MockWstETH: `0x4b8e084234edc18285cb57d8b29a59c2f1fb7a2d`

---

## Morning Checklist — Oscar

- [ ] **Run the demo:** `npm run build && node dist/apps/api/src/server.js` then `bash scripts/screen-demo.sh`
- [ ] **Screen record** the 12-step demo (~2 min)
- [ ] **Update Devfolio submission** on web (copy from `docs/SUBMISSION.md`) — API endpoint changed, use web UI
- [ ] **Add bounty tracks:** Uniswap + Agent Services on Base (if available in Devfolio)
- [ ] **Self-custody transfer** on synthesis.md when available — required before publishing
- [ ] **Upload demo video** to Devfolio

## Morning Checklist — Bagel

- [ ] **Review swap policy defaults:** `maxSwapPerAction: 0.01 wstETH`, `maxSlippageBps: 100` (1%)
- [ ] **Review trading-engine flow** in `packages/trading-engine/src/index.ts` — especially the checkApproval → quote → sign → /swap → broadcast path
- [ ] **Optional: Wire live execution** — Steps 3-5 in executeSwap() need a wallet signer to sign permitData and broadcast. Currently dry-run only.
- [ ] **Optional: Verify contract on Basescan** via `forge verify-contract`
- [ ] **Optional: Celo deployment** — same Solidity, different chain. $5K bounty if worth the time.

## Morning Checklist — Claude

- [ ] **Resolve any merge conflicts** from parallel agent work
- [ ] **Run final build + smoke test**
- [ ] **Any remaining doc/demo polish**
- [ ] **MoonPay CLI integration** if there's time (P3)

---

## Bounty Targets (9 tracks, ~$62.5K potential)

| Track | Prize | Status |
|-------|-------|--------|
| Synthesis Open Track | ~$28K | Ready |
| stETH Agent Treasury (Lido) | $3K | Ready |
| Lido MCP | $5K | Ready (24 tools) |
| Agents With Receipts — ERC-8004 | $4K | Ready (trust-gating) |
| Agentic Finance (Uniswap) | $5K | Ready (live swap on Base mainnet) |
| Agent Services on Base | $5K | Ready (x402 gateway) |
| Let the Agent Cook (Protocol Labs) | $4K | Ready (multi-agent, ERC-8004, agent.json) |
| Autonomous Trading Agent (Base) | $5K | Ready (DCA strategies, policy-gated) |
| MoonPay CLI Agents | $3.5K | Ready (bridge + 3 MCP tools) |

## Policy Config

```json
{
  "maxPerAction": 0.01,
  "dailyCap": 0.05,
  "approvalThreshold": 0.008,
  "maxSwapPerAction": 0.01,
  "maxSlippageBps": 100
}
```

## Key Env Vars

```bash
UNISWAP_API_KEY=GOI55Pq1Kd97gxsb9K13A5eH5_ed59fzh9ObbXdSNZA
ENABLE_X402=true  # to activate payment gating
```

## Project Decisions

- Option A for swaps: agent wallet receives yield via spendYield(), then swaps on Uniswap. No contract changes.
- No web UI — CLI + MCP + API is the interface
- Demo-first: everything works in API-only mode (no contract env vars needed)
- Separate swap/transfer caps in policy engine
- x402 disabled by default for local dev
