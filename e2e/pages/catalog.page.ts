import { expect, type Page } from '@playwright/test';

export class CatalogPage {
  constructor(private readonly page: Page) {}

  async expectSaleStatus(productName: string, status: string): Promise<void> {
    const card = this.page.getByTestId('catalog-card').filter({ hasText: productName });
    await expect(card.getByTestId('sale-status-badge')).toHaveAttribute('data-status', status);
  }

  async expectVisible(): Promise<void> {
    await expect(this.page.getByTestId('catalog-page')).toBeVisible();
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  async openSaleById(flashSaleId: string): Promise<void> {
    await this.page.locator(`a[data-testid="catalog-card"][href="/sales/${flashSaleId}"]`).click();
  }

  async openSaleByProductName(productName: string): Promise<void> {
    await this.page.getByRole('link', { name: new RegExp(productName) }).click();
  }
}
