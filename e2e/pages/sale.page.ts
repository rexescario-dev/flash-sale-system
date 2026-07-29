import type { Page } from '@playwright/test';

export class SalePage {
  constructor(private readonly page: Page) {}

  alreadyPurchased() {
    return this.page.getByTestId('already-purchased');
  }

  async buy(): Promise<void> {
    await this.buyButton().click();
  }

  buyButton() {
    return this.page.getByRole('button', { name: /Buy Now|Buying/ });
  }

  async enterUserId(userId: string): Promise<void> {
    await this.userIdInput().fill(userId);
  }

  async gotoSale(flashSaleId: string): Promise<void> {
    await this.page.goto(`/sales/${flashSaleId}`);
  }

  purchaseOutcome() {
    return this.page.getByTestId('purchase-outcome');
  }

  purchaseOutcomeStatus() {
    return this.page.getByTestId('purchase-outcome-status');
  }

  status() {
    return this.page.getByTestId('sale-status');
  }

  stock() {
    return this.page.getByTestId('sale-stock');
  }

  userIdInput() {
    return this.page.locator('#user-id');
  }
}
