# MVP Plan

## Scope
Build one strong end-to-end flow:
1. create a policy
2. submit an action plan
3. evaluate against policy
4. auto-approve or escalate for approval
5. log the decision

## Phase 1
- repo scaffold
- shared types
- sample policy JSON
- sample action-plan JSON
- policy evaluator
- audit logger

## Phase 2
- API endpoints
- approval request lifecycle
- local persistence

## Phase 3
- minimal web UI for policy + approvals + audit trail

## Out of scope for first pass
- real wallet integration
- real onchain execution
- multi-agent role systems
- natural-language policy authoring
