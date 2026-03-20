# HANDOFF.md

## Current status (2026-03-20)

Contracts deployed on Base Sepolia. API, CLI, and executor wired up. Ready for end-to-end testing.

### Working now
- Policy engine — agent match, caps, thresholds, allow/deny lists
- Audit logger — append-only JSONL
- API — 8 endpoints (health, evaluate, approvals, respond, audit, policy, treasury)
- Approval store — in-memory + file persistence, auto-creation on approval_required
- Executor — viem integration layer, reads + writes to AgentTreasury contract
- CLI — 9 commands (health, policy, evaluate, approvals, approve, deny, audit, treasury, demo)
- Smart contracts — AgentTreasury + MockWstETH deployed on Base Sepolia
- skill.md — agent-callable interface
- README — submission-ready

### Deployed contracts (Base Sepolia, chain 84532)
- AgentTreasury: `0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0`
- MockWstETH: `0x4b8e084234edc18285cb57d8b29a59c2f1fb7a2d`
- Deployer/Owner: `0x3d7d7712ad32efD8Cb05249d0C7a3De1B1A3bb43`

### Remaining
- End-to-end on-chain test (mint → deposit → configure → yield → spend)
- Submission to Devfolio (conversationLog, tracks, metadata)

## Important project decisions
- Chain: Base Sepolia (bounty accepts any L2)
- MockWstETH with `simulateYield()` for instant demo (production path → real wstETH)
- No web UI — CLI + skill.md is the interface
- Focus on one clean demo path, not feature breadth

## Sensitive context
- Demo wallet credentials must not be committed
- Rotate creds after hackathon
- .env.example has the template; .env is gitignored

## Demo target
A judge should understand the full flow in under 2 minutes:
1. Agent proposes action → policy evaluates
2. Approved → auto-executes on-chain
3. Approval required → human reviews via CLI → executes on approval
4. Denied → blocked with reasons
5. Audit log proves every step
