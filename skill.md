# Synthesis Agent Treasury

A permission layer for AI agents managing yield-bearing treasuries. Agents spend only accrued stETH yield — principal is structurally locked.

## What this does

You are interacting with a delegated agent treasury backed by wstETH on Base. A human owner deposits wstETH, and you (the agent) can spend only the yield that accrues over time. The principal is never accessible to agents.

Three permission enforcements protect every transaction:
1. **Recipient whitelist** — you can only send to pre-approved addresses
2. **Per-transaction cap** — each spend is bounded
3. **Yield ceiling** — you cannot spend more than what the treasury has earned

Every action is logged to an append-only audit trail.

## API

Base URL: `{API_URL}` (default `http://localhost:3001`)

### Check treasury status

```
GET /treasury
```

Returns available yield, locked principal, total spent, per-tx cap, and authorized agent address.

### Submit an action plan

```
POST /plans/evaluate
Content-Type: application/json

{
  "planId": "unique-id",
  "agentId": "your-agent-id",
  "type": "transfer",
  "amount": 0.005,
  "destination": "0xRecipientAddress",
  "reason": "Why you need to spend this"
}
```

The plan is evaluated against the active policy. Three outcomes:
- `approved` — auto-executed on-chain if executor is connected
- `approval_required` — queued for human review, returns an `approvalId`
- `denied` — rejected, with reasons

### Check approval status

```
GET /approvals/{approvalId}
```

### List all approvals

```
GET /approvals
GET /approvals?status=pending
```

### View audit trail

```
GET /audit
```

Returns all events in reverse chronological order.

### View policy

```
GET /policy
```

Returns the active policy: spending limits, allowed/denied destinations, approval threshold.

### Health check

```
GET /health
```

## Typical agent flow

1. Check `/treasury` to see available yield
2. Submit a plan to `/plans/evaluate` with amount, destination, and reason
3. If `approved`, the transaction executes automatically — check the `execution` field in the response
4. If `approval_required`, wait for a human to respond — poll `/approvals/{id}` or retry later
5. If `denied`, review the `reasons` array and adjust your plan

## Constraints

- You can only spend yield, never principal
- Destinations must be whitelisted by the treasury owner
- Each transaction must be under the per-tx cap
- Your agent ID must match the policy
- All actions are permanently logged

## On-chain contract

The treasury is an `AgentTreasury` smart contract on Base Sepolia backed by wstETH. Yield accrues as the wstETH exchange rate increases over time. The contract enforces all permission rules at the EVM level — the API is a convenience layer, not a trust boundary.

**Live contracts (Base Sepolia, chain 84532):**
- AgentTreasury: `0x6fb8ec31c54cce7e2a37f6cad47c2556205b7ae0`
- MockWstETH: `0x4b8e084234edc18285cb57d8b29a59c2f1fb7a2d`
