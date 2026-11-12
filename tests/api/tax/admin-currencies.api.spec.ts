import { test, expect } from '@fixtures';
import { TaxClient } from '@api/tax.client';
import { currencyWithRate, LOCAL_DATE_TIME, listCurrencies, SEEDED_CURRENCIES, unusedCurrencyCode } from '@support/tax';

test.describe('PUT /api/v1/admin/currencies/{code}', { tag: ['@currencies'] }, () => {
  test('creates a currency with a new code - 201', async ({ admin }) => {
    // given
    const code = await unusedCurrencyCode(admin.tax);

    // when
    const response = await admin.tax.upsertCurrency(code, { name: '  Playwright Coin  ', symbol: ' ₱ ', rateToUsd: 0.5 });

    // then
    await expect(response).toHaveStatus(201);
    const expected = { code, name: 'Playwright Coin', symbol: '₱', rateToUsd: 0.5, updatedAt: expect.stringMatching(LOCAL_DATE_TIME) };
    expect(await response.json()).toEqual(expected);
    expect(await listCurrencies(admin.tax)).toContainEqual(expected);
  });

  test('stores a lower-case code upper-case and converts with it - 201', async ({ admin }) => {
    // given
    const code = await unusedCurrencyCode(admin.tax);

    // when
    const response = await admin.tax.upsertCurrency(code.toLowerCase(), { name: 'Lower Coin', symbol: 'lc', rateToUsd: 2 });

    // then
    await expect(response).toHaveStatus(201);
    expect(await response.json()).toMatchObject({ code, rateToUsd: 2 });
    const conversion = await admin.tax.convert(10, code, 'USD');
    expect(await conversion.json()).toEqual({ amount: 10, from: code, to: 'USD', converted: 20, rate: 2 });
  });

  test('updates an existing currency and new conversions use the new rate - 200', async ({ admin }) => {
    // given
    const created = await currencyWithRate(admin.tax, 0.5);

    // when
    const response = await admin.tax.upsertCurrency(created.code, { name: 'Renamed Coin', symbol: 'RC', rateToUsd: 0.123456 });

    // then
    await expect(response).toHaveStatus(200);
    const expected = { code: created.code, name: 'Renamed Coin', symbol: 'RC', rateToUsd: 0.123456, updatedAt: expect.stringMatching(LOCAL_DATE_TIME) };
    expect(await response.json()).toEqual(expected);
    expect(await listCurrencies(admin.tax)).toContainEqual(expected);
    // 100 / 0.123456 = 810.0051...
    const conversion = await admin.tax.convert(100, 'USD', created.code);
    expect(await conversion.json()).toEqual({ amount: 100, from: 'USD', to: created.code, converted: 810.01, rate: 8.100052 });
  });

  const invalidBodies = [
    { title: 'a zero rate', body: { name: 'Coin', symbol: 'c', rateToUsd: 0 }, errors: { rateToUsd: 'Rate to USD must be greater than 0' } },
    { title: 'a negative rate', body: { name: 'Coin', symbol: 'c', rateToUsd: -1 }, errors: { rateToUsd: 'Rate to USD must be greater than 0' } },
    { title: 'a rate with seven decimals', body: { name: 'Coin', symbol: 'c', rateToUsd: 1.1234567 }, errors: { rateToUsd: 'Rate to USD must have at most 6 digits and 6 decimals' } },
    { title: 'a rate with seven integer digits', body: { name: 'Coin', symbol: 'c', rateToUsd: 1234567 }, errors: { rateToUsd: 'Rate to USD must have at most 6 digits and 6 decimals' } },
    { title: 'a symbol over 8 characters', body: { name: 'Coin', symbol: '123456789', rateToUsd: 1 }, errors: { symbol: 'Currency symbol cannot exceed 8 characters' } },
    { title: 'a name over 64 characters', body: { name: 'C'.repeat(65), symbol: 'c', rateToUsd: 1 }, errors: { name: 'Currency name cannot exceed 64 characters' } },
    {
      title: 'missing fields',
      body: {},
      errors: { name: 'Currency name is required', symbol: 'Currency symbol is required', rateToUsd: 'Rate to USD is required' },
    },
  ];

  for (const { title, body, errors } of invalidBodies) {
    test(`rejects ${title} without storing it - 400`, async ({ admin }) => {
      // given
      const code = await unusedCurrencyCode(admin.tax);

      // when
      const response = await admin.tax.upsertCurrency(code, body as never);

      // then
      await expect(response).toHaveStatus(400);
      expect(await response.json()).toEqual(errors);
      await expectNoCurrency(admin.tax, code);
    });
  }

  for (const code of ['EU', 'EURO', 'E1R']) {
    test(`rejects the currency code "${code}" - 400`, async ({ admin }) => {
      // when
      const response = await admin.tax.upsertCurrency(code, { name: 'Coin', symbol: 'c', rateToUsd: 1 });

      // then
      await expect(response).toHaveStatus(400);
      expect(await response.json()).toEqual({ message: 'Currency code must be a 3-letter ISO 4217 code' });
    });
  }

  test('keeps the USD base rate at 1 - 400', async ({ admin }) => {
    // when
    const response = await admin.tax.upsertCurrency('usd', { name: SEEDED_CURRENCIES.USD.name, symbol: SEEDED_CURRENCIES.USD.symbol, rateToUsd: 2 });

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ message: 'USD is the base currency; its rate to USD must be 1' });
    expect(await listCurrencies(admin.tax)).toContainEqual({ ...SEEDED_CURRENCIES.USD, updatedAt: expect.any(String) });
  });

  test('forbids a client - 403', async ({ admin, shopper }) => {
    // given
    const code = await unusedCurrencyCode(admin.tax);

    // when
    const response = await shopper.tax.upsertCurrency(code, { name: 'Coin', symbol: 'c', rateToUsd: 1 });

    // then
    await expect(response).toHaveStatus(403);
    expect(await response.json()).toEqual({ message: 'Access denied' });
    await expectNoCurrency(admin.tax, code);
  });

  test('requires authentication - 401', async ({ admin, request }) => {
    // given
    const code = await unusedCurrencyCode(admin.tax);

    // when
    const response = await new TaxClient(request).upsertCurrency(code, { name: 'Coin', symbol: 'c', rateToUsd: 1 });

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
    await expectNoCurrency(admin.tax, code);
  });
});

async function expectNoCurrency(tax: TaxClient, code: string): Promise<void> {
  expect((await listCurrencies(tax)).map((currency) => currency.code), `No currency stored for ${code}`).not.toContain(code);
}
