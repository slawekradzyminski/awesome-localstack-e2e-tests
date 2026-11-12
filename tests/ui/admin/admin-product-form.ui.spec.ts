import { test, expect } from '@fixtures';
import { randomUUID } from 'node:crypto';
import { AdminProductFormPage } from '@pages/admin/admin-product-form.page';
import { recordWrites } from '@support/network';
import type { ProductDto } from '@models/product';

test.describe('admin product form feedback', { tag: ['@admin'] }, () => {
  test('a product without a description is stopped with a message, not silently (T-063)', async ({ adminPage }) => {
    // given
    const form = new AdminProductFormPage(adminPage);
    await form.goto();
    const writes = recordWrites(adminPage);

    // when
    await form.fill({ name: `No description ${randomUUID().slice(0, 8)}`, price: 12, stockQuantity: 3, category: 'Home' });
    await form.save();

    // then
    await expect(form.descriptionLabel).toHaveText('Description*');
    await expect(form.descriptionError).toHaveText('Product description is required');
    await expect(form.description).toHaveAttribute('aria-invalid', 'true');
    expect(writes).toEqual([]);
  });

  test('an API validation message is shown next to its field (T-063)', async ({ adminPage }) => {
    // given
    const form = new AdminProductFormPage(adminPage);
    await form.goto();
    const rejected = adminPage.waitForResponse((response) => response.url().endsWith('/api/v1/products') && response.request().method() === 'POST');

    // when: a blank category passes the form's required check; the API answers with a field message
    await form.fill({ name: `Blank category ${randomUUID().slice(0, 8)}`, description: 'A blank category', price: 12, stockQuantity: 3, category: '   ' });
    await form.save();

    // then
    const response = await rejected;
    await expect(response, 'Create with a blank category').toHaveStatus(400);
    const body: Record<string, string> = await response.json();
    await expect(form.categoryError).toHaveText(body.category);
  });

  test('a saved product is confirmed and the list opens (T-063)', async ({ api, adminPage }) => {
    // given
    const form = new AdminProductFormPage(adminPage);
    await form.goto();
    const name = `Saved lamp ${randomUUID().slice(0, 8)}`;
    const created = adminPage.waitForResponse((response) => response.url().endsWith('/api/v1/products') && response.request().method() === 'POST');

    // when
    await form.fill({ name, description: 'A lamp', price: 25, stockQuantity: 4, category: 'Home' });
    await form.save();

    // then
    const response = await created;
    await expect(response, 'Create from the form').toHaveStatus(201);
    const product: ProductDto = await response.json();
    api.trackProduct(product);
    await expect(adminPage.getByTestId('toast-title')).toHaveText('Product created');
    await expect(adminPage).toHaveURL(/\/admin\/products$/);
    await expect(adminPage.getByTestId(`admin-product-name-${product.id}`)).toHaveText(name);
  });
});
