# @synthesis/policy-engine

Core policy evaluation logic. 12 unit tests.

Rules enforced:
- Amount under max per action
- Daily cap enforcement
- Destination allowlist / denylist
- Approval threshold detection (auto-approve below, escalate above)
- Agent ID matching
- Frozen agent denial
- Swap-specific caps (maxSwapPerAction, maxSlippageBps)
- ERC-8004 verified identity requirement
