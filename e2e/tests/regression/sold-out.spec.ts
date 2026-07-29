import { expect, test } from '@playwright/test';

import { SalePage } from '../../pages/sale.page';
import { loadSeedState } from '../helpers/seed-state';

test('transitions to sold-out after purchasing last unit', async ({ page }) => {
  const { sales } = loadSeedState();
  const sale = new SalePage(page);
  const userId = `e2e-user-last-${Date.now()}`;

  await sale.gotoSale(sales.activeStock1Id);
  await expect(sale.status()).toHaveText('ACTIVE');
  await sale.enterUserId(userId);
  await expect(sale.buyButton()).toBeEnabled({ timeout: 15_000 });
  await sale.buy();
  await expect(sale.purchaseOutcomeStatus()).toHaveText('Purchase successful', {
    timeout: 15_000,
  });

  await sale.gotoSale(sales.activeStock1Id);
  await expect(sale.status()).toHaveText('SOLD_OUT');
  await expect(sale.stock()).toContainText('0');
});
