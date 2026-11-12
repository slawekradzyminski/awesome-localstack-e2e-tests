import type { Locator, Page } from '@playwright/test';
import { BasePage } from '@pages/base.page';

/** /products/:id: availability and the cart actions for one product. */
export class ProductDetailsPage extends BasePage {
  readonly name: Locator;
  readonly addToCart: Locator;
  readonly removeFromCart: Locator;
  readonly cartQuantity: Locator;
  readonly cartUnavailable: Locator;
  readonly retryCart: Locator;
  readonly noImage: Locator;
  readonly shopApi: Locator;

  constructor(page: Page) {
    super(page);
    this.name = page.getByTestId('product-title');
    this.addToCart = page.getByTestId('add-to-cart');
    this.removeFromCart = page.getByTestId('remove-from-cart');
    this.cartQuantity = page.getByTestId('product-cart-quantity');
    this.cartUnavailable = page.getByTestId('product-cart-unavailable');
    this.retryCart = page.getByTestId('product-cart-retry');
    this.noImage = page.getByTestId('product-no-image');
    this.shopApi = page.getByTestId('commerce-transport');
  }

  async goto(productId: number): Promise<void> {
    await this.page.goto(`/products/${productId}`);
    await this.addToCart.waitFor();
  }
}
