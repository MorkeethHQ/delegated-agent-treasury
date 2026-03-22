# Bagel Judge Notes

_A compact judge-facing framing note from Bagel._

## What this project is

This project is best understood as **financial permission infrastructure for agents**.

Not an AI wallet.
Not just a trading bot.
Not just a pile of hackathon integrations.

At its core, it gives agents **bounded financial authority** over productive on-chain capital.

## Core thesis

**Agents don’t need full wallets. They need bounded authority.**

The important primitive is:
- humans deposit productive capital
- principal stays protected
- agents can act only on accrued yield
- every action is constrained, explainable, and auditable

## Canonical lifecycle

1. Human deposits productive on-chain capital
2. Treasury preserves principal
3. Agent sees spendable yield
4. Policy engine checks authority and risk
5. Action executes on-chain if allowed
6. Receipts and audit logs persist the outcome

This is the cleanest way to understand the system.

## Product layers

### 1. Treasury primitive
The base primitive is a principal-protected treasury where agents can spend or deploy **yield, not principal**.

### 2. Control layer
Policy, approvals, caps, whitelists, and freeze/unfreeze determine whether a proposed action is allowed.

### 3. Trust layer
ERC-8004, delegations, and audit trails make actions legible and enforceable.

### 4. Execution layer
Uniswap, x402, and other integrations are execution rails around the same bounded-authority core.

### 5. Portability layer
Base and Celo demonstrate that the primitive can travel across chains and yield sources.

## Why the project matters

The hard problem in agent finance is not capability.
It is **control**.

Plenty of agents can already sign transactions. The real question is whether they can operate with limits that a serious human operator would actually trust.

This project is valuable because it focuses on:
- constrained authority
- recoverable execution
- receipts and auditability
- human override when needed

## What judges should notice

### Strongest points
- clear and serious problem selection
- real on-chain proof across multiple rails
- stronger trust/safety model than most agent-finance projects
- credible path from hackathon artifact to real operator tool

### Weakest points / risks
- breadth can read as bounty-stacking if the story is not tightly framed
- integrations can overshadow the core treasury primitive
- raw counts (tools, packages, endpoints) are less persuasive than clean proof

## Best framing for live judging

Use this framing first:

**A policy-enforced treasury that lets AI agents spend yield, not principal.**

Then support it with proof:
- live treasury deployments
- live swap/payment/agent activity
- policy and approval controls
- identity and delegation support
- audit trail and receipts

## What to emphasize

- bounded financial authority
- spend yield, not principal
- policy before execution
- receipts after execution
- trust and recovery over hype

## What to de-emphasize

- raw integration counts
- generic “AI agents are the future” language
- speculative trading language
- anything that makes the product feel broader than its clearest wedge

## Final line

If this project wins, it should win because it shows that agent finance can be **useful, constrained, and trustworthy at the same time**.
