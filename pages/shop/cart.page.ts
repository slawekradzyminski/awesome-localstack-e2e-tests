import type { Locator, Page } from '@playwright/test';
import { BasePage } from '@pages/base.page';
import { CartGiftCardPanel } from './cart-gift-card.component';
import { CartLoyaltyPanel } from './cart-loyalty.component';
import { TendersSummary } from './tenders-summary.component';

/** /cart: items in the display currency, the tender panels and the amount still due by card. */
export class CartPage extends BasePage {
  readonly content: Locator;
  readonly total: Locator;
  readonly checkoutButton: Locator;
  readonly giftCard: CartGiftCardPanel;
  readonly loyalty: CartLoyaltyPanel;
  readonly summary: TendersSummary;

  constructor(page: Page) {
    super(page);
    this.content = page.getByTestId('cart-content');
    this.total = page.getByTestId('cart-summary-total-price');
    this.checkoutButton = page.getByTestId('cart-checkout-button');
    this.giftCard = new CartGiftCardPanel(page);
    this.loyalty = new CartLoyaltyPanel(page);
    this.summary = new TendersSummary(page, 'cart');
  }

  /** Opens a cart that has items and waits until it is rendered with its tender panels. */
  async goto(): Promise<void> {
    await this.page.goto('/cart');
    await this.content.waitFor();
    await this.giftCard.root.waitFor();
  }

  itemPrice(productId: number): Locator {
    return this.page.getByTestId(`cart-item-price-${productId}`);
  }

  itemTotal(productId: number): Locator {
    return this.page.getByTestId(`cart-item-total-${productId}`);
  }

  async proceedToCheckout(): Promise<void> {
    await this.checkoutButton.click();
  }
}
