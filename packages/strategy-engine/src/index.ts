import { readFile } from 'node:fs/promises';
import type { YieldStrategyConfig, DistributionPlan } from '../../shared/src/index.js';

export function validateStrategy(config: YieldStrategyConfig): string[] {
  const errors: string[] = [];
  if (!config.strategyId) errors.push('Missing strategyId');
  if (!config.agentId) errors.push('Missing agentId');
  if (config.minYieldThreshold <= 0) errors.push('minYieldThreshold must be > 0');
  if (config.distributionRatio <= 0 || config.distributionRatio > 1) errors.push('distributionRatio must be in (0, 1]');
  if (!config.buckets || config.buckets.length === 0) errors.push('At least one bucket required');

  const total = config.buckets.reduce((sum: number, b: { percentage: number }) => sum + b.percentage, 0);
  if (Math.abs(total - 100) > 0.01) errors.push(`Bucket percentages sum to ${total}, must be 100`);

  const ids = new Set<string>();
  for (const b of config.buckets) {
    if (ids.has(b.id)) errors.push(`Duplicate bucket ID: ${b.id}`);
    ids.add(b.id);
    if (!b.destination) errors.push(`Bucket ${b.id}: missing destination`);
    if (b.percentage <= 0) errors.push(`Bucket ${b.id}: percentage must be > 0`);
  }
  return errors;
}

export function computeDistribution(
  strategy: YieldStrategyConfig,
  availableYield: number,
  perTxCap: number,
): DistributionPlan {
  const plan: DistributionPlan = {
    strategyId: strategy.strategyId,
    totalAvailableYield: availableYield,
    totalToDistribute: 0,
    perTxCap,
    items: [],
    skippedItems: [],
    timestamp: new Date().toISOString(),
  };

  if (availableYield < strategy.minYieldThreshold) {
    plan.skippedItems.push({ bucketId: '*', reason: `Yield ${availableYield} below threshold ${strategy.minYieldThreshold}` });
    return plan;
  }

  const totalToDistribute = availableYield * strategy.distributionRatio;
  plan.totalToDistribute = totalToDistribute;

  for (const bucket of strategy.buckets) {
    let amount = totalToDistribute * (bucket.percentage / 100);

    // Clamp to per-tx cap
    if (perTxCap > 0 && amount > perTxCap) {
      amount = perTxCap;
    }

    // Skip tiny amounts (< 1 wei in practical terms)
    if (amount < 1e-18) {
      plan.skippedItems.push({ bucketId: bucket.id, reason: 'Amount rounds to zero' });
      continue;
    }

    plan.items.push({
      bucketId: bucket.id,
      bucketLabel: bucket.label,
      destination: bucket.destination,
      amount,
      percentage: bucket.percentage,
    });
  }

  return plan;
}

export async function loadStrategy(filePath: string): Promise<YieldStrategyConfig> {
  const raw = await readFile(filePath, 'utf-8');
  const config = JSON.parse(raw) as YieldStrategyConfig;
  const errors = validateStrategy(config);
  if (errors.length > 0) {
    throw new Error(`Invalid strategy config: ${errors.join(', ')}`);
  }
  return config;
}
