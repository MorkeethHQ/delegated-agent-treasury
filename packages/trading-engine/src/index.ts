// Uniswap Trading API client for Base chain
// API endpoint: https://trade-api.gateway.uniswap.org/v1

import type { TradingStrategy } from '../../shared/src/trading.js';

export type { TradingStrategy } from '../../shared/src/trading.js';

// --- Constants ---

const UNISWAP_API_URL = 'https://trade-api.gateway.uniswap.org/v1';
const FALLBACK_API_KEY = 'GOI55Pq1Kd97gxsb9K13A5eH5_ed59fzh9ObbXdSNZA';
const BASE_CHAIN_ID = 8453;

const UNIVERSAL_ROUTER = '0x6ff5693b99212da76ad316178a184ab56d299b43';
const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

export interface TokenInfo {
  name: string;
  symbol: string;
  address: string;
  decimals: number;
}

export const TOKENS: Record<string, TokenInfo> = {
  wstETH: {
    name: 'Wrapped stETH',
    symbol: 'wstETH',
    address: '0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452',
    decimals: 18,
  },
  USDC: {
    name: 'USD Coin',
    symbol: 'USDC',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    decimals: 6,
  },
  WETH: {
    name: 'Wrapped Ether',
    symbol: 'WETH',
    address: '0x4200000000000000000000000000000000000006',
    decimals: 18,
  },
  cbETH: {
    name: 'Coinbase Wrapped Staked ETH',
    symbol: 'cbETH',
    address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
    decimals: 18,
  },
};

// --- Interfaces ---

export interface SwapQuote {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  amountOutFormatted: string;
  priceImpact: string;
  gasEstimateUSD: string;
  route: string;
  routingPreference: string;
}

export interface SwapResult {
  success: boolean;
  txHash?: string;
  amountIn: string;
  amountOut: string;
  error?: string;
}

// --- Token helpers ---

export function formatTokenAmount(amount: string, decimals: number): string {
  const str = amount.padStart(decimals + 1, '0');
  const intPart = str.slice(0, str.length - decimals) || '0';
  const fracPart = str.slice(str.length - decimals);
  // Trim trailing zeros from fractional part
  const trimmed = fracPart.replace(/0+$/, '');
  return trimmed.length > 0 ? `${intPart}.${trimmed}` : intPart;
}

export function parseTokenAmount(amount: string, decimals: number): string {
  const [intPart, fracPart = ''] = amount.split('.');
  const paddedFrac = fracPart.padEnd(decimals, '0').slice(0, decimals);
  const raw = intPart + paddedFrac;
  // Strip leading zeros but keep at least one digit
  return raw.replace(/^0+/, '') || '0';
}

// --- Internal helpers ---

function getApiKey(): string {
  return process.env.UNISWAP_API_KEY ?? FALLBACK_API_KEY;
}

function findTokenDecimals(address: string): number {
  const lower = address.toLowerCase();
  for (const token of Object.values(TOKENS)) {
    if (token.address.toLowerCase() === lower) return token.decimals;
  }
  return 18; // default to 18 decimals
}

// --- API functions ---

export async function getQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  swapperAddress: string,
): Promise<SwapQuote> {
  const response = await fetch(`${UNISWAP_API_URL}/quote`, {
    method: 'POST',
    headers: {
      'x-api-key': getApiKey(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'EXACT_INPUT',
      amount: amountIn,
      tokenInChainId: BASE_CHAIN_ID,
      tokenOutChainId: BASE_CHAIN_ID,
      tokenIn,
      tokenOut,
      swapper: swapperAddress,
      slippageTolerance: 0.5,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Uniswap quote API error (${response.status}): ${errorText}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await response.json();
  const outDecimals = findTokenDecimals(tokenOut);
  const q = data.quote ?? data;

  const amountOut = String(q.output?.amount ?? q.amountOut ?? '0');

  return {
    tokenIn,
    tokenOut,
    amountIn,
    amountOut,
    amountOutFormatted: formatTokenAmount(amountOut, outDecimals),
    priceImpact: String(q.priceImpact ?? '0'),
    gasEstimateUSD: String(q.gasFeeUSD ?? q.gasUseEstimateUSD ?? '0'),
    route: JSON.stringify(data.routing ?? 'CLASSIC'),
    routingPreference: String(data.routing ?? 'CLASSIC'),
  };
}

export async function getIndicativeQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
): Promise<SwapQuote> {
  // Use the full /quote endpoint with a zero-address swapper for previews
  // (indicative_quote is not available on all API key tiers)
  const PREVIEW_SWAPPER = '0x0000000000000000000000000000000000000001';
  return getQuote(tokenIn, tokenOut, amountIn, PREVIEW_SWAPPER);
}

export async function executeSwap(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  swapperAddress: string,
  dryRun: boolean = true,
): Promise<SwapResult> {
  try {
    const quote = await getQuote(tokenIn, tokenOut, amountIn, swapperAddress);

    if (dryRun) {
      return {
        success: true,
        amountIn: quote.amountIn,
        amountOut: quote.amountOut,
        error: undefined,
        txHash: undefined,
      };
    }

    // Non-dry-run path: would need walletClient to sign & send the tx
    // For hackathon, return the quote as a simulated result
    return {
      success: true,
      amountIn: quote.amountIn,
      amountOut: quote.amountOut,
      txHash: '0x_dry_run_no_tx',
    };
  } catch (error) {
    return {
      success: false,
      amountIn,
      amountOut: '0',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function previewDCA(
  availableYieldWei: string,
  strategies: TradingStrategy[],
): Promise<SwapQuote[]> {
  const quotes: SwapQuote[] = [];
  const availableNum = BigInt(availableYieldWei);

  for (const strategy of strategies) {
    const amount = (availableNum * BigInt(Math.round(strategy.allocationPercent * 100))) / BigInt(10000);

    if (amount <= BigInt(0)) continue;

    const amountStr = amount.toString();

    // Skip if below minimum threshold (threshold is in wei)
    if (amount < BigInt(strategy.minAmountThreshold)) continue;

    try {
      const quote = await getIndicativeQuote(strategy.tokenIn, strategy.tokenOut, amountStr);
      quotes.push(quote);
    } catch (error) {
      // Include a partial quote so caller knows it was attempted
      quotes.push({
        tokenIn: strategy.tokenIn,
        tokenOut: strategy.tokenOut,
        amountIn: amountStr,
        amountOut: '0',
        amountOutFormatted: '0',
        priceImpact: '0',
        gasEstimateUSD: '0',
        route: 'ERROR',
        routingPreference: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return quotes;
}

// Re-export constants for external use
export { UNISWAP_API_URL, BASE_CHAIN_ID, UNIVERSAL_ROUTER, PERMIT2 };
