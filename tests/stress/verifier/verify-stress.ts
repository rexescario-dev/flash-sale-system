import { PrismaClient } from '@prisma/client';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { StressScenario, StressState } from '../seeder/types';

import { resultsDir, statePath } from '../seeder/paths';
import { unusedStockWarnings } from './unused-stock-warning';

export type VerifyStressOptions = {
  /** When false, missing k6 summary is a hard failure (default). */
  allowMissingSummary?: boolean;
  databaseUrl?: string;
  profile: string;
  resultsDirectory?: string;
  scenario: StressScenario;
  stateFilePath?: string;
  summaryFilePath?: string;
};

export type VerifyCheck = {
  detail: string;
  name: string;
  ok: boolean;
};

export type VerifyResult = {
  artifactPath: string;
  checks: VerifyCheck[];
  environment: null | string;
  k6PurchaseSuccess: null | number;
  limiterProfile: null | string;
  ok: boolean;
  profile: string;
  purchaseCount: number;
  remainingStock: null | number;
  scenario: StressScenario;
  startedAt: string;
  stock: number;
  warnings: string[];
};

type K6Summary = {
  counters?: Record<string, number | undefined>;
  environment?: string;
  limiterProfile?: string;
  metrics?: Record<string, { values?: { count?: number } } | undefined>;
  profile?: string;
  scenario?: string;
  startedAt?: string;
};

async function loadState(filePath: string): Promise<StressState> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as StressState;
}

async function loadSummary(filePath: string): Promise<K6Summary | null> {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as K6Summary;
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT'
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Extract successful-purchase count from a k6 summary.
 * Prefer custom `counters.purchase_success` from buildHandleSummary;
 * fall back to standard k6 `metrics.purchase_success.values.count`.
 */
export function extractPurchaseSuccess(summary: K6Summary): null | number {
  const fromCounters = summary.counters?.purchase_success;
  if (typeof fromCounters === 'number') {
    return fromCounters;
  }

  const fromMetrics = summary.metrics?.purchase_success?.values?.count;
  if (typeof fromMetrics === 'number') {
    return fromMetrics;
  }

  // Also accept a top-level counter alias if present.
  const topLevel = (summary as Record<string, unknown>).purchase_success;
  if (typeof topLevel === 'number') {
    return topLevel;
  }

  return null;
}

async function findDuplicateUserIds(prisma: PrismaClient, flashSaleId: string): Promise<string[]> {
  const rows = await prisma.purchase.groupBy({
    _count: { _all: true },
    by: ['userId'],
    where: { flashSaleId },
  });
  return rows.filter((row) => row._count._all > 1).map((row) => row.userId);
}

export async function verifyStress(options: VerifyStressOptions): Promise<VerifyResult> {
  const { profile, scenario } = options;
  const stateFile = options.stateFilePath ?? statePath(scenario);
  const outDir = options.resultsDirectory ?? resultsDir(scenario, profile);
  const summaryFile = options.summaryFilePath ?? path.join(outDir, 'k6-summary.json');
  const artifactPath = path.join(outDir, 'verifier.json');
  const startedAt = new Date().toISOString();

  const databaseUrl =
    options.databaseUrl ??
    process.env.DATABASE_URL ??
    'postgresql://flash_sale:flash_sale_dev@localhost:5432/flash_sale';

  const state = await loadState(stateFile);
  if (state.scenario !== scenario) {
    throw new Error(
      `State scenario mismatch: file has "${state.scenario}", expected "${scenario}"`,
    );
  }

  const summary = await loadSummary(summaryFile);
  const allowMissingSummary = options.allowMissingSummary === true;
  const limiterProfile = summary?.limiterProfile ?? null;
  const environment = summary?.environment ?? process.env.STRESS_ENVIRONMENT ?? 'local';
  const k6PurchaseSuccess = summary ? extractPurchaseSuccess(summary) : null;

  const checks: VerifyCheck[] = [];
  let purchaseCount = 0;
  let remainingStock: null | number = null;

  if (summary === null) {
    checks.push({
      detail: allowMissingSummary
        ? `No k6 summary at ${summaryFile} (allowed)`
        : `Missing k6 summary at ${summaryFile} — run stress:run first, or pass --allow-missing-summary`,
      name: 'k6_summary_present',
      ok: allowMissingSummary,
    });
  } else if (k6PurchaseSuccess === null) {
    checks.push({
      detail: 'k6 summary present but purchase_success counter could not be read',
      name: 'k6_summary_success_counter',
      ok: false,
    });
  } else {
    checks.push({
      detail: `Loaded k6 summary (${k6PurchaseSuccess} successes)`,
      name: 'k6_summary_present',
      ok: true,
    });
  }

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const sale = await prisma.flashSale.findUnique({
      where: { id: state.flashSaleId },
    });
    if (!sale) {
      checks.push({
        detail: `Flash sale not found: ${state.flashSaleId}`,
        name: 'flash_sale_exists',
        ok: false,
      });
    } else {
      checks.push({
        detail: `Found flash sale ${state.flashSaleId}`,
        name: 'flash_sale_exists',
        ok: true,
      });

      purchaseCount = await prisma.purchase.count({
        where: { flashSaleId: state.flashSaleId },
      });
      remainingStock = sale.remainingStock;

      const stockOk = purchaseCount <= state.stock;
      checks.push({
        detail: `purchase_count=${purchaseCount} stock=${state.stock}`,
        name: 'purchase_count_lte_stock',
        ok: stockOk,
      });

      const expectedRemaining = state.stock - purchaseCount;
      const remainingOk = sale.remainingStock === expectedRemaining;
      checks.push({
        detail: `remainingStock=${sale.remainingStock} expected=${expectedRemaining} (stock - purchase_count)`,
        name: 'remaining_stock_identity',
        ok: remainingOk,
      });

      const duplicates = await findDuplicateUserIds(prisma, state.flashSaleId);
      checks.push({
        detail:
          duplicates.length === 0
            ? 'No userId has more than one purchase'
            : `Duplicate userIds: ${duplicates.join(', ')}`,
        name: 'no_duplicate_user_purchases',
        ok: duplicates.length === 0,
      });

      if (state.fixedUserId) {
        const fixedCount = await prisma.purchase.count({
          where: {
            flashSaleId: state.flashSaleId,
            userId: state.fixedUserId,
          },
        });
        checks.push({
          detail: `fixedUserId=${state.fixedUserId} purchase_count=${fixedCount} (expected 1)`,
          name: 'fixed_user_single_purchase',
          ok: fixedCount === 1,
        });
      }
    }

    if (summary !== null && k6PurchaseSuccess !== null) {
      const matchOk = purchaseCount === k6PurchaseSuccess;
      checks.push({
        detail: `purchase_count=${purchaseCount} k6.purchase_success=${k6PurchaseSuccess}`,
        name: 'purchase_count_matches_k6_success',
        ok: matchOk,
      });
    }
  } finally {
    await prisma.$disconnect();
  }

  const warnings = unusedStockWarnings(state.stock, purchaseCount);
  const ok = checks.every((check) => check.ok);
  const result: VerifyResult = {
    artifactPath,
    checks,
    environment,
    k6PurchaseSuccess,
    limiterProfile,
    ok,
    profile,
    purchaseCount,
    remainingStock,
    scenario,
    startedAt,
    stock: state.stock,
    warnings,
  };

  await mkdir(outDir, { recursive: true });
  await writeFile(
    artifactPath,
    `${JSON.stringify(
      {
        checks,
        counts: {
          k6PurchaseSuccess,
          purchaseCount,
          remainingStock,
          stock: state.stock,
        },
        environment,
        limiterProfile,
        ok,
        profile,
        scenario,
        startedAt,
        stateFile,
        summaryFile: summary ? summaryFile : null,
        warnings,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  return result;
}
