# HANDOFF.md

## Current status (2026-03-20)

Dual-chain support ready. Base Sepolia deployed, Base mainnet pending treasury deployment. API, CLI, MCP server, and executor wired up.

### Working now
- Policy engine — agent match, caps, thresholds, allow/deny lists
- Audit logger — append-only JSONL
- API — 8 endpoints (health, evaluate, approvals, respond, audit, policy, treasury)
- Approval store — in-memory + file persistence, auto-creation on approval_required
- Executor — viem integration layer, reads + writes to AgentTreasury contract
- CLI — 9 commands (health, policy, evaluate, approvals, approve, deny, audit, treasury, demo)
- MCP server — 9 tools (treasury state, spend yield, Lido staking ops)
- Smart contracts — AgentTreasury + MockWstETH deployed on Base Sepolia
- Dual-chain RPC support — `RPC_URL` env var across API + CLI
- skill.md + lido.skill.md — agent-callable interfaces
- README — submission-ready with mainnet placeholders

### Deployed contracts

**Base Sepolia (chain 84532)**
- AgentTreasury: `0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0`
- MockWstETH: `0x4b8e084234edc18285cb57d8b29a59c2f1fb7a2d`
- Deployer/Owner: `0x3d7d7712ad32efD8Cb05249d0C7a3De1B1A3bb43`

**Base Mainnet (chain 8453)**
- AgentTreasury: `<MAINNET_TREASURY_ADDRESS>`
- wstETH: `0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452`
- Agent Identity (ERC-8004): `<ERC8004_AGENT_ID>`

### Remaining
- Bagel deploys AgentTreasury to Base mainnet → patch address into all docs
- Bagel configures Base Sepolia treasury (mint, deposit, setAgent, addRecipient, setPerTxCap, simulateYield)
- End-to-end on-chain test (both chains)
- ERC-8004 agent identity registration
- Submission to Devfolio (conversationLog, tracks, metadata)

## Important project decisions
- Dual-chain: Base Sepolia (demo with mock yield) + Base mainnet (real wstETH yield)
- MockWstETH with `simulateYield()` for instant demo
- No web UI — CLI + skill.md + MCP is the interface
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
