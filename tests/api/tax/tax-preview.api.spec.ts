import { test, expect } from '@fixtures';
import { CartTendersClient } from '@api/tenders.client';
import { createFixedCoupon } from '@support/tax';

test.describe('GET /api/v1/cart/tax-preview', { tag: ['@tax'] }, () => {
  test('returns the VAT contained in the cart total for a country code - 200', async ({ shopper }) => {
    // given
    await shopper.fillCart({ price: 10.01 }, 3);

    // when
    const response = await shopper.tenders.taxPreview('PL');

    // then
    await expect(response).toHaveStatus(200);
    // 30.03 * 23 / 123 = 5.6154...
    expect(await response.json()).toEqual({ country: 'PL', rate: 23, taxAmount: 5.62, netAmount: 24.41, totalAmount: 30.03 });
  });

  test('resolves a country name case-insensitively - 200', async ({ shopper }) => {
    // given
    await shopper.fillCart({ price: 10.01 }, 3);

    // when
    const response = await shopper.tenders.taxPreview('gErMaNy');

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual({ country: 'DE', rate: 19, taxAmount: 4.79, netAmount: 25.24, totalAmount: 30.03 });
  });

  test('previews the same breakdown the order gets at checkout without changing the cart - 200', async ({ shopper }) => {
    // given
    const { product } = await shopper.fillCart({ price: 9.99 }, 2);

    // when
    const response = await shopper.tenders.taxPreview('France');

    // then
    await expect(response).toHaveStatus(200);
    const preview = await response.json();
    expect(preview).toEqual({ country: 'FR', rate: 20, taxAmount: 3.33, netAmount: 16.65, totalAmount: 19.98 });
    const cart = await shopper.cart.getCart();
    expect(await cart.json()).toMatchObject({ items: [{ productId: product.id, quantity: 2 }], totalPrice: 19.98 });
    const order = await shopper.checkout({ street: 'Rue de Rivoli 1', city: 'Paris', state: 'IDF', zipCode: '75001', country: 'FR' });
    expect(order).toMatchObject({ taxCountry: preview.country, taxRate: preview.rate, taxAmount: preview.taxAmount, netAmount: preview.netAmount, totalAmount: preview.totalAmount });
  });

  test('computes the VAT on the total after a coupon discount - 200', async ({ api, shopper }) => {
    // given
    await shopper.fillCart({ price: 60 });
    const coupon = await createFixedCoupon(api, 10.5);
    try {
      await coupon.applyTo(shopper);

      // when
      const response = await shopper.tenders.taxPreview('PL');

      // then
      await expect(response).toHaveStatus(200);
      // 49.50 * 23 / 123 = 9.2560...
      expect(await response.json()).toEqual({ country: 'PL', rate: 23, taxAmount: 9.26, netAmount: 40.24, totalAmount: 49.5 });
    } finally {
      await coupon.remove();
    }
  });

  test('returns a zero breakdown for an empty cart - 200', async ({ shopper }) => {
    // when
    const response = await shopper.tenders.taxPreview('PL');

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual({ country: 'PL', rate: 23, taxAmount: 0, netAmount: 0, totalAmount: 0 });
  });

  test('returns a zero tax for a country without VAT - 200', async ({ shopper }) => {
    // given
    await shopper.fillCart({ price: 12.34 });

    // when
    const response = await shopper.tenders.taxPreview('United States');

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual({ country: 'US', rate: 0, taxAmount: 0, netAmount: 12.34, totalAmount: 12.34 });
  });

  test('requires a country - 400', async ({ shopper }) => {
    // given
    await shopper.fillCart({ price: 10 });

    // when
    const response = await shopper.tenders.taxPreview();

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ message: 'country is required' });
  });

  test('rejects a blank country - 400', async ({ shopper }) => {
    // when
    const response = await shopper.tenders.taxPreview('   ');

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ message: 'country is required' });
  });

  test('reports an unknown country - 404', async ({ shopper }) => {
    // given
    await shopper.fillCart({ price: 10 });

    // when
    const response = await shopper.tenders.taxPreview('Narnia');

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual({ message: 'VAT rate not found for country: Narnia' });
  });

  test('requires authentication - 401', async ({ request }) => {
    // when
    const response = await new CartTendersClient(request).taxPreview('PL');

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});
