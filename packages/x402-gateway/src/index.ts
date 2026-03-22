/**
 * x402 Payment Gateway for Yieldbound 
 *
 * Implements the x402 protocol (https://x402.org) for HTTP 402 Payment Required
 * payment gating on raw Node.js http server endpoints.
 *
 * Protocol flow:
 * 1. Client sends request without payment header
 * 2. Server responds 402 with `X-PAYMENT-REQUIRED` header (base64 JSON)
 * 3. Client signs a USDC TransferWithAuthorization and retries with `X-PAYMENT` header
 * 4. Server verifies via Coinbase facilitator, settles, responds with `X-PAYMENT-RESPONSE`
 *
 * This implementation uses the x402 facilitator for payment verification and settlement,
 * making it fully compatible with x402 clients (@x402/fetch, @x402/axios, etc).
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

// --- x402 Protocol Constants ---

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_DECIMALS = 6;
const NETWORK = 'base' as const;
const X402_VERSION = 1;
const DEFAULT_FACILITATOR_URL = 'https://x402.org/facilitator';
const MAX_TIMEOUT_SECONDS = 60;

// --- Types ---

export interface PaymentRequirements {
  scheme: 'exact';
  network: typeof NETWORK;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra?: Record<string, unknown>;
}

export interface RoutePrice {
  /** Price in USD (e.g. 0.01 = 1 cent) */
  price: number;
  description: string;
}

export interface X402GatewayConfig {
  /** Address to receive USDC payments */
  payTo: string;
  /** Map of "METHOD /path" to pricing */
  routes: Record<string, RoutePrice>;
  /** Facilitator URL for payment verification (default: https://x402.org/facilitator) */
  facilitatorUrl?: string;
  /** Whether x402 gating is enabled (default: false) */
  enabled?: boolean;
  /** Server base URL for resource field in payment requirements */
  baseUrl?: string;
}

export interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
}

export interface SettleResponse {
  success: boolean;
  transaction?: string;
  network?: string;
  payer?: string;
  errorReason?: string;
}

export interface X402PricingEntry {
  method: string;
  path: string;
  price: string;
  priceUSD: number;
  description: string;
  network: typeof NETWORK;
  asset: string;
  payTo: string;
}

export interface PaymentReceipt {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  amountUSDC: string;
  amountAtomic: string;
  payer?: string;
  transaction?: string;
  network: typeof NETWORK;
}

export interface PaymentStats {
  totalPayments: number;
  totalUSDCEarned: string;
  totalAtomicEarned: string;
  lastPaymentAt: string | null;
}

// --- Helpers ---

function safeBase64Encode(data: string): string {
  return Buffer.from(data, 'utf-8').toString('base64');
}

function safeBase64Decode(data: string): string {
  return Buffer.from(data, 'base64').toString('utf-8');
}

/** Convert USD amount to USDC atomic units (6 decimals) */
function usdToAtomicAmount(usd: number): string {
  return String(Math.round(usd * 10 ** USDC_DECIMALS));
}

/** Convert USDC atomic units to human-readable USD string */
function atomicToUsd(atomic: string): string {
  const val = Number(atomic) / 10 ** USDC_DECIMALS;
  return `$${val.toFixed(USDC_DECIMALS > 2 ? 2 : USDC_DECIMALS)}`;
}

/**
 * Match a request URL against a route pattern.
 * Supports exact matches and patterns with :param segments.
 * e.g. "GET /verify/:address" matches "GET /verify/0xabc123"
 */
function matchRoute(routeKey: string, method: string, urlPath: string): boolean {
  const parts = routeKey.split(' ');
  if (parts.length !== 2) return false;
  const [routeMethod, routePattern] = parts;

  if (routeMethod !== method && routeMethod !== '*') return false;

  const routeSegments = routePattern.split('/').filter(Boolean);
  const urlSegments = urlPath.split('/').filter(Boolean);

  if (routeSegments.length !== urlSegments.length) return false;

  return routeSegments.every((seg, i) =>
    seg.startsWith(':') || seg === urlSegments[i]
  );
}

// --- Gateway Class ---

export class X402Gateway {
  private config: Required<X402GatewayConfig>;
  private receipts: PaymentReceipt[] = [];
  private totalAtomicEarned = BigInt(0);

  constructor(config: X402GatewayConfig) {
    this.config = {
      payTo: config.payTo,
      routes: config.routes,
      facilitatorUrl: config.facilitatorUrl ?? DEFAULT_FACILITATOR_URL,
      enabled: config.enabled ?? false,
      baseUrl: config.baseUrl ?? 'http://localhost:3001',
    };
  }

  /** Check if x402 gating is enabled */
  get enabled(): boolean {
    return this.config.enabled;
  }

  /** Find the pricing for a given request, or null if the route is free */
  findRoutePrice(method: string, url: string): RoutePrice | null {
    const urlPath = url.split('?')[0];
    for (const [routeKey, price] of Object.entries(this.config.routes)) {
      if (matchRoute(routeKey, method, urlPath)) {
        return price;
      }
    }
    return null;
  }

  /** Build PaymentRequirements for a given route */
  buildPaymentRequirements(method: string, url: string, routePrice: RoutePrice): PaymentRequirements {
    const resource = `${this.config.baseUrl}${url}`;
    return {
      scheme: 'exact',
      network: NETWORK,
      maxAmountRequired: usdToAtomicAmount(routePrice.price),
      resource,
      description: routePrice.description,
      mimeType: 'application/json',
      payTo: this.config.payTo,
      maxTimeoutSeconds: MAX_TIMEOUT_SECONDS,
      asset: USDC_BASE,
    };
  }

  /**
   * Send a 402 Payment Required response with x402-compatible headers.
   * The response body is also JSON for easy debugging.
   */
  send402(
    res: ServerResponse,
    paymentRequirements: PaymentRequirements,
  ): void {
    const x402Response = {
      x402Version: X402_VERSION,
      accepts: [paymentRequirements],
      error: 'X-PAYMENT header is required. See x402.org for protocol details.',
    };

    const headerValue = safeBase64Encode(JSON.stringify(x402Response));

    res.writeHead(402, {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, PUT, PATCH, OPTIONS',
      'access-control-allow-headers': 'content-type, x-payment',
      'access-control-expose-headers': 'x-payment-required, x-payment-response',
      'x-payment-required': headerValue,
    });

    res.end(JSON.stringify(x402Response, null, 2));
  }

  /**
   * Verify a payment payload via the facilitator.
   * In a production setup this calls the Coinbase facilitator's /verify endpoint.
   * For the hackathon we also accept a simplified local verification path.
   */
  async verifyPayment(
    paymentHeader: string,
    paymentRequirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    try {
      const facilitatorUrl = this.config.facilitatorUrl;

      const response = await fetch(`${facilitatorUrl}/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          paymentHeader,
          paymentRequirements,
        }),
      });

      if (!response.ok) {
        // If facilitator is unreachable, log and allow pass-through in dev
        console.warn(`[x402] Facilitator verify returned ${response.status}`);
        return { isValid: false, invalidReason: `Facilitator returned ${response.status}` };
      }

      const result = (await response.json()) as VerifyResponse;
      return result;
    } catch (error) {
      console.warn('[x402] Facilitator verify error:', error instanceof Error ? error.message : String(error));
      return { isValid: false, invalidReason: 'Facilitator unavailable' };
    }
  }

  /**
   * Settle a payment via the facilitator (executes the USDC transfer on-chain).
   */
  async settlePayment(
    paymentHeader: string,
    paymentRequirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    try {
      const facilitatorUrl = this.config.facilitatorUrl;

      const response = await fetch(`${facilitatorUrl}/settle`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          paymentHeader,
          paymentRequirements,
        }),
      });

      if (!response.ok) {
        console.warn(`[x402] Facilitator settle returned ${response.status}`);
        return { success: false, errorReason: `Facilitator returned ${response.status}` };
      }

      const result = (await response.json()) as SettleResponse;
      return result;
    } catch (error) {
      console.warn('[x402] Facilitator settle error:', error instanceof Error ? error.message : String(error));
      return { success: false, errorReason: 'Facilitator unavailable' };
    }
  }

  /**
   * Main middleware function for raw Node.js http server.
   * Returns true if the request was handled (402 sent or payment invalid).
   * Returns false if the request should proceed to the normal handler.
   */
  async handlePaymentGating(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<boolean> {
    if (!this.config.enabled) return false;

    const method = req.method ?? 'GET';
    const url = req.url ?? '/';

    // Check if this route requires payment
    const routePrice = this.findRoutePrice(method, url);
    if (!routePrice) return false; // Free endpoint

    const paymentRequirements = this.buildPaymentRequirements(method, url, routePrice);

    // Check for X-PAYMENT header
    const paymentHeader = req.headers['x-payment'] as string | undefined;

    if (!paymentHeader) {
      // No payment provided — send 402
      console.log(`[x402] 402 Payment Required: ${method} ${url} (${atomicToUsd(paymentRequirements.maxAmountRequired)} USDC)`);
      this.send402(res, paymentRequirements);
      return true;
    }

    // Verify the payment
    console.log(`[x402] Verifying payment for ${method} ${url}...`);
    const verifyResult = await this.verifyPayment(paymentHeader, paymentRequirements);

    if (!verifyResult.isValid) {
      console.log(`[x402] Payment invalid: ${verifyResult.invalidReason}`);
      res.writeHead(402, {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
      });
      res.end(JSON.stringify({
        error: 'Payment verification failed',
        reason: verifyResult.invalidReason,
      }));
      return true;
    }

    // Settle the payment (execute the on-chain transfer)
    console.log(`[x402] Payment verified, settling...`);
    const settleResult = await this.settlePayment(paymentHeader, paymentRequirements);

    if (!settleResult.success) {
      console.log(`[x402] Settlement failed: ${settleResult.errorReason}`);
      res.writeHead(402, {
        'content-type': 'application/json',
        'access-control-allow-origin': '*',
      });
      res.end(JSON.stringify({
        error: 'Payment settlement failed',
        reason: settleResult.errorReason,
      }));
      return true;
    }

    // Payment successful — record receipt, add response header, and let request proceed
    const receipt = this.recordReceipt(method, url, paymentRequirements, settleResult);
    console.log(`[x402] Payment settled: tx=${settleResult.transaction ?? 'n/a'} receipt=${receipt.id} payer=${settleResult.payer ?? 'unknown'} amount=${receipt.amountUSDC}`);
    const paymentResponse = safeBase64Encode(JSON.stringify(settleResult));
    res.setHeader('x-payment-response', paymentResponse);

    return false; // Proceed to handler
  }

  /** Record a verified and settled payment receipt */
  recordReceipt(
    method: string,
    url: string,
    paymentRequirements: PaymentRequirements,
    settleResult: SettleResponse,
  ): PaymentReceipt {
    const urlPath = url.split('?')[0];
    const receipt: PaymentReceipt = {
      id: `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date().toISOString(),
      method,
      path: urlPath,
      amountUSDC: atomicToUsd(paymentRequirements.maxAmountRequired),
      amountAtomic: paymentRequirements.maxAmountRequired,
      payer: settleResult.payer,
      transaction: settleResult.transaction,
      network: NETWORK,
    };
    this.receipts.unshift(receipt); // newest first
    this.totalAtomicEarned += BigInt(paymentRequirements.maxAmountRequired);
    return receipt;
  }

  /** Return all payment receipts (newest first) */
  getReceipts(): PaymentReceipt[] {
    return [...this.receipts];
  }

  /** Return aggregate payment statistics */
  getPaymentStats(): PaymentStats {
    const totalAtomic = this.totalAtomicEarned;
    const totalUSD = Number(totalAtomic) / 10 ** USDC_DECIMALS;
    return {
      totalPayments: this.receipts.length,
      totalUSDCEarned: `$${totalUSD.toFixed(2)}`,
      totalAtomicEarned: totalAtomic.toString(),
      lastPaymentAt: this.receipts.length > 0 ? this.receipts[0].timestamp : null,
    };
  }

  /** Get the full pricing table */
  getPricingTable(): X402PricingEntry[] {
    return Object.entries(this.config.routes).map(([routeKey, routePrice]) => {
      const parts = routeKey.split(' ');
      const method = parts[0];
      const path = parts[1];
      const atomicAmount = usdToAtomicAmount(routePrice.price);
      return {
        method,
        path,
        price: atomicAmount,
        priceUSD: routePrice.price,
        description: routePrice.description,
        network: NETWORK,
        asset: USDC_BASE,
        payTo: this.config.payTo,
      };
    });
  }
}

// --- Default Configuration ---

/** Payment recipient — Synthesis treasury on Base */
const PAYMENT_RECIPIENT = '0x4fD66BdA6d792bE89d1fAeaF9F287AcaCaDBDce6';

/** Create the default x402 gateway for Synthesis API */
export function createSynthesisGateway(overrides?: Partial<X402GatewayConfig>): X402Gateway {
  return new X402Gateway({
    payTo: PAYMENT_RECIPIENT,
    enabled: process.env.ENABLE_X402 === 'true',
    baseUrl: process.env.X402_BASE_URL ?? 'http://localhost:3001',
    facilitatorUrl: process.env.X402_FACILITATOR_URL ?? DEFAULT_FACILITATOR_URL,
    routes: {
      'GET /swap/quote': {
        price: 0.01,
        description: 'Get a live Uniswap swap quote for yield trading',
      },
      'POST /swap/execute': {
        price: 0.05,
        description: 'Execute a policy-gated yield swap via Uniswap on Base',
      },
      'GET /strategy/preview': {
        price: 0.01,
        description: 'Preview yield distribution across strategy buckets',
      },
      'GET /verify/:address': {
        price: 0.01,
        description: 'Verify on-chain agent identity via ERC-8004 registry',
      },
    },
    ...overrides,
  });
}

export {
  USDC_BASE,
  USDC_DECIMALS,
  NETWORK,
  X402_VERSION,
  PAYMENT_RECIPIENT,
  usdToAtomicAmount,
  atomicToUsd,
  safeBase64Encode,
  safeBase64Decode,
};
