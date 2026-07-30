import { test } from '@playwright/test';

import { CatalogPage } from '../../pages/catalog.page';
import { SalePage } from '../../pages/sale.page';
import { loadSeedState } from '../helpers/seed-state';

test.describe('status gates', () => {
  test('catalog shows SOLD_OUT, UPCOMING, and ENDED badges', async ({ page }) => {
    const { products } = loadSeedState();
    const catalog = new CatalogPage(page);
    await catalog.goto();
    await catalog.expectVisible();
    await catalog.expectSaleStatus(products.soldOutName, 'SOLD_OUT');
    await catalog.expectSaleStatus(products.upcomingName, 'UPCOMING');
    await catalog.expectSaleStatus(products.endedName, 'ENDED');
  });

  test('detail SOLD_OUT: status visible and Buy disabled', async ({ page }) => {
    const { sales } = loadSeedState();
    const sale = new SalePage(page);
    await sale.gotoSale(sales.soldOutId);
    await sale.expectDetailStatus('SOLD_OUT');
    await sale.enterUserId(`e2e-user-gate-soldout-${Date.now()}`);
    await sale.expectBuyDisabled();
  });

  test('detail UPCOMING: status visible and Buy disabled', async ({ page }) => {
    const { sales } = loadSeedState();
    const sale = new SalePage(page);
    await sale.gotoSale(sales.upcomingId);
    await sale.expectDetailStatus('UPCOMING');
    await sale.enterUserId(`e2e-user-gate-upcoming-${Date.now()}`);
    await sale.expectBuyDisabled();
  });

  test('detail ENDED: status visible and Buy disabled', async ({ page }) => {
    const { sales } = loadSeedState();
    const sale = new SalePage(page);
    await sale.gotoSale(sales.endedId);
    await sale.expectDetailStatus('ENDED');
    await sale.enterUserId(`e2e-user-gate-ended-${Date.now()}`);
    await sale.expectBuyDisabled();
  });
});
