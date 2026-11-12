import { test, expect } from '@fixtures';
import { TaxClient } from '@api/tax.client';
import { addresses } from '@support/addresses';
import { countryWithVat, getVatRate, LOCAL_DATE_TIME, listVatRates, unusedCountryCode, vatBreakdown } from '@support/tax';

test.describe('PUT /api/v1/admin/vat-rates/{countryCode}', { tag: ['@tax'] }, () => {
  test('creates a rate for a new country code - 201', async ({ admin }) => {
    // given
    const code = await unusedCountryCode(admin.tax);

    // when
    const response = await admin.tax.upsertVatRate(code, { countryName: '  Playwright Land  ', rate: 7.5 });

    // then
    await expect(response).toHaveStatus(201);
    const expected = { countryCode: code, countryName: 'Playwright Land', rate: 7.5, updatedAt: expect.stringMatching(LOCAL_DATE_TIME) };
    expect(await response.json()).toEqual(expected);
    expect(await getVatRate(admin.tax, code)).toEqual(expected);
    expect(await listVatRates(admin.tax)).toContainEqual(expected);
  });

  test('stores a lower-case country code upper-case - 201', async ({ admin }) => {
    // given
    const code = await unusedCountryCode(admin.tax);

    // when
    const response = await admin.tax.upsertVatRate(code.toLowerCase(), { countryName: 'Lower Land', rate: 12 });

    // then
    await expect(response).toHaveStatus(201);
    expect(await response.json()).toMatchObject({ countryCode: code, rate: 12 });
    expect(await getVatRate(admin.tax, code)).toMatchObject({ countryCode: code, countryName: 'Lower Land', rate: 12 });
  });

  test('updates the rate and name of an existing country - 200', async ({ admin }) => {
    // given
    const created = await countryWithVat(admin.tax, 10);

    // when
    const response = await admin.tax.upsertVatRate(created.countryCode, { countryName: 'Renamed Land', rate: 21.25 });

    // then
    await expect(response).toHaveStatus(200);
    const expected = { countryCode: created.countryCode, countryName: 'Renamed Land', rate: 21.25, updatedAt: expect.stringMatching(LOCAL_DATE_TIME) };
    expect(await response.json()).toEqual(expected);
    expect(await getVatRate(admin.tax, created.countryCode)).toEqual(expected);
  });

  test('accepts the bounds 0 and 50 - 200', async ({ admin }) => {
    // given
    const created = await countryWithVat(admin.tax, 10);

    // when
    const zero = await admin.tax.upsertVatRate(created.countryCode, { countryName: created.countryName, rate: 0 });
    const fifty = await admin.tax.upsertVatRate(created.countryCode, { countryName: created.countryName, rate: 50 });

    // then
    await expect(zero).toHaveStatus(200);
    expect(await zero.json()).toMatchObject({ rate: 0 });
    await expect(fifty).toHaveStatus(200);
    expect(await fifty.json()).toMatchObject({ rate: 50 });
    expect(await getVatRate(admin.tax, created.countryCode)).toMatchObject({ rate: 50 });
  });

  test('applies a new rate to orders placed afterwards - 201', async ({ admin, shopper }) => {
    // given
    const country = await countryWithVat(admin.tax, 25);
    await shopper.fillCart({ price: 50 });

    // when
    const order = await shopper.checkout({ ...addresses.poland, country: country.countryCode });

    // then
    const expected = { totalAmount: 50, taxCountry: country.countryCode, taxRate: 25, taxAmount: 10, netAmount: 40 };
    expect(order).toMatchObject(expected);
    expect(await shopper.getOrder(order.id)).toMatchObject(expected);
  });

  test('leaves the rate of existing orders unchanged - 200', async ({ admin, shopper }) => {
    // given
    const country = await countryWithVat(admin.tax, 25);
    const { order } = await shopper.placeOrder(50, { ...addresses.poland, country: country.countryCode });

    // when
    const response = await admin.tax.upsertVatRate(country.countryCode, { countryName: country.countryName, rate: 5 });

    // then
    await expect(response).toHaveStatus(200);
    expect(await shopper.getOrder(order.id)).toMatchObject({ taxRate: 25, taxAmount: 10, netAmount: 40, totalAmount: 50 });
    const { order: newer } = await shopper.placeOrder(21, { ...addresses.poland, country: country.countryCode });
    expect(newer).toMatchObject({ taxRate: 5, ...vatBreakdown(21, 5), totalAmount: 21 });
  });

  const invalidBodies = [
    { title: 'a rate above 50', body: { countryName: 'Land', rate: 50.01 }, errors: { rate: 'Rate must be between 0 and 50' } },
    { title: 'a negative rate', body: { countryName: 'Land', rate: -1 }, errors: { rate: 'Rate must be between 0 and 50' } },
    { title: 'a rate with three decimals', body: { countryName: 'Land', rate: 7.125 }, errors: { rate: 'Rate must have at most 2 decimals' } },
    { title: 'a blank country name', body: { countryName: '   ', rate: 7 }, errors: { countryName: 'Country name is required' } },
    { title: 'a country name over 64 characters', body: { countryName: 'L'.repeat(65), rate: 7 }, errors: { countryName: 'Country name cannot exceed 64 characters' } },
    { title: 'missing fields', body: {}, errors: { countryName: 'Country name is required', rate: 'Rate is required' } },
  ];

  for (const { title, body, errors } of invalidBodies) {
    test(`rejects ${title} without storing it - 400`, async ({ admin }) => {
      // given
      const code = await unusedCountryCode(admin.tax);

      // when
      const response = await admin.tax.upsertVatRate(code, body as never);

      // then
      await expect(response).toHaveStatus(400);
      expect(await response.json()).toEqual(errors);
      await expectNoRate(admin.tax, code);
    });
  }

  for (const code of ['P1', 'POL', 'P']) {
    test(`rejects the country code "${code}" - 400`, async ({ admin }) => {
      // when
      const response = await admin.tax.upsertVatRate(code, { countryName: 'Land', rate: 7 });

      // then
      await expect(response).toHaveStatus(400);
      expect(await response.json()).toEqual({ message: 'Country code must be an ISO 3166-1 alpha-2 code' });
    });
  }

  test('forbids a client - 403', async ({ admin, shopper }) => {
    // given
    const code = await unusedCountryCode(admin.tax);

    // when
    const response = await shopper.tax.upsertVatRate(code, { countryName: 'Unauthorised Land', rate: 1 });

    // then
    await expect(response).toHaveStatus(403);
    expect(await response.json()).toEqual({ message: 'Access denied' });
    await expectNoRate(admin.tax, code);
  });

  test('requires authentication - 401', async ({ admin, request }) => {
    // given
    const code = await unusedCountryCode(admin.tax);

    // when
    const response = await new TaxClient(request).upsertVatRate(code, { countryName: 'Unauthorised Land', rate: 1 });

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
    await expectNoRate(admin.tax, code);
  });
});

async function expectNoRate(tax: TaxClient, code: string): Promise<void> {
  const response = await tax.vatRate(code);
  await expect(response, `No VAT rate stored for ${code}`).toHaveStatus(404);
}
