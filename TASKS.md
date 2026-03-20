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

## Remaining

### Now — end-to-end verification
- [ ] Bagel configures treasury (mint, deposit, setAgent, addRecipient, setPerTxCap, simulateYield)
- [ ] Run full API → contract → execution test with live treasury
- [ ] Verify CLI demo command against live contracts

### Submission prep
- [ ] Register on synthesis.devfolio.co
- [ ] Prepare conversationLog (human-agent collaboration narrative)
- [ ] Select tracks: Lido stETH Treasury, Open Track, Base Agent Services
- [ ] ERC-8004 identity registration
- [ ] Submit before March 22

### Stretch — Lido MCP ($5K bounty)
- [ ] Evaluate: thin MCP wrapper on existing executor (~435 lines, ~8h)
- [ ] Only if additive, not a pivot
