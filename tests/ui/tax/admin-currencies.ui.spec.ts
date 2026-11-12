import { test, expect } from '@fixtures';
import { currencyWithRate, listCurrencies, unusedCurrencyCode } from '@support/tax';
import { holdResponses, recordWrites } from '@support/network';

// Only currencies the test creates are edited; the seeded ones are read.
test.describe('admin currencies page', { tag: ['@currencies'] }, () => {
  test('lists the currencies with USD marked as the base', async ({ adminCurrenciesPage }) => {
    // given

    // when
    await adminCurrenciesPage.goto();

    // then
    await expect(adminCurrenciesPage.heading).toBeVisible();
    await expect(adminCurrenciesPage.row('USD')).toContainText('US Dollar');
    await expect(adminCurrenciesPage.baseBadge('USD')).toHaveText('Base');
    await expect(adminCurrenciesPage.rate('USD')).toHaveText('1');
    await expect(adminCurrenciesPage.rate('EUR')).toHaveText('1.08');
    await expect(adminCurrenciesPage.baseBadge('EUR')).toHaveCount(0);
  });

  test('locks the USD rate in its editor', async ({ adminCurrenciesPage }) => {
    // given
    await adminCurrenciesPage.goto();

    // when
    const editor = await adminCurrenciesPage.edit('USD');

    // then
    await expect(editor.rate).toHaveAttribute('readonly', '');
    await expect(adminCurrenciesPage.baseCurrencyNote).toBeVisible();
    await editor.cancel();
    await expect(adminCurrenciesPage.rate('USD')).toHaveText('1');
  });

  test('edits a currency', async ({ admin, adminCurrenciesPage }) => {
    // given
    const currency = await currencyWithRate(admin.tax, 0.5);
    await adminCurrenciesPage.goto();
    const editor = await adminCurrenciesPage.edit(currency.code);

    // when
    await editor.name.fill('Edited Coin');
    await editor.symbol.fill('EC');
    await editor.rate.fill('0.654321');
    await editor.save();

    // then
    await expect(adminCurrenciesPage.rate(currency.code)).toHaveText('0.654321');
    await expect(adminCurrenciesPage.row(currency.code)).toContainText('Edited Coin');
    expect(await listCurrencies(admin.tax)).toContainEqual(expect.objectContaining({ code: currency.code, name: 'Edited Coin', symbol: 'EC', rateToUsd: 0.654321 }));
  });

  test('rejects a zero rate without saving it', async ({ admin, adminCurrenciesPage }) => {
    // given
    const currency = await currencyWithRate(admin.tax, 0.5);
    await adminCurrenciesPage.goto();
    const editor = await adminCurrenciesPage.edit(currency.code);

    // when
    await editor.rate.fill('0');
    await editor.save();

    // then
    await expect(editor.rateError).toHaveText('Rate must be above 0 and at most 999999.999999');
    expect(await listCurrencies(admin.tax)).toContainEqual(currency);
  });

  test('adds a currency', async ({ admin, adminCurrenciesPage }) => {
    // given
    const code = await unusedCurrencyCode(admin.tax);
    await adminCurrenciesPage.goto();

    // when
    await adminCurrenciesPage.addCurrency(code.toLowerCase(), 'Playwright UI Coin', 'Ƥ', '2.5');

    // then
    await expect(adminCurrenciesPage.rate(code)).toHaveText('2.5');
    await expect(adminCurrenciesPage.row(code)).toContainText('Playwright UI Coin');
    expect(await listCurrencies(admin.tax)).toContainEqual(expect.objectContaining({ code, name: 'Playwright UI Coin', symbol: 'Ƥ', rateToUsd: 2.5 }));
  });

  test('validates the new currency form before sending it', async ({ adminPage, adminCurrenciesPage }) => {
    // given
    await adminCurrenciesPage.goto();
    const writes = recordWrites(adminPage);

    // when
    await adminCurrenciesPage.addCurrency('E1', 'Coin', '123456789', '1.1234567');

    // then
    await expect(adminCurrenciesPage.newError('code')).toHaveText('Use a 3-letter ISO currency code');
    await expect(adminCurrenciesPage.newError('rateToUsd')).toHaveText('Use at most 6 decimal places');
    expect(writes).toEqual([]);
  });
});

test.describe('admin currencies page while the list loads', { tag: ['@currencies'] }, () => {
  test('shows a currency saved before the first list response arrived', async ({ admin, adminPage, adminCurrenciesPage }) => {
    test.fixme(true, 'bugs/BUG-TAX-01-admin-list-misses-save-during-first-load.md');
    // given
    const code = await unusedCurrencyCode(admin.tax);
    const listResponse = holdResponses(adminPage, '**/api/v1/currencies');
    await adminCurrenciesPage.open();
    const saved = adminPage.waitForResponse((response) => response.request().method() === 'PUT' && response.url().endsWith(`/admin/currencies/${code}`));

    // when
    await adminCurrenciesPage.addCurrency(code, 'Raced Coin', 'RC', '3');
    await expect(await saved).toHaveStatus(201);
    listResponse.release();

    // then
    await expect(adminCurrenciesPage.rate(code)).toHaveText('3');
  });
});
