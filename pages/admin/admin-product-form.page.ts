import type { Locator, Page } from '@playwright/test';
import { BasePage } from '@pages/base.page';
import type { ProductCreateDto } from '@models/product';

/** /admin/products/new and /admin/products/edit/:id. */
export class AdminProductFormPage extends BasePage {
  readonly name: Locator;
  readonly description: Locator;
  readonly descriptionLabel: Locator;
  readonly descriptionError: Locator;
  readonly price: Locator;
  readonly stock: Locator;
  readonly category: Locator;
  readonly categoryError: Locator;
  readonly imageUrl: Locator;
  readonly submit: Locator;
  readonly formError: Locator;

  constructor(page: Page) {
    super(page);
    this.name = page.getByTestId('product-name-input');
    this.description = page.getByTestId('product-description-input');
    this.descriptionLabel = page.getByTestId('product-description-label');
    this.descriptionError = page.getByTestId('product-description-error');
    this.price = page.getByTestId('product-price-input');
    this.stock = page.getByTestId('product-stock-input');
    this.category = page.getByTestId('product-category-input');
    this.categoryError = page.getByTestId('product-category-error');
    this.imageUrl = page.getByTestId('product-image-input');
    this.submit = page.getByTestId('product-submit-button');
    this.formError = page.getByTestId('product-form-error');
  }

  async goto(): Promise<void> {
    await this.page.goto('/admin/products/new');
    await this.name.waitFor();
  }

  async fill(product: Partial<ProductCreateDto>): Promise<void> {
    if (product.name !== undefined) await this.name.fill(product.name);
    if (product.description !== undefined) await this.description.fill(product.description);
    if (product.price !== undefined) await this.price.fill(String(product.price));
    if (product.stockQuantity !== undefined) await this.stock.fill(String(product.stockQuantity));
    if (product.category !== undefined) await this.category.fill(product.category);
  }

  async save(): Promise<void> {
    await this.submit.click();
  }
}
