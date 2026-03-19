# Synthesis Architecture

## Goal
Allow an agent to propose useful actions, evaluate them against explicit policy, execute automatically when within policy, and request human approval when outside policy.

## Core modules

### 1. Policy Engine
Inputs:
- agent identity
- task context
- action plan
- policy

Outputs:
- allow
- deny
- approval_required
- reasons
- applied rules

### 2. API
Responsibilities:
- receive action plans
- evaluate plans against policy
- create approval requests
- record audit events
- expose read endpoints for logs and approval status

### 3. Web UI
Responsibilities:
- define/edit policy
- review approval requests
- inspect audit trail

### 4. Audit Log
Append-only structured events capturing:
- plan submitted
- policy evaluated
- decision returned
- approval requested
- approval granted/denied
- execution result

## Initial baseline
- TypeScript monorepo
- JSON schemas for policy and plan types
- local JSONL persistence for fast iteration
- mocked/testnet execution adapter
