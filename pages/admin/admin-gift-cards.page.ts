import type { Locator, Page } from '@playwright/test';
import type { GiftCardStatus } from '@models/tenders';
import { BasePage } from '@pages/base.page';
import { GiftCardDetailsDrawer } from './gift-card-details-drawer.component';
import { GiftCardIssueForm } from './gift-card-issue-form.component';

/** /admin/gift-cards: filtered list, issue form and the details drawer with the ledger. */
export class AdminGiftCardsPage extends BasePage {
  readonly root: Locator;
  readonly loading: Locator;
  readonly listError: Locator;
  readonly statusFilter: Locator;
  readonly issueForm: GiftCardIssueForm;
  readonly issued: Locator;
  readonly issuedCode: Locator;
  readonly details: GiftCardDetailsDrawer;

  constructor(page: Page) {
    super(page);
    this.root = page.getByTestId('admin-gift-cards');
    this.loading = page.getByTestId('admin-gift-cards-loading');
    this.listError = page.getByTestId('admin-gift-cards-error');
    this.statusFilter = page.getByTestId('admin-gift-cards-status');
    this.issueForm = new GiftCardIssueForm(page);
    this.issued = page.getByTestId('admin-gift-card-issued');
    this.issuedCode = page.getByTestId('admin-gift-card-issued-code');
    this.details = new GiftCardDetailsDrawer(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/admin/gift-cards');
    await this.root.waitFor();
  }

  row(code: string): GiftCardRow {
    return {
      root: this.page.getByTestId(`admin-gift-card-row-${code}`),
      balance: this.page.getByTestId(`admin-gift-card-balance-${code}`),
      status: this.page.getByTestId(`admin-gift-card-status-${code}`),
      detailsButton: this.page.getByTestId(`admin-gift-card-view-${code}`),
    };
  }

  async filterBy(status: GiftCardStatus | ''): Promise<void> {
    await this.statusFilter.selectOption(status);
  }

  async openDetails(code: string): Promise<void> {
    await this.row(code).detailsButton.click();
  }
}

export interface GiftCardRow {
  root: Locator;
  balance: Locator;
  status: Locator;
  detailsButton: Locator;
}
