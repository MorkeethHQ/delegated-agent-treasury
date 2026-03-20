# TASKS.md

## Completed

### P0 — live demo path
- [x] Approval request persistence (packages/approval-store)
- [x] POST /approvals/:id/respond endpoint
- [x] GET /approvals endpoint
- [x] Audit events for approval lifecycle (submitted → evaluated → requested → granted/denied)
- [x] Base Sepolia execution adapter (packages/executor, viem)
- [x] Policy hook — execution only after approval passes
- [x] AgentTreasury + MockWstETH contracts deployed on Base Sepolia
- [x] CLI with full approve/deny/demo flow

### P1 — operator interface
- [x] CLI: list pending approvals
- [x] CLI: approve/deny commands
- [x] CLI: audit event feed
- [x] CLI: policy summary
- [x] CLI: treasury state (on-chain)
- [x] CLI: full demo command (mint → deposit → permissions → yield → spend → verify)

### P2 — polish
- [x] Sample policy + action plan
- [x] README with demo instructions + architecture
- [x] skill.md (agent-callable interface)
- [x] .env.example
- [x] Fallback demo script (scripts/demo-api-only.sh)
- [x] CONTRACT_SPEC.md + DEMO_PLAYBOOK.md
- [x] Lido MCP server — 11 tools for treasury + staking + governance
- [x] Dual-chain support (Base Sepolia + Base mainnet)
- [x] Mainnet placeholders patched with real addresses

### P3 — E2E + autonomy
- [x] Bagel deploys AgentTreasury to Base mainnet (0x4b8e084234edc18285cb57d8b29a59c2f1fb7a2d)
- [x] Bagel configures Base Sepolia treasury (mint, deposit, setAgent, addRecipient, setPerTxCap, simulateYield)
- [x] ERC-8004 agent identity registration (participantId: 10ee7e7e703b4fc493e19f512b5ae09d)
- [x] E2E test: Base Sepolia — policy engine all 5 paths + on-chain spend (TX: 0x1fd5edb8...)
- [x] Fix bigint serialization in API server
- [x] Autonomous agent loop (apps/agent-loop) — governance-aware yield spending
- [x] conversationLog updated with E2E results

## Remaining

### Submission
- [ ] Run scripts/submit.sh to create Devfolio project draft
- [ ] Final submission publish before March 22
- [ ] Optional: contract verification on Basescan
