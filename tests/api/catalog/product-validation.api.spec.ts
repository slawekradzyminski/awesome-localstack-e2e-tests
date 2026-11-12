import { test, expect } from '@fixtures';
import { productPath, ValidationClient } from '@api/validation.client';
import { generateProduct } from '@support/generators/product.generator';
import type { ProductDto } from '@models/product';
import type { ValidationErrors } from '@models/validation';

const LONG_URL = `https://example.com/${'a'.repeat(236)}`;

test.describe('product create and update - field validation', { tag: ['@catalog'] }, () => {
  test('a blank name and a whitespace-only category are rejected on update - 400', async ({ api, request }) => {
    // given
    const product = await api.createProduct();
    const client = new ValidationClient(request, await api.getAdminToken());

    // when
    const response = await client.put(productPath(product.id), { name: '   ', category: ' ' });

    // then
    await expect(response, 'Update with blank name and category').toHaveStatus(400);
    expect(await response.json() as ValidationErrors).toEqual({
      name: 'Product name is required',
      category: 'Category must not be blank',
    });
    const stored: ProductDto = await (await client.get(productPath(product.id))).json();
    expect(stored).toMatchObject({ name: product.name, category: product.category });
  });

  test('an empty category on update leaves the category unchanged - 200', async ({ api, request }) => {
    // given
    const product = await api.createProduct();
    const client = new ValidationClient(request, await api.getAdminToken());

    // when
    const response = await client.put(productPath(product.id), { category: '' });

    // then
    await expect(response, 'Update with an empty category').toHaveStatus(200);
    expect((await response.json() as ProductDto).category).toBe(product.category);
  });

  test('an overlong category and image URL are rejected on create - 400', async ({ api, request }) => {
    // given
    const client = new ValidationClient(request, await api.getAdminToken());

    // when
    const response = await client.post('/api/v1/products', { ...generateProduct(), category: 'c'.repeat(256), imageUrl: LONG_URL });

    // then
    await expect(response, 'Create with 256-character category and image URL').toHaveStatus(400);
    expect(await response.json() as ValidationErrors).toEqual({
      category: 'Category must be at most 255 characters',
      imageUrl: 'Image URL must be at most 255 characters',
    });
  });

  test('an overlong category and image URL are rejected on update - 400', async ({ api, request }) => {
    // given
    const product = await api.createProduct();
    const client = new ValidationClient(request, await api.getAdminToken());

    // when
    const response = await client.put(productPath(product.id), { category: 'c'.repeat(256), imageUrl: LONG_URL });

    // then
    await expect(response, 'Update with 256-character category and image URL').toHaveStatus(400);
    expect(await response.json() as ValidationErrors).toEqual({
      category: 'Category must be at most 255 characters',
      imageUrl: 'Image URL must be at most 255 characters',
    });
  });

  for (const imageUrl of ['https://not a host', 'https://', 'ftp://example.com/a.png']) {
    test(`image URL ${JSON.stringify(imageUrl)} is not a valid http(s) URL - 400`, async ({ api, request }) => {
      // given
      const product = await api.createProduct();
      const client = new ValidationClient(request, await api.getAdminToken());

      // when
      const response = await client.put(productPath(product.id), { imageUrl });

      // then
      await expect(response, 'Update with an invalid image URL').toHaveStatus(400);
      expect(await response.json() as ValidationErrors).toEqual({ imageUrl: 'Image URL must be a valid URL or empty' });
    });
  }

  test('a fractional stock quantity is not truncated - 400', async ({ api, request }) => {
    // given
    const product = await api.createProduct();
    const client = new ValidationClient(request, await api.getAdminToken());

    // when
    const response = await client.put(productPath(product.id), { stockQuantity: 1.9 });

    // then
    await expect(response, 'Update with stockQuantity 1.9').toHaveStatus(400);
    expect(await response.json() as ValidationErrors).toEqual({ stockQuantity: 'Must be a whole number' });
    const stored: ProductDto = await (await client.get(productPath(product.id))).json();
    expect(stored.stockQuantity).toBe(product.stockQuantity);
  });

  test('a non-numeric product id names the parameter - 400', async ({ shopper, request }) => {
    // when
    const response = await new ValidationClient(request, shopper.token).get(productPath('abc'));

    // then
    await expect(response, 'Get product abc').toHaveStatus(400);
    expect(await response.json()).toEqual({ error: "Invalid id 'abc': must be a whole number" });
  });

  test('an unavailable response media type is an ErrorDto - 406', async ({ shopper, request }) => {
    // when
    const response = await new ValidationClient(request, shopper.token).getAccepting('/api/v1/products', 'image/png');

    // then
    await expect(response, 'List products accepting only PNG').toHaveStatus(406);
    expect(JSON.parse(await response.text())).toEqual({ message: 'The requested response media type is not available' });
  });
});
