import type { Locator } from '@playwright/test';

// One product tile on the products/search page, found by its exact name.
export class ProductCard {
  readonly root: Locator;
  readonly name: Locator;
  readonly price: Locator;
  readonly addButton: Locator;
  readonly cartQuantity: Locator;

  constructor(list: Locator, productName: string) {
    this.root = list.getByTestId('product-item').filter({
      has: list.page().getByTestId('product-name').getByText(productName, { exact: true }),
    });
    this.name = this.root.getByTestId('product-name');
    this.price = this.root.getByTestId('product-price');
    this.addButton = this.root.getByTestId('product-add-button');
    this.cartQuantity = this.root.getByTestId('product-card-cart-quantity');
  }

  async addToCart(): Promise<void> {
    await this.addButton.click();
  }
}
