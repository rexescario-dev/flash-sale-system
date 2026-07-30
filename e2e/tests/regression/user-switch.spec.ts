import { expect, test } from '@playwright/test';

import { CustomerNav } from '../../pages/customer-nav';
import { PurchasesPage } from '../../pages/purchases.page';
import { SalePage } from '../../pages/sale.page';
import { loadSeedState } from '../helpers/seed-state';

test('user switch: B is not treated as owning A purchase and may buy', async ({ page }) => {
  const { products, sales } = loadSeedState();
  const sale = new SalePage(page);
  const nav = new CustomerNav(page);
  const purchases = new PurchasesPage(page);
  const suffix = Date.now();
  const userA = `e2e-user-switch-a-${suffix}`;
  const userB = `e2e-user-switch-b-${suffix}`;

  await sale.gotoSale(sales.activeStock10Id);
  await sale.enterUserId(userA);
  await expect(sale.buyButton()).toBeEnabled({ timeout: 15_000 });
  await sale.buy();
  await sale.expectPurchaseSuccess();
  await expect(sale.alreadyPurchased()).toContainText('You have already purchased this item.', {
    timeout: 15_000,
  });

  await sale.enterUserId(userB);
  await sale.expectNotAlreadyPurchased();
  await expect(sale.buyButton()).toBeEnabled({ timeout: 15_000 });

  await nav.openPurchases();
  await purchases.expectVisible();
  await purchases.expectEmptyState();
  await purchases.expectPurchaseNotVisible(products.activeStock10Name);

  await sale.gotoSale(sales.activeStock10Id);
  await sale.enterUserId(userB);
  await expect(sale.buyButton()).toBeEnabled({ timeout: 15_000 });
  await sale.buy();
  await sale.expectPurchaseSuccess();

  await nav.openPurchases();
  await purchases.expectVisible();
  await purchases.expectPurchaseVisible(products.activeStock10Name);
});
