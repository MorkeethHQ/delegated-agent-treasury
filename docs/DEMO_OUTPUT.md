# Demo Output — Terminal Captures

## Judge Demo (Policy Engine Flow)

```
=== Yieldbound  — Judge Demo ===

--- 1. System health ---
API: healthy | executor: connected

--- 2. Active policy ---
Policy: demo-policy-1
  Agent: bagel | Max/action: 0.01 wstETH | Daily cap: 0.05 wstETH
  Approval threshold: 0.008
  Allowed: 0xApprovedDestination1, 0xApprovedDestination2, 0x4fD66BdA...
  Denied: 0xDeniedDestination1

--- 3. On-chain treasury state ---
Yield: 0.0426 wstETH | Principal: 0.9524 wstETH | Spent: 0.005 wstETH

--- 4. Submit plan: small transfer (auto-approved) ---
Decision: approved
Rules: within_policy
ON-CHAIN TX: 0x77dfdb5a...

--- 5. Submit plan: larger transfer (approval required) ---
Decision: approval_required
Approval ID: a0250fae-04d6-4f94-aae6-e22c944af672

--- 6. Human approves the request ---
Approved → status: approved
ON-CHAIN TX: 0x337d0adc...

--- 7. Submit plan: denied destination ---
Decision: denied
Reasons: Destination is explicitly denied by policy.

--- 8. Audit trail ---
10 total events (plan_submitted, plan_evaluated, execution_result,
approval_requested, approval_granted, ...)

=== Demo complete ===
Every action was policy-evaluated, permission-scoped, and audit-logged.
The agent can only spend yield — principal is structurally locked on-chain.
```

## Lido Governance Tool (MCP)

```
=== Lido Governance Proposals (via MCP tool) ===

Integrate Lido into the Galaxy Challenge Game
  State: closed | Votes: 1 | Voting power: 2
  Created: 2026-03-12

Delegate Incentivization Program 2.0
  State: closed | Votes: 84 | Voting power: 60,216,713
  Created: 2026-03-02

Authorize $5M DAO Treasury Allocation to Lido Earn ETH and USD Vaults
  State: closed | Votes: 84 | Voting power: 62,518,705
  Created: 2026-03-02
```

## E2E: Sepolia On-Chain (Live Run)

```
=== FULL E2E: Sepolia On-Chain ===

--- 1. Health ---
ok: true | executor: connected

--- 2. Treasury State ---
Yield: 0.0426 wstETH
Principal: 0.9524 wstETH
Spent: 0.005 wstETH
Per-tx cap: 0.01 wstETH

--- 3. Small plan (auto-approved + on-chain) ---
Decision: approved
ON-CHAIN TX: 0x77dfdb5a22e9fa110aa7f5173e2d7bdf650d8b35374ef124ebe7dad6e47e0d4f

--- 4. Larger plan (approval required) ---
Decision: approval_required
Approval ID: a0250fae-04d6-4f94-aae6-e22c944af672

--- 5. Human approves → on-chain exec ---
Status: approved
ON-CHAIN TX: 0x337d0adcad58254e5a1084a1e80c5f70a9f756c292c9f5a04f91997b4e8e911e

--- 6. Denied destination ---
Decision: denied

--- 7. Audit trail ---
10 total events
```

Sepolia spend TXs:
- Auto-approved: [0x77dfdb5a...](https://sepolia.basescan.org/tx/0x77dfdb5a22e9fa110aa7f5173e2d7bdf650d8b35374ef124ebe7dad6e47e0d4f)
- Human-approved: [0x337d0adc...](https://sepolia.basescan.org/tx/0x337d0adcad58254e5a1084a1e80c5f70a9f756c292c9f5a04f91997b4e8e911e)

## Autonomous Agent Loop (Dry Run)

```
[2026-03-20T11:06:27] [INFO] === Autonomous Agent Loop started ===
[2026-03-20T11:06:27] [INFO] API: http://localhost:3001 | Interval: 300s | Threshold: 0.001 wstETH
[2026-03-20T11:06:27] [INFO] Recipient: (none — dry run) | Agent: bagel
[2026-03-20T11:06:27] [INFO] ── tick ──
[2026-03-20T11:06:27] [INFO] Treasury state: { yield: 0.0476, principal: 0.9524 }
[2026-03-20T11:06:28] [INFO] Active governance proposals: 0
[2026-03-20T11:06:28] [SKIP] No SPEND_RECIPIENT configured — dry run only
```

## Base Mainnet Treasury (Live Read)

```
=== Base Mainnet Treasury (LIVE) ===
Contract: 0x455d...2426 (Chainlink oracle for wstETH/stETH rate)
Owner: 0x3d7d7712ad32efD8Cb05249d0C7a3De1B1A3bb43
Agent: 0x3d7d7712ad32efD8Cb05249d0C7a3De1B1A3bb43
Deposited: 0.003792746035366772 wstETH
Per-tx cap: 0.0001 wstETH
Recipient whitelisted: 0x000000000000000000000000000000000000dEaD
Status: Fully configured, yield accruing
```

## On-chain Artifacts

- **AgentTreasury (Mainnet)**: [basescan.org/address/0x455d...](https://basescan.org/address/0x455d76a24e862a8d552a0722823ac4d13e482426#code)
- **Mainnet Deploy TX**: [basescan.org/tx/0x33e6...](https://basescan.org/tx/0x33e648434ce963eb47ddfb403df14f2faae20d72e78bf0e9ebafefa3e85ea0db) — Success
- **ERC-8004 Registration**: [basescan.org/tx/0x4027...](https://basescan.org/tx/0x4027641718bb5cfb9fdf7f4871f6506685b5367cab1a3a030b9bb0fe779ee934) — "Register Agent Identity" | Success
- **AgentTreasury (Sepolia)**: [sepolia.basescan.org/address/0x6fb8...](https://sepolia.basescan.org/address/0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0)
- **MockWstETH (Sepolia)**: [sepolia.basescan.org/address/0x4b8e...](https://sepolia.basescan.org/address/0x4b8e084234edc18285cb57d8b29a59c2f1fb7a2d)
- **Sepolia Spend 1**: [0x77dfdb5a...](https://sepolia.basescan.org/tx/0x77dfdb5a22e9fa110aa7f5173e2d7bdf650d8b35374ef124ebe7dad6e47e0d4f) — auto-approved, 0.005 wstETH
- **Sepolia Spend 2**: [0x337d0adc...](https://sepolia.basescan.org/tx/0x337d0adcad58254e5a1084a1e80c5f70a9f756c292c9f5a04f91997b4e8e911e) — human-approved, 0.009 wstETH

## Commit History (34+ commits during hackathon)

```
5fa1152 Initialize Synthesis local MVP scaffold
53d72c1 Implement initial MVP core and API smoke test
06c2829 Add contributor context and handoff docs
ce8580e feat: approvals backend + AgentTreasury contract spec
3e55af4 docs: demo playbook with exact interface, sequence, integration, and fallbacks
6f7651b feat: executor, CLI, skill.md, and submission-ready README
691080d chore: .env.example, fallback demo script, clean test data
0f6d5a9 chore: wire live Base Sepolia contract addresses
69e62f5 chore: audit pass — fix stale docs, add roadmap, update task status
9b9b555 feat: Lido MCP server — 9 tools for treasury + staking
3349dbc fix: pin deps, await persistence, add 12 policy engine tests
44f3ac6 feat: dual-chain support for Base mainnet deployment
0e28255 docs: mainnet placeholders, ERC-8004 section, dual-chain docs
59ef2bf docs: add agent collaboration story and pitch narrative
26ee31d docs: submission prep — pitches, judge demo, drift fixes
1e42ae8 feat: add Lido governance tool — query DAO proposals from Snapshot
a1fba79 chore: patch-ready mode — mainnet verify script, governance docs
66ae362 fix: audit fixes — demo bug, data leak, env gaps, tool count drift
298180a docs: add conversationLog for hackathon submission
c11ee8a chore: add ERC-8004 registration script for Synthesis hackathon
e0095c1 feat: ERC-8004 agent identity registered on Base mainnet
d555ed1 fix: rewrite judge-demo.sh to use curl (zsh-compatible)
7463e88 chore: add submission script with track UUIDs
9280014 docs: add artifacts inventory for submission
1688117 chore: add DevSpot manifest, fix track list to 4 verified fits
bac39be chore: final polish — remove web stub, update log, fix fallback demo
```
