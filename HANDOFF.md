# HANDOFF.md

## Current status
The repo has been initialized and pushed. Core MVP pieces exist and compile.

Working now:
- policy engine
- audit logger
- minimal API
- sample policy + action plan
- smoke-tested evaluation flow

Not finished yet:
- approval persistence and endpoints
- web UI
- Base Sepolia execution path

## Latest known good state
- repo pushed to GitHub
- branch: `main`
- local smoke test passed for API health + policy evaluation

## Important project decisions
- Chain for demo: Base Sepolia
- Use isolated demo wallet only
- Focus on one strong flow, not broad platform coverage
- Keep the product centered on permissioned autonomy + approvals + auditability

## Sensitive context
- Demo wallet exists
- Second test address exists
- Credentials should not be echoed into commits/docs
- Rotate demo creds after sprint/demo

## Suggested next coding move
Implement approval request storage and endpoints before touching UI polish.

## Demo target
A judge should be able to understand the full flow in under 2 minutes:
1. agent proposes action
2. policy evaluates
3. approval is required or skipped
4. action executes
5. audit log proves what happened
