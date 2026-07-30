import { expect, test } from '@playwright/test';

import { CatalogPage } from '../../pages/catalog.page';
import { CustomerNav } from '../../pages/customer-nav';
import { PurchasesPage } from '../../pages/purchases.page';
import { SalePage } from '../../pages/sale.page';
import { loadSeedState } from '../helpers/seed-state';

test.describe('smoke', () => {
  test('catalog journey: browse, buy, and see purchase in My Purchases', async ({ page }) => {
    const { products } = loadSeedState();
    const catalog = new CatalogPage(page);
    const sale = new SalePage(page);
    const nav = new CustomerNav(page);
    const purchases = new PurchasesPage(page);

    await catalog.goto();
    await catalog.expectVisible();
    await catalog.openSaleByProductName(products.activeStock10Name);

    await expect(page.getByTestId('flash-sale-page')).toBeVisible();
    await sale.expectDetailStatus('ACTIVE');

    const userId = `e2e-user-smoke-${Date.now()}`;
    await sale.enterUserId(userId);
    await expect(sale.buyButton()).toBeEnabled({ timeout: 15_000 });
    await sale.buy();
    await sale.expectPurchaseSuccess();

    await nav.openPurchases();
    await purchases.expectVisible();
    await purchases.expectPurchaseVisible(products.activeStock10Name);
  });
});
