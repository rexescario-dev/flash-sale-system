import { expect, type Locator, type Page } from '@playwright/test';

export class SalePage {
  constructor(private readonly page: Page) {}

  alreadyPurchased() {
    return this.visiblePurchaseSurface().getByTestId('already-purchased');
  }

  async buy(): Promise<void> {
    await this.buyButton().click();
  }

  /**
   * PurchaseRail and StickyBuyBar are both mounted (dual mount is intentional;
   * visibility is CSS-only). Prefer the desktop rail when both report as
   * visible; otherwise the sticky bar. Always return a single locator.
   */
  buyButton() {
    return this.visiblePurchaseSurface().getByRole('button', { name: /Buy Now|Buying/ });
  }

  /** Commit opaque userId via IdentityStrip (Identify/Change → Save). */
  async enterUserId(userId: string): Promise<void> {
    const surface = this.visiblePurchaseSurface();
    await surface.waitFor({ state: 'visible' });

    const identify = surface.getByTestId('identity-identify');
    const change = surface.getByTestId('identity-change');
    // Wait for a settled strip action (guest Identify or identified Change) — avoid
    // racing before either button is mounted.
    await identify.or(change).waitFor({ state: 'visible' });
    if (await identify.isVisible()) {
      await identify.click();
    } else {
      await change.click();
    }

    const input = surface.getByTestId('identity-email-input');
    await input.waitFor({ state: 'visible' });
    await input.fill(userId);
    await surface.getByTestId('identity-save').click();
    await surface.getByTestId('identity-status').waitFor({ state: 'visible' });
  }

  async expectBuyDisabled(): Promise<void> {
    await expect(this.buyButton()).toBeDisabled();
  }

  async expectDetailStatus(status: string): Promise<void> {
    await expect(this.status()).toHaveText(status);
  }

  async expectNotAlreadyPurchased(): Promise<void> {
    await expect(this.alreadyPurchased()).toHaveCount(0);
  }

  async expectPurchaseSuccess(): Promise<void> {
    await expect(this.purchaseOutcomeStatus()).toHaveText('Purchase successful', {
      timeout: 15_000,
    });
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
    return this.visiblePurchaseSurface().getByTestId('identity-email-input');
  }

  private visiblePurchaseSurface(): Locator {
    // Prefer desktop rail when both are visible; otherwise sticky (mobile).
    return this.page
      .getByTestId('purchase-rail')
      .or(this.page.getByTestId('sticky-buy-bar'))
      .filter({ visible: true })
      .first();
  }
}
