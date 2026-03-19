# Synthesis

PermitKit for Agents — a local MVP scaffold for an agent wallet + permission layer that enables safe autonomous actions with scoped controls, approval rules, and auditability.

## MVP focus
- Policy definition in JSON
- Action-plan evaluation against policy
- Approval gate for out-of-policy actions
- Audit trail for every decision/action
- Simple local API + web UI scaffold

## Monorepo layout
- `apps/web` — operator UI / approval flow
- `apps/api` — API for plans, policy evaluation, approvals, and audit events
- `packages/policy-engine` — core policy evaluation logic
- `packages/audit-log` — structured event logging utilities
- `packages/shared` — shared types and schemas
- `docs` — product + architecture docs
- `scripts` — local bootstrap/dev helpers

## Current status
This repo is intentionally scaffold-first: structure, docs, and placeholders are in place so implementation can start immediately.

## Suggested first implementation slice
1. Define core types (`Policy`, `ActionPlan`, `EvaluationResult`, `ApprovalRequest`, `AuditEvent`)
2. Implement policy checks for:
   - spend cap
   - allowlist / denylist destination checks
   - approval threshold
3. Add an API endpoint to submit an action plan
4. Return either `approved` or `approval_required`
5. Persist audit events to a local JSONL log

## Next actions
- choose stack defaults if different from the proposed baseline
- implement shared schemas
- implement policy engine
- wire API endpoints
- add a minimal approval UI
