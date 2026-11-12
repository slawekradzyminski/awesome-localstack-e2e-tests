import { test, expect } from '@fixtures';
import { TaxClient } from '@api/tax.client';
import { LOCAL_DATE_TIME, SEEDED_CURRENCIES, unusedCurrencyCode } from '@support/tax';
import type { CurrencyDto } from '@models/tax';

test.describe('GET /api/v1/currencies', { tag: ['@currencies'] }, () => {
  test('lists the seeded currencies ordered by code with USD as base - 200', async ({ shopper }) => {
    // when
    const response = await shopper.tax.currencies();

    // then
    await expect(response).toHaveStatus(200);
    const currencies: CurrencyDto[] = await response.json();
    expect(currencies).toEqual(expect.arrayContaining(
      Object.values(SEEDED_CURRENCIES).map((currency) => ({ ...currency, updatedAt: expect.stringMatching(LOCAL_DATE_TIME) })),
    ));
    const codes = currencies.map((currency) => currency.code);
    expect(codes).toEqual([...codes].sort());
  });

  test('requires authentication - 401', async ({ request }) => {
    // when
    const response = await new TaxClient(request).currencies();

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});

test.describe('GET /api/v1/currencies/convert', { tag: ['@currencies'] }, () => {
  test('converts USD to EUR through the USD rates - 200', async ({ shopper }) => {
    // when
    const response = await shopper.tax.convert(100, 'USD', 'EUR');

    // then
    await expect(response).toHaveStatus(200);
    // 100 * 1 / 1.08 = 92.5925...
    expect(await response.json()).toEqual({ amount: 100, from: 'USD', to: 'EUR', converted: 92.59, rate: 0.925926 });
  });

  test('converts between two non-base currencies - 200', async ({ shopper }) => {
    // when
    const response = await shopper.tax.convert(1, 'EUR', 'PLN');

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual({ amount: 1, from: 'EUR', to: 'PLN', converted: 4.32, rate: 4.32 });
  });

  test('defaults the source currency to USD and ignores the case of codes - 200', async ({ shopper }) => {
    // when
    const response = await shopper.tax.convertWithParams({ amount: '100', to: 'eur' });

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual({ amount: 100, from: 'USD', to: 'EUR', converted: 92.59, rate: 0.925926 });
  });

  test('returns the same amount for the same currency - 200', async ({ shopper }) => {
    // when
    const response = await shopper.tax.convert('12.34', 'pln', 'PLN');

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual({ amount: 12.34, from: 'PLN', to: 'PLN', converted: 12.34, rate: 1 });
  });

  test('rounds the converted amount half up to cents - 200', async ({ shopper }) => {
    // when
    // 0.10 PLN * 0.25 = 0.025 USD exactly: half-up gives 0.03 where half-even would give 0.02.
    const response = await shopper.tax.convert('0.10', 'PLN', 'USD');

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual({ amount: 0.1, from: 'PLN', to: 'USD', converted: 0.03, rate: 0.25 });
  });

  test('converts with the exact ratio, not the rounded display rate - 200', async ({ shopper }) => {
    // when
    // 99999999.99 * 1.08 / 1.27 = 85039370.07; through the rounded rate 0.850394 it would be 85039399.99.
    const response = await shopper.tax.convert('99999999.99', 'EUR', 'GBP');

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual({ amount: 99999999.99, from: 'EUR', to: 'GBP', converted: 85039370.07, rate: 0.850394 });
  });

  test('converts a zero amount - 200', async ({ shopper }) => {
    // when
    const response = await shopper.tax.convert(0, 'USD', 'GBP');

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual({ amount: 0, from: 'USD', to: 'GBP', converted: 0, rate: 0.787402 });
  });

  const invalidRequests = [
    { title: 'a missing amount', params: { to: 'EUR' }, message: 'amount is required' },
    { title: 'a non-numeric amount', params: { amount: 'ten', to: 'EUR' }, message: 'amount must be a number' },
    { title: 'a negative amount', params: { amount: '-1', to: 'EUR' }, message: 'amount must not be negative' },
    { title: 'an amount with three decimals', params: { amount: '1.001', to: 'EUR' }, message: 'amount must have at most 2 decimals' },
    { title: 'an amount above the maximum', params: { amount: '100000000', to: 'EUR' }, message: 'amount must not exceed 99999999.99' },
    { title: 'a missing target currency', params: { amount: '1' }, message: 'to is required' },
    { title: 'a target code that is not three letters', params: { amount: '1', to: 'EURO' }, message: 'to must be a 3-letter ISO 4217 code' },
    { title: 'a source code that is not three letters', params: { amount: '1', from: 'U1D', to: 'EUR' }, message: 'from must be a 3-letter ISO 4217 code' },
  ];

  for (const { title, params, message } of invalidRequests) {
    test(`rejects ${title} - 400`, async ({ shopper }) => {
      // when
      const response = await shopper.tax.convertWithParams(params);

      // then
      await expect(response).toHaveStatus(400);
      expect(await response.json()).toEqual({ message });
    });
  }

  test('reports an unknown target currency - 404', async ({ shopper }) => {
    // given
    const code = await unusedCurrencyCode(shopper.tax);

    // when
    const response = await shopper.tax.convert(1, 'USD', code);

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual({ message: `Currency not found: ${code}` });
  });

  test('reports an unknown source currency - 404', async ({ shopper }) => {
    // given
    const code = await unusedCurrencyCode(shopper.tax);

    // when
    const response = await shopper.tax.convert(1, code.toLowerCase(), 'EUR');

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual({ message: `Currency not found: ${code}` });
  });

  test('requires authentication - 401', async ({ request }) => {
    // when
    const response = await new TaxClient(request).convert(1, 'USD', 'EUR');

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});
