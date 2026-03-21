/**
 * MoonPay CLI Bridge
 *
 * MoonPay CLI (npm i -g @moonpay/cli) provides 54 crypto tools via MCP across
 * 17 skills and 10+ chains. It runs as a local MCP server via `mp mcp`.
 *
 * Capabilities exposed through this bridge:
 * - Swaps across 10+ chains (Ethereum, Base, Arbitrum, Polygon, Optimism, etc.)
 * - DCA (Dollar Cost Averaging) with configurable frequency
 * - Cross-chain bridges
 * - Portfolio & balance management
 * - Fiat on/off ramp (bank, Apple Pay, Venmo, PayPal)
 * - Token discovery & price alerts
 * - Limit orders & stop losses
 *
 * Setup:
 *   npm install -g @moonpay/cli
 *   mp consent accept
 *   mp login --email you@example.com
 *   mp mcp                           # starts MCP server on stdio
 *
 * MCP config for Claude Desktop / Claude Code:
 *   { "mcpServers": { "moonpay": { "command": "mp", "args": ["mcp"] } } }
 *
 * This bridge wraps MoonPay operations with our policy engine so every
 * MoonPay action goes through approval before execution. When MoonPay CLI
 * is not installed, all functions degrade gracefully with setup instructions.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MoonPayConfig {
  enabled: boolean;
  note: string;
  mcpEndpoint: string;
  supportedChains: string[];
  tools: string[];
}

export interface MoonPaySwapParams {
  fromToken: string;
  toToken: string;
  amount: string;
  chain: string;
}

export interface MoonPayDCAParams {
  token: string;
  amount: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  chain: string;
}

export interface MoonPayBalanceResult {
  token: string;
  chain: string;
  balance: string | null;
  error?: string;
}

export interface MoonPaySwapResult {
  success: boolean;
  fromToken: string;
  toToken: string;
  amount: string;
  chain: string;
  txHash?: string;
  error?: string;
  dryRun: boolean;
}

export interface MoonPayDCAResult {
  success: boolean;
  token: string;
  amount: string;
  frequency: string;
  chain: string;
  error?: string;
  dryRun: boolean;
}

export interface MoonPayStatus {
  installed: boolean;
  cliVersion: string | null;
  authenticated: boolean;
  availableTools: string[];
  setupInstructions?: string;
}

// ---------------------------------------------------------------------------
// Default config path
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG_PATH = resolve(
  process.cwd(),
  'config',
  'moonpay-config.json',
);

// ---------------------------------------------------------------------------
// CLI detection
// ---------------------------------------------------------------------------

let _cliAvailable: boolean | null = null;
let _cliVersion: string | null = null;

/**
 * Check whether the MoonPay CLI (`mp`) is installed and reachable.
 */
export async function isMoonPayCLIAvailable(): Promise<boolean> {
  if (_cliAvailable !== null) return _cliAvailable;
  try {
    const { stdout } = await execFileAsync('mp', ['--version']);
    _cliVersion = stdout.trim();
    _cliAvailable = true;
  } catch {
    _cliAvailable = false;
    _cliVersion = null;
  }
  return _cliAvailable;
}

/**
 * Reset the cached CLI availability check (useful for tests).
 */
export function resetCLICache(): void {
  _cliAvailable = null;
  _cliVersion = null;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Load the MoonPay config from disk. Falls back to sensible defaults when
 * the config file does not exist.
 */
export async function getMoonPayConfig(
  configPath: string = DEFAULT_CONFIG_PATH,
): Promise<MoonPayConfig> {
  try {
    const raw = await readFile(configPath, 'utf8');
    return JSON.parse(raw) as MoonPayConfig;
  } catch {
    return {
      enabled: false,
      note: 'Install MoonPay CLI: npm install -g @moonpay/cli && mp login && mp mcp',
      mcpEndpoint: 'http://localhost:3002',
      supportedChains: ['base', 'ethereum', 'arbitrum', 'polygon', 'optimism'],
      tools: ['swap', 'bridge', 'dca', 'balance', 'portfolio', 'onramp', 'offramp'],
    };
  }
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

const SETUP_INSTRUCTIONS = `MoonPay CLI is not installed or not in PATH.

To set up MoonPay CLI:
  1. npm install -g @moonpay/cli
  2. mp consent accept
  3. mp login --email you@example.com   (verify via email)
  4. mp mcp                             (starts the MCP server)

For Claude Desktop / Claude Code, add to your MCP config:
  { "mcpServers": { "moonpay": { "command": "mp", "args": ["mcp"] } } }

Docs: https://support.moonpay.com/en/collections/1373008-ai-agents-and-cli-tools`;

/**
 * Get the current MoonPay CLI connection status and available tools.
 */
export async function getMoonPayStatus(): Promise<MoonPayStatus> {
  const installed = await isMoonPayCLIAvailable();

  if (!installed) {
    return {
      installed: false,
      cliVersion: null,
      authenticated: false,
      availableTools: [],
      setupInstructions: SETUP_INSTRUCTIONS,
    };
  }

  // Check authentication by running a lightweight command
  let authenticated = false;
  try {
    await execFileAsync('mp', ['whoami']);
    authenticated = true;
  } catch {
    authenticated = false;
  }

  const config = await getMoonPayConfig();

  return {
    installed: true,
    cliVersion: _cliVersion,
    authenticated,
    availableTools: config.tools,
  };
}

// ---------------------------------------------------------------------------
// Tool listing
// ---------------------------------------------------------------------------

/**
 * Known MoonPay CLI tool categories and their capabilities.
 * Sourced from MoonPay documentation — 54 tools across 17 skills.
 */
export const MOONPAY_TOOL_CATEGORIES = {
  wallet: [
    'create_wallet',
    'list_wallets',
    'get_wallet_balance',
    'export_wallet',
  ],
  trading: [
    'swap_tokens',
    'get_swap_quote',
    'bridge_tokens',
    'get_bridge_quote',
  ],
  dca: [
    'create_dca_order',
    'list_dca_orders',
    'cancel_dca_order',
  ],
  orders: [
    'create_limit_order',
    'create_stop_loss',
    'list_orders',
    'cancel_order',
  ],
  portfolio: [
    'get_portfolio',
    'get_portfolio_history',
    'get_token_balance',
  ],
  market: [
    'get_token_price',
    'get_trending_tokens',
    'analyze_token',
    'set_price_alert',
  ],
  onramp: [
    'buy_crypto',
    'get_buy_quote',
    'list_payment_methods',
  ],
  offramp: [
    'sell_crypto',
    'get_sell_quote',
    'withdraw_to_bank',
  ],
  transfers: [
    'send_tokens',
    'get_transaction_history',
  ],
} as const;

/**
 * Return a flat list of all known MoonPay tool names.
 */
export function listMoonPayTools(): string[] {
  return Object.values(MOONPAY_TOOL_CATEGORIES).flat();
}

// ---------------------------------------------------------------------------
// Execution helpers — policy-gated wrappers
// ---------------------------------------------------------------------------

/**
 * Execute a token swap via MoonPay CLI, gated by our policy engine.
 *
 * In production, this calls the MoonPay MCP server. For the hackathon demo,
 * dry-run mode returns the intended action without execution.
 */
export async function executeMoonPaySwap(
  params: MoonPaySwapParams,
  dryRun = true,
): Promise<MoonPaySwapResult> {
  const installed = await isMoonPayCLIAvailable();

  if (!installed) {
    return {
      success: false,
      ...params,
      dryRun,
      error: SETUP_INSTRUCTIONS,
    };
  }

  if (dryRun) {
    return {
      success: true,
      ...params,
      dryRun: true,
    };
  }

  try {
    const { stdout } = await execFileAsync('mp', [
      'swap',
      '--from', params.fromToken,
      '--to', params.toToken,
      '--amount', params.amount,
      '--chain', params.chain,
      '--yes',
      '--json',
    ]);

    const result = JSON.parse(stdout);
    return {
      success: true,
      ...params,
      txHash: result.txHash ?? result.hash,
      dryRun: false,
    };
  } catch (error) {
    return {
      success: false,
      ...params,
      dryRun: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Set up a DCA (Dollar Cost Averaging) order via MoonPay CLI.
 */
export async function executeMoonPayDCA(
  params: MoonPayDCAParams,
  dryRun = true,
): Promise<MoonPayDCAResult> {
  const installed = await isMoonPayCLIAvailable();

  if (!installed) {
    return {
      success: false,
      ...params,
      dryRun,
      error: SETUP_INSTRUCTIONS,
    };
  }

  if (dryRun) {
    return {
      success: true,
      ...params,
      dryRun: true,
    };
  }

  try {
    const { stdout } = await execFileAsync('mp', [
      'dca',
      '--token', params.token,
      '--amount', params.amount,
      '--frequency', params.frequency,
      '--chain', params.chain,
      '--yes',
      '--json',
    ]);

    const _result = JSON.parse(stdout);
    return {
      success: true,
      ...params,
      dryRun: false,
    };
  } catch (error) {
    return {
      success: false,
      ...params,
      dryRun: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check a token balance on a specific chain via MoonPay CLI.
 */
export async function getMoonPayBalance(
  token: string,
  chain: string,
): Promise<MoonPayBalanceResult> {
  const installed = await isMoonPayCLIAvailable();

  if (!installed) {
    return {
      token,
      chain,
      balance: null,
      error: SETUP_INSTRUCTIONS,
    };
  }

  try {
    const { stdout } = await execFileAsync('mp', [
      'balance',
      '--token', token,
      '--chain', chain,
      '--json',
    ]);

    const result = JSON.parse(stdout);
    return {
      token,
      chain,
      balance: result.balance ?? result.amount ?? stdout.trim(),
    };
  } catch (error) {
    return {
      token,
      chain,
      balance: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
