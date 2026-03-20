/** Configuration for a trading strategy (DCA, swap-to-stable, rebalance) */
export interface TradingStrategy {
  strategyId: string;
  type: 'dca' | 'swap-to-stable' | 'rebalance';
  tokenIn: string;   // default wstETH
  tokenOut: string;   // target token
  allocationPercent: number; // % of available yield to use
  maxSlippageBps: number;    // e.g. 50 = 0.5%
  minAmountThreshold: number; // min yield (wei) before triggering
}
