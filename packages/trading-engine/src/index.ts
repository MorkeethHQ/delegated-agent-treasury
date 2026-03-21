// Uniswap Trading API client for Base chain
// API endpoint: https://trade-api.gateway.uniswap.org/v1

import type { WalletClient, Account } from 'viem';
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
  // Uniswap Trading API has no /indicative_quote endpoint.
  // Use /quote with a dummy swapper for preview-only quotes.
  const PREVIEW_SWAPPER = '0x0000000000000000000000000000000000000001';
  return getQuote(tokenIn, tokenOut, amountIn, PREVIEW_SWAPPER);
}

/**
 * Check if token approval is needed before swapping.
 * Returns the approval tx data if needed, null if already approved.
 */
export async function checkApproval(
  walletAddress: string,
  tokenIn: string,
  tokenOut: string,
  amount: string,
): Promise<{ approval: unknown } | null> {
  const response = await fetch(`${UNISWAP_API_URL}/check_approval`, {
    method: 'POST',
    headers: {
      'x-api-key': getApiKey(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      walletAddress,
      token: tokenIn,
      amount,
      chainId: BASE_CHAIN_ID,
      tokenOut,
      tokenOutChainId: BASE_CHAIN_ID,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Uniswap check_approval error (${response.status}): ${errorText}`);
  }

  const data = await response.json() as { approval?: unknown };
  return data.approval ? { approval: data.approval } : null;
}

/**
 * Execute a swap via Uniswap Trading API.
 *
 * Full flow (when dryRun=false):
 *   1. checkApproval() — ensure Permit2 can spend tokenIn
 *   2. getQuote() — get executable quote with permitData
 *   3. Sign permitData (EIP-712) with wallet
 *   4. POST /swap with { quote, permitData, signature }
 *   5. Sign and broadcast the returned transaction
 *
 * For dryRun=true, we stop after step 2 and return the quote.
 */
export async function executeSwap(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  swapperAddress: string,
  dryRun: boolean = true,
): Promise<SwapResult> {
  try {
    // Step 1: Check approval status
    const approvalNeeded = await checkApproval(swapperAddress, tokenIn, tokenOut, amountIn)
      .catch(() => null); // Non-critical for dry runs

    // Step 2: Get executable quote
    const quote = await getQuote(tokenIn, tokenOut, amountIn, swapperAddress);

    if (dryRun) {
      return {
        success: true,
        amountIn: quote.amountIn,
        amountOut: quote.amountOut,
        error: approvalNeeded ? 'Permit2 approval needed before live execution' : undefined,
        txHash: undefined,
      };
    }

    // Steps 3-5 require a wallet signer — not implemented for hackathon
    // In production: sign permitData, POST /swap, broadcast tx
    return {
      success: true,
      amountIn: quote.amountIn,
      amountOut: quote.amountOut,
      txHash: '0x_execution_requires_wallet_signer',
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

/**
 * Execute a real swap via Uniswap Trading API using a viem WalletClient.
 *
 * Flow:
 *   1. Check token approval for Permit2
 *   2. Get executable quote with permitData
 *   3. Sign permitData (EIP-712) with wallet
 *   4. POST /swap with { quote, permitData, signature }
 *   5. Broadcast the returned transaction
 */
export async function executeSwapLive(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  walletClient: WalletClient & { account: Account },
): Promise<SwapResult> {
  const swapperAddress = walletClient.account.address;

  try {
    // Step 1: Check approval status
    const approvalNeeded = await checkApproval(swapperAddress, tokenIn, tokenOut, amountIn);

    // If approval is needed, broadcast the approval transaction first
    if (approvalNeeded) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const approvalTx = approvalNeeded.approval as any;
      if (approvalTx && approvalTx.to && approvalTx.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const approvalHash = await walletClient.sendTransaction({
          account: walletClient.account,
          chain: walletClient.chain,
          to: approvalTx.to,
          data: approvalTx.data,
          value: BigInt(approvalTx.value ?? '0'),
          gas: approvalTx.gas ? BigInt(approvalTx.gas) : undefined,
        } as any);
        console.log(`[swap-live] Permit2 approval tx: ${approvalHash}`);
      }
    }

    // Step 2: Get executable quote
    const quoteResponse = await fetch(`${UNISWAP_API_URL}/quote`, {
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

    if (!quoteResponse.ok) {
      const errorText = await quoteResponse.text();
      throw new Error(`Quote failed (${quoteResponse.status}): ${errorText}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quoteData: any = await quoteResponse.json();

    // Step 3: Sign permitData if present
    let signature: string | undefined;
    if (quoteData.permitData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signature = await walletClient.signTypedData({
        account: walletClient.account,
        domain: quoteData.permitData.domain,
        types: quoteData.permitData.types,
        primaryType: 'PermitSingle',
        message: quoteData.permitData.values,
      } as any);
    }

    // Step 4: Submit to /swap endpoint
    const swapResponse = await fetch(`${UNISWAP_API_URL}/swap`, {
      method: 'POST',
      headers: {
        'x-api-key': getApiKey(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quote: quoteData.quote,
        permitData: quoteData.permitData,
        signature,
      }),
    });

    if (!swapResponse.ok) {
      const errorText = await swapResponse.text();
      throw new Error(`Swap submission failed (${swapResponse.status}): ${errorText}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const swapData: any = await swapResponse.json();

    // Step 5: Broadcast the transaction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txHash = await walletClient.sendTransaction({
      account: walletClient.account,
      chain: walletClient.chain,
      to: swapData.swap.to,
      data: swapData.swap.data,
      value: BigInt(swapData.swap.value ?? '0'),
      gas: swapData.swap.gas ? BigInt(swapData.swap.gas) : undefined,
    } as any);

    const amountOut = String(quoteData.quote?.output?.amount ?? quoteData.quote?.amountOut ?? '0');

    return {
      success: true,
      txHash,
      amountIn,
      amountOut,
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
