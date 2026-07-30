import { expect, type Page } from '@playwright/test';

export class PurchasesPage {
  constructor(private readonly page: Page) {}

  async expectEmptyState(): Promise<void> {
    await expect(this.page.getByTestId('purchases-empty')).toBeVisible();
  }

  async expectPurchaseNotVisible(productName: string): Promise<void> {
    await expect(
      this.page.getByTestId('purchase-panel').filter({ hasText: productName }),
    ).toHaveCount(0);
  }

  async expectPurchaseVisible(productName: string): Promise<void> {
    await expect(
      this.page.getByTestId('purchase-panel').filter({ hasText: productName }),
    ).toBeVisible({ timeout: 15_000 });
  }

  async expectVisible(): Promise<void> {
    await expect(this.page.getByTestId('purchases-page')).toBeVisible();
  }
}
