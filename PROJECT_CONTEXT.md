# PROJECT_CONTEXT.md

## One-line pitch
Synthesis is a permission layer for AI agents: agents can take useful wallet actions inside explicit policy rules, request approval when outside policy, and leave a full audit trail.

## Hackathon goal
Build a credible live demo on Base Sepolia that shows:
1. an agent proposes an action
2. policy evaluates it
3. in-policy actions auto-execute
4. out-of-policy actions require approval
5. everything is logged

## Current repo status
Repo: `https://github.com/MorkeethHQ/delegated-agent-treasury`

Local MVP already implemented:
- TypeScript workspace
- shared domain types
- policy engine
- audit logger
- minimal API
- sample policy + sample action plan
- successful smoke test for `/health` and `/plans/evaluate`

## Current architecture
- `apps/api` — API server
- `apps/web` — minimal operator UI placeholder
- `packages/shared` — shared types
- `packages/policy-engine` — policy evaluation logic
- `packages/audit-log` — append-only audit logging
- `config/` — sample policy and sample action plan
- `data/` — local JSONL audit events

## Demo environment
- Chain: Base Sepolia
- Demo wallet available
- Second test address available for transfer testing

## Product framing
This is **not** “let agents do anything.”
This is: let agents do real work **inside rules**.

Core trust primitives:
- spending limits
- allowlisted destinations/contracts
- approval thresholds
- audit trail
- kill switch / constrained scope

## Immediate priorities
1. approval request persistence
2. approval response endpoint
3. minimal operator UI
4. Base Sepolia execution adapter
5. end-to-end demo flow

## Constraints
- optimize for a sharp, reliable demo over broad feature scope
- keep scope narrow: one strong end-to-end path
- do not widen to multi-agent orchestration or broad wallet infra unless core path is done
- use demo-only funds and isolated keys

## Recommended demo flow
1. submit transfer plan below threshold → auto-approve and execute
2. submit transfer plan above threshold → approval required
3. approve in UI/API → execute
4. show audit trail for both flows

## What is intentionally not done yet
- approval persistence layer
- approval response lifecycle
- execution adapter
- web UI
- real policy editing UX

## Notes for contributors
- keep changes practical and demo-oriented
- prefer small vertical slices over abstract framework work
- if adding dependencies, keep them justified and minimal
- preserve the core framing: permissioned autonomy for agents
