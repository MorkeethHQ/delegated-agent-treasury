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
- [x] Lido MCP server — 9 tools for treasury + staking
- [x] Dual-chain support (Base Sepolia + Base mainnet)
- [x] Mainnet placeholders in all docs

## Remaining

### Waiting on Bagel/Oscar
- [x] Bagel deploys AgentTreasury to Base mainnet → patched (0x4b8e084234edc18285cb57d8b29a59c2f1fb7a2d)
- [ ] Bagel configures Base Sepolia treasury (mint, deposit, setAgent, addRecipient, setPerTxCap, simulateYield)
- [x] ERC-8004 agent identity registration → patched (participantId: 10ee7e7e703b4fc493e19f512b5ae09d)

### Ready to run immediately
- [ ] E2E test: Base Sepolia (API → contract → execution)
- [ ] E2E test: Base mainnet (treasury state read, spend yield)
- [ ] Verify CLI demo command against live contracts

### Submission prep
- [ ] Register on synthesis.devfolio.co
- [ ] Prepare conversationLog (human-agent collaboration narrative)
- [ ] Select tracks: Lido stETH Treasury, Lido MCP, Open Track, Base Agent Services
- [ ] Submit before March 22
