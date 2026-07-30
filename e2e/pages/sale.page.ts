import type { Page } from '@playwright/test';

export class SalePage {
  constructor(private readonly page: Page) {}

  alreadyPurchased() {
    return this.visiblePurchaseSurface().getByTestId('already-purchased');
  }

  async buy(): Promise<void> {
    await this.buyButton().click();
  }

  /**
   * PurchaseRail and StickyBuyBar are both mounted whenever a sale is
   * loaded (dual mount is intentional; visibility between them is
   * CSS-only based on viewport). Scope to whichever surface is currently
   * visible so selectors resolve to a single element.
   */
  buyButton() {
    return this.visiblePurchaseSurface().getByRole('button', { name: /Buy Now|Buying/ });
  }

  /** Commit opaque userId via IdentityStrip (Identify/Change → Save). */
  async enterUserId(userId: string): Promise<void> {
    const surface = this.visiblePurchaseSurface();
    const identify = surface.getByTestId('identity-identify');
    if (await identify.isVisible()) {
      await identify.click();
    } else {
      await surface.getByTestId('identity-change').click();
    }
    await surface.getByTestId('identity-email-input').fill(userId);
    await surface.getByTestId('identity-save').click();
  }

  async gotoSale(flashSaleId: string): Promise<void> {
    await this.page.goto(`/sales/${flashSaleId}`);
  }

  purchaseId() {
    return this.visiblePurchaseSurface().getByTestId('purchase-id');
  }

  purchaseOutcome() {
    return this.visiblePurchaseSurface().getByTestId('purchase-outcome');
  }

  purchaseOutcomeStatus() {
    return this.visiblePurchaseSurface().getByTestId('purchase-outcome-status');
  }

  status() {
    return this.page.getByTestId('sale-status');
  }

  stock() {
    return this.page.getByTestId('sale-stock');
  }

  userIdInput() {
    return this.page.getByTestId('identity-email-input');
  }

  private visiblePurchaseSurface() {
    return this.page
      .locator('[data-testid="purchase-rail"], [data-testid="sticky-buy-bar"]')
      .filter({ visible: true });
  }
}
