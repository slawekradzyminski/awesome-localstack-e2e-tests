import type { Locator, Page } from '@playwright/test';
import { BasePage } from '@pages/base.page';

/** /admin/coupons: coupon list and the create/edit form with its validity window. */
export class AdminCouponsPage extends BasePage {
  readonly form: Locator;
  readonly code: Locator;
  readonly type: Locator;
  readonly value: Locator;
  readonly validFrom: Locator;
  readonly validUntil: Locator;
  readonly save: Locator;
  readonly formError: Locator;

  constructor(page: Page) {
    super(page);
    this.form = page.getByTestId('coupon-form');
    this.code = page.getByTestId('coupon-code');
    this.type = page.getByTestId('coupon-type');
    this.value = page.getByTestId('coupon-value');
    this.validFrom = page.getByTestId('coupon-valid-from');
    this.validUntil = page.getByTestId('coupon-valid-until');
    this.save = page.getByTestId('coupon-save');
    this.formError = page.getByTestId('coupon-form-error');
  }

  async goto(): Promise<void> {
    await this.page.goto('/admin/coupons');
    await this.form.waitFor();
  }

  /** Creates a percentage coupon valid between two datetime-local values (browser time). */
  async create(coupon: { code: string; percent: number; validFrom: string; validUntil: string }): Promise<void> {
    await this.code.fill(coupon.code);
    await this.type.selectOption('PERCENTAGE');
    await this.value.fill(String(coupon.percent));
    await this.validFrom.fill(coupon.validFrom);
    await this.validUntil.fill(coupon.validUntil);
    await this.save.click();
  }

  row(couponId: number): Locator {
    return this.page.getByTestId(`coupon-row-${couponId}`);
  }

  async edit(couponId: number): Promise<void> {
    await this.page.getByTestId(`coupon-edit-${couponId}`).click();
  }
}
