import type { Locator, Page } from '@playwright/test';
import { BasePage } from '@pages/base.page';
import { GiftCardBalanceChecker } from './gift-card-balance-checker.component';
import { LoyaltyHistory } from './loyalty-history.component';

/** /account/loyalty: points account, paginated history and the gift card balance checker. */
export class LoyaltyPage extends BasePage {
  readonly root: Locator;
  readonly balance: Locator;
  readonly value: Locator;
  readonly tier: Locator;
  readonly lifetime: Locator;
  readonly nextTier: Locator;
  readonly accountLoading: Locator;
  readonly accountError: Locator;
  readonly history: LoyaltyHistory;
  readonly checker: GiftCardBalanceChecker;

  constructor(page: Page) {
    super(page);
    this.root = page.getByTestId('loyalty-page');
    this.balance = page.getByTestId('loyalty-balance');
    this.value = page.getByTestId('loyalty-value');
    this.tier = page.getByTestId('loyalty-tier');
    this.lifetime = page.getByTestId('loyalty-lifetime');
    this.nextTier = page.getByTestId('loyalty-next-tier');
    this.accountLoading = page.getByTestId('loyalty-account-loading');
    this.accountError = page.getByTestId('loyalty-account-error');
    this.history = new LoyaltyHistory(page);
    this.checker = new GiftCardBalanceChecker(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/account/loyalty');
    await this.root.waitFor();
  }
}
