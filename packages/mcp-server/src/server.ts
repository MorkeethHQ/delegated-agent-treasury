#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createConfig } from './config.js';
import { registerTreasuryTools } from './tools/treasury.js';
import { registerStakingTools } from './tools/staking.js';

const server = new McpServer({
  name: 'synthesis-lido-treasury',
  version: '0.1.0',
});

const config = createConfig();

// Register all tools
registerTreasuryTools(server, config);
registerStakingTools(server, config);

// Connect via stdio
const transport = new StdioServerTransport();
await server.connect(transport);
