import { test, expect } from '@fixtures';
import { countryWithVat, getVatRate, unusedCountryCode } from '@support/tax';
import { holdResponses, recordWrites } from '@support/network';

// Only rows the test creates are edited; the seeded PL and DE rows are read.
test.describe('admin VAT rates page', { tag: ['@tax'] }, () => {
  test('lists the configured rates', async ({ adminVatRatesPage }) => {
    // given

    // when
    await adminVatRatesPage.goto();

    // then
    await expect(adminVatRatesPage.heading).toBeVisible();
    await expect(adminVatRatesPage.row('PL')).toContainText('Poland');
    await expect(adminVatRatesPage.rate('PL')).toHaveText('23%');
    await expect(adminVatRatesPage.row('DE')).toContainText('Germany');
    await expect(adminVatRatesPage.rate('DE')).toHaveText('19%');
  });

  test('edits the rate of a row', async ({ admin, adminVatRatesPage }) => {
    // given
    const country = await countryWithVat(admin.tax, 10);
    await adminVatRatesPage.goto();
    const editor = await adminVatRatesPage.edit(country.countryCode);
    await expect(editor.countryCode).toHaveValue(country.countryCode);
    await expect(editor.countryCode).toHaveAttribute('readonly', '');

    // when
    await editor.countryName.fill('Edited Land');
    await editor.rate.fill('12.5');
    await editor.save();

    // then
    await expect(adminVatRatesPage.rate(country.countryCode)).toHaveText('12.5%');
    await expect(adminVatRatesPage.row(country.countryCode)).toContainText('Edited Land');
    expect(await getVatRate(admin.tax, country.countryCode)).toMatchObject({ countryName: 'Edited Land', rate: 12.5 });
  });

  test('rejects a rate above 50 without saving it', async ({ admin, adminVatRatesPage }) => {
    // given
    const country = await countryWithVat(admin.tax, 10);
    await adminVatRatesPage.goto();
    const editor = await adminVatRatesPage.edit(country.countryCode);

    // when
    await editor.rate.fill('60');
    await editor.save();

    // then
    await expect(editor.rateError).toHaveText('Rate must be between 0 and 50');
    expect(await getVatRate(admin.tax, country.countryCode)).toEqual(country);
  });

  test('discards an edit on cancel', async ({ admin, adminVatRatesPage }) => {
    // given
    const country = await countryWithVat(admin.tax, 10);
    await adminVatRatesPage.goto();
    const editor = await adminVatRatesPage.edit(country.countryCode);
    await editor.rate.fill('33');

    // when
    await editor.cancel();

    // then
    await expect(adminVatRatesPage.rate(country.countryCode)).toHaveText('10%');
    expect(await getVatRate(admin.tax, country.countryCode)).toEqual(country);
  });

  test('adds a new country', async ({ admin, adminVatRatesPage }) => {
    // given
    const code = await unusedCountryCode(admin.tax);
    await adminVatRatesPage.goto();

    // when
    await adminVatRatesPage.addCountry(code.toLowerCase(), 'Playwright UI Land', '9');

    // then
    await expect(adminVatRatesPage.rate(code)).toHaveText('9%');
    await expect(adminVatRatesPage.row(code)).toContainText('Playwright UI Land');
    await expect(adminVatRatesPage.newCountryCode).toHaveValue('');
    expect(await getVatRate(admin.tax, code)).toMatchObject({ countryCode: code, countryName: 'Playwright UI Land', rate: 9 });
  });

  test('validates the new country form before sending it', async ({ adminPage, adminVatRatesPage }) => {
    // given
    await adminVatRatesPage.goto();
    const writes = recordWrites(adminPage);

    // when
    await adminVatRatesPage.addCountry('P1', ' ', '7.125');

    // then
    await expect(adminVatRatesPage.newError('countryCode')).toHaveText('Use a 2-letter ISO country code');
    await expect(adminVatRatesPage.newError('countryName')).toHaveText('Country name is required');
    await expect(adminVatRatesPage.newError('rate')).toHaveText('Use at most 2 decimal places');
    expect(writes).toEqual([]);
  });
});

test.describe('admin VAT rates page while the list loads', { tag: ['@tax'] }, () => {
  test('shows a country saved before the first list response arrived', async ({ admin, adminPage, adminVatRatesPage }) => {
    test.fixme(true, 'bugs/BUG-TAX-01-admin-list-misses-save-during-first-load.md');
    // given
    const code = await unusedCountryCode(admin.tax);
    const listResponse = holdResponses(adminPage, '**/api/v1/vat-rates');
    await adminVatRatesPage.open();
    const saved = adminPage.waitForResponse((response) => response.request().method() === 'PUT' && response.url().endsWith(`/admin/vat-rates/${code}`));

    // when
    await adminVatRatesPage.addCountry(code, 'Raced Land', '9');
    await expect(await saved).toHaveStatus(201);
    listResponse.release();

    // then
    await expect(adminVatRatesPage.rate(code)).toHaveText('9%');
  });
});
