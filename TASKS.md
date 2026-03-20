# TASKS.md

## Priority order

### P0 — complete live demo path
- [ ] Add approval request persistence
- [ ] Add `POST /approvals/:id/respond`
- [ ] Add `GET /approvals`
- [ ] Add audit events for approval requested / granted / denied
- [ ] Add Base Sepolia transfer execution adapter
- [ ] Add policy hook so execution only happens after approval logic passes
- [ ] Add one end-to-end test flow

### P1 — minimal operator UI
- [ ] Show pending approvals
- [ ] Approve / deny buttons
- [ ] Show recent audit events
- [ ] Show current policy summary

### P2 — polish for judges/demo
- [ ] Seed example policies
- [ ] Seed example demo scenarios
- [ ] Add README demo instructions
- [ ] Add architecture diagram or simple flow graphic
- [ ] Add short pitch copy to repo

## Suggested task split for contributors

### Contributor A — backend / approvals
- approval request storage
- approval endpoints
- approval audit events

### Contributor B — execution
- Base Sepolia wallet wiring
- transfer executor
- transaction result logging
- safe config handling

### Contributor C — frontend / demo UX
- tiny UI for approvals
- recent audit feed
- policy summary panel

### Contributor D — docs / pitch / demo prep
- refine README
- contributor handoff docs
- demo script
- judge-facing framing

## Definition of done for tonight
- can submit plan
- can receive `approved` or `approval_required`
- can approve a pending action
- can execute a tiny Base Sepolia transfer
- can show audit trail of full flow
