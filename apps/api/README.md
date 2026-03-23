# Yieldbound API

REST API server for Yieldbound . 39 endpoints covering treasury management, policy evaluation, approval workflows, yield trading, multi-agent orchestration, ENS identity resolution, and monitoring.

```bash
# Start (API-only mode, no contract env vars needed)
node dist/apps/api/src/server.js

# Start with on-chain execution
node --env-file=.env dist/apps/api/src/server.js
```

See the [main README](../../README.md) for the full endpoint table, or [skill.md](../../skill.md) for the agent-callable interface.
