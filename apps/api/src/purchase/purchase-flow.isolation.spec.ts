import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PurchaseFlowService } from './purchase-flow.service';

describe('PurchaseFlowService isolation (EPIC-04)', () => {
  it('constructor accepts only FlashSaleRepository, FlashSaleReservation, PurchaseRepository, PrismaService', () => {
    // Arity: four constructor params (three @Inject tokens + PrismaService)
    expect(PurchaseFlowService.length).toBe(4);
  });

  it('source stays Redis-free and query-cache-free', () => {
    const source = readFileSync(join(__dirname, 'purchase-flow.service.ts'), 'utf8');

    expect(source).toMatch(/FLASH_SALE_REPOSITORY/);
    expect(source).toMatch(/FLASH_SALE_RESERVATION/);
    expect(source).toMatch(/PURCHASE_REPOSITORY/);
    expect(source).toMatch(/PrismaService/);

    expect(source).not.toMatch(/redis/i);
    expect(source).not.toMatch(/QueryCache/);
    expect(source).not.toMatch(/FlashSaleQueryCache/);
    expect(source).not.toMatch(/MyPurchaseQueryCache/);
    expect(source).not.toMatch(/REDIS_/);
  });
});
