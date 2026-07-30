import type { Page } from '@playwright/test';

export class CustomerNav {
  constructor(private readonly page: Page) {}

  async openFlashSales(): Promise<void> {
    await this.page.getByRole('link', { name: 'Flash Sales' }).click();
  }

  async openPurchases(): Promise<void> {
    await this.page.getByRole('link', { name: 'My Purchases' }).click();
  }
}
