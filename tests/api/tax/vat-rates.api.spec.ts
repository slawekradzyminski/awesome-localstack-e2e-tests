import { test, expect } from '@fixtures';
import { TaxClient } from '@api/tax.client';
import { LOCAL_DATE_TIME, SEEDED_VAT, unusedCountryCode } from '@support/tax';
import type { VatRateDto } from '@models/tax';

test.describe('GET /api/v1/vat-rates', { tag: ['@tax'] }, () => {
  test('lists the seeded rates ordered by country code - 200', async ({ shopper }) => {
    // when
    const response = await shopper.tax.vatRates();

    // then
    await expect(response).toHaveStatus(200);
    const rates: VatRateDto[] = await response.json();
    expect(rates).toEqual(expect.arrayContaining([
      { ...SEEDED_VAT.PL, updatedAt: expect.stringMatching(LOCAL_DATE_TIME) },
      { ...SEEDED_VAT.DE, updatedAt: expect.stringMatching(LOCAL_DATE_TIME) },
      { ...SEEDED_VAT.US, updatedAt: expect.stringMatching(LOCAL_DATE_TIME) },
    ]));
    const codes = rates.map((rate) => rate.countryCode);
    expect(codes).toEqual([...codes].sort());
  });

  test('requires authentication - 401', async ({ request }) => {
    // when
    const response = await new TaxClient(request).vatRates();

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});

test.describe('GET /api/v1/vat-rates/{country}', { tag: ['@tax'] }, () => {
  const lookups = [
    { country: 'PL', expected: SEEDED_VAT.PL, kind: 'alpha-2 code' },
    { country: 'pl', expected: SEEDED_VAT.PL, kind: 'lower-case alpha-2 code' },
    { country: 'POLAND', expected: SEEDED_VAT.PL, kind: 'upper-case English name' },
    { country: 'Polska', expected: SEEDED_VAT.PL, kind: 'native name' },
    { country: 'deu', expected: SEEDED_VAT.DE, kind: 'alpha-3 code' },
    { country: 'germany', expected: SEEDED_VAT.DE, kind: 'lower-case English name' },
  ];

  for (const { country, expected, kind } of lookups) {
    test(`resolves the ${kind} "${country}" to ${expected.countryCode} - 200`, async ({ shopper }) => {
      // when
      const response = await shopper.tax.vatRate(country);

      // then
      await expect(response).toHaveStatus(200);
      expect(await response.json()).toEqual({ ...expected, updatedAt: expect.stringMatching(LOCAL_DATE_TIME) });
    });
  }

  test('reports a country without a configured rate - 404', async ({ shopper }) => {
    // given
    const code = await unusedCountryCode(shopper.tax);

    // when
    const response = await shopper.tax.vatRate(code);

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual({ message: `VAT rate not found for country: ${code}` });
  });

  test('reports an unrecognised country name - 404', async ({ shopper }) => {
    // when
    const response = await shopper.tax.vatRate('Narnia');

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual({ message: 'VAT rate not found for country: Narnia' });
  });

  test('requires authentication - 401', async ({ request }) => {
    // when
    const response = await new TaxClient(request).vatRate('PL');

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});
