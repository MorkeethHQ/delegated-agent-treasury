/** A single distribution target bucket */
export interface YieldBucket {
  id: string;
  label: string;
  percentage: number; // 0-100, all buckets must sum to 100
  destination: string;
}

/** Top-level strategy configuration */
export interface YieldStrategyConfig {
  strategyId: string;
  agentId: string;
  minYieldThreshold: number; // minimum yield (wstETH) before distributing
  distributionRatio: number; // fraction of available yield to distribute (0-1)
  buckets: YieldBucket[];
}

/** A single computed distribution line item */
export interface DistributionItem {
  bucketId: string;
  bucketLabel: string;
  destination: string;
  amount: number;
  percentage: number;
}

/** Result of computing a distribution */
export interface DistributionPlan {
  strategyId: string;
  totalAvailableYield: number;
  totalToDistribute: number;
  perTxCap: number;
  items: DistributionItem[];
  skippedItems: Array<{ bucketId: string; reason: string }>;
  timestamp: string;
}
