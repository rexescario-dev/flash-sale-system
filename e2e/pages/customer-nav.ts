import type { Page } from '@playwright/test';

export class CustomerNav {
  constructor(private readonly page: Page) {}

  async openFlashSales(): Promise<void> {
    await this.openNavLink('Flash Sales');
  }

  async openPurchases(): Promise<void> {
    await this.openNavLink('My Purchases');
  }

  /**
   * Prefer role links. If the section links are collapsed (mobile / missing
   * md:flex bridge), open the disclosure menu first.
   */
  private async openNavLink(name: 'Flash Sales' | 'My Purchases'): Promise<void> {
    const link = this.page.getByRole('link', { name });
    if (!(await link.isVisible())) {
      await this.page.getByTestId('nav-menu-button').click();
    }
    await link.click();
  }
}
