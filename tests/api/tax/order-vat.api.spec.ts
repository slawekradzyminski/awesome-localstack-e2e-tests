import { test, expect } from '@fixtures';
import { addresses } from '@support/addresses';
import { SEEDED_VAT, vatBreakdown } from '@support/tax';

// Prices are VAT-inclusive: checkout records the VAT contained in the total and never changes the total.
test.describe('POST /api/v1/orders - VAT', { tag: ['@tax'] }, () => {
  test('records Polish VAT for a country given by name - 201', async ({ shopper }) => {
    // given
    await shopper.fillCart({ price: 100 });

    // when
    const order = await shopper.checkout(addresses.poland);

    // then
    const expected = { totalAmount: 100, taxCountry: 'PL', taxRate: 23, taxAmount: 18.7, netAmount: 81.3 };
    expect(order).toMatchObject(expected);
    expect(await shopper.getOrder(order.id)).toMatchObject(expected);
  });

  test('records German VAT for a country given by code - 201', async ({ shopper }) => {
    // given
    await shopper.fillCart({ price: 59.5 });

    // when
    const order = await shopper.checkout(addresses.germany);

    // then
    const expected = { totalAmount: 59.5, taxCountry: 'DE', taxRate: 19, taxAmount: 9.5, netAmount: 50 };
    expect(order).toMatchObject(expected);
    expect(await shopper.getOrder(order.id)).toMatchObject(expected);
  });

  test('computes VAT over the whole multi-item total - 201', async ({ shopper }) => {
    // given
    await shopper.fillCart({ price: 10.01 }, 3);
    await shopper.fillCart({ price: 4.99 }, 2);

    // when
    const order = await shopper.checkout(addresses.poland);

    // then
    // 40.01 * 23 / 123 = 7.4815...
    expect(order).toMatchObject({ totalAmount: 40.01, taxRate: 23, taxAmount: 7.48, netAmount: 32.53 });
  });

  test('rounds the VAT half up to cents and keeps net + tax equal to the total - 201', async ({ shopper }) => {
    // given
    // 9.99 * 20 / 120 = 1.665 exactly: half-up gives 1.67 where half-even would give 1.66.
    await shopper.fillCart({ price: 9.99 });

    // when
    const order = await shopper.checkout({ ...addresses.poland, country: 'France' });

    // then
    expect(order).toMatchObject({ totalAmount: 9.99, taxCountry: 'FR', taxRate: SEEDED_VAT.FR.rate, taxAmount: 1.67, netAmount: 8.32 });
    expect(vatBreakdown(9.99, 20)).toEqual({ taxAmount: 1.67, netAmount: 8.32 });
  });

  test('records a zero rate for a country without VAT - 201', async ({ shopper }) => {
    // given
    await shopper.fillCart({ price: 30 });

    // when
    const order = await shopper.checkout({ ...addresses.poland, country: 'USA' });

    // then
    const expected = { totalAmount: 30, taxCountry: 'US', taxRate: 0, taxAmount: 0, netAmount: 30 };
    expect(order).toMatchObject(expected);
    expect(await shopper.getOrder(order.id)).toMatchObject(expected);
  });

  test('places the order without VAT fields for an unknown country - 201', async ({ shopper }) => {
    // given
    await shopper.fillCart({ price: 25 });

    // when
    const order = await shopper.checkout({ ...addresses.poland, country: 'Narnia' });

    // then
    expect(order).toMatchObject({ status: 'PENDING', totalAmount: 25, shippingAddress: { country: 'Narnia' } });
    const stored = await shopper.getOrder(order.id);
    for (const field of ['taxCountry', 'taxRate', 'taxAmount', 'netAmount']) {
      expect(order[field as keyof typeof order] ?? null, field).toBeNull();
      expect(stored[field as keyof typeof stored] ?? null, field).toBeNull();
    }
  });
});
