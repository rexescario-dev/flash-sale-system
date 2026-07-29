import { expect, test } from '@playwright/test';

import { SalePage } from '../../pages/sale.page';
import { loadSeedState } from '../helpers/seed-state';

test('rejects duplicate purchase for same user', async ({ page }) => {
  const { sales } = loadSeedState();
  const sale = new SalePage(page);
  const userId = `e2e-user-dup-${Date.now()}`;

  await sale.gotoSale(sales.activeStock10Id);
  await sale.enterUserId(userId);
  await expect(sale.buyButton()).toBeEnabled({ timeout: 15_000 });
  await sale.buy();
  await expect(sale.purchaseOutcomeStatus()).toHaveText('Purchase successful', {
    timeout: 15_000,
  });

  // EPIC-05 disables Buy once myPurchase reports purchased=true — prove that
  // duplicate-specific UX (not merely any outcome banner).
  await expect(sale.alreadyPurchased()).toHaveText('You have already purchased this item.', {
    timeout: 15_000,
  });
  await expect(sale.buyButton()).toBeDisabled();

  // Reload proves the server-side purchase gate still surfaces duplicate UX.
  await sale.gotoSale(sales.activeStock10Id);
  await sale.enterUserId(userId);
  await expect(sale.alreadyPurchased()).toHaveText('You have already purchased this item.', {
    timeout: 15_000,
  });
  await expect(sale.buyButton()).toBeDisabled();
});
