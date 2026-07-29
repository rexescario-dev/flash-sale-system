import { expect, test } from '@playwright/test';

import { SalePage } from '../../pages/sale.page';
import { loadSeedState } from '../helpers/seed-state';

test.describe('smoke', () => {
  test('views seeded ACTIVE sale and completes a purchase', async ({ page }) => {
    const { sales } = loadSeedState();
    const sale = new SalePage(page);
    await sale.gotoSale(sales.activeStock10Id);

    await expect(sale.status()).toHaveText('ACTIVE');
    await expect(sale.stock()).toContainText('/');

    const userId = `e2e-user-smoke-${Date.now()}`;
    await sale.enterUserId(userId);
    await expect(sale.buyButton()).toBeEnabled({ timeout: 15_000 });
    await sale.buy();

    await expect(sale.purchaseOutcomeStatus()).toHaveText('Purchase successful', {
      timeout: 15_000,
    });
    await expect(page.getByTestId('purchase-id')).toBeVisible();
  });
});
