import { test, expect } from '@fixtures';
import { addresses } from '@support/addresses';
import { countryWithVat } from '@support/tax';

test.describe('checkout VAT preview', { tag: ['@tax'] }, () => {
  test('shows the VAT of the typed country and follows a country change', async ({ shopper, checkoutPage }) => {
    // given
    await shopper.fillCart({ price: 100 });
    await checkoutPage.goto();

    // when
    await checkoutPage.country.fill('PL');

    // then
    await expect(checkoutPage.taxLabel).toHaveText('Includes VAT 23% (PL)');
    await expect(checkoutPage.taxAmount).toHaveText('$18.70');
    await expect(checkoutPage.payableTotal).toHaveText('$100.00');

    // when
    await checkoutPage.country.fill('Germany');

    // then
    // 100 * 19 / 119 = 15.966...
    await expect(checkoutPage.taxLabel).toHaveText('Includes VAT 19% (DE)');
    await expect(checkoutPage.taxAmount).toHaveText('$15.97');
    await expect(checkoutPage.payableTotal).toHaveText('$100.00');
  });

  test('shows a decimal rate of a new country without trailing zeros', async ({ admin, shopper, checkoutPage }) => {
    // given
    const country = await countryWithVat(admin.tax, 7.5);
    await shopper.fillCart({ price: 100 });
    await checkoutPage.goto();

    // when
    await checkoutPage.country.fill(country.countryCode.toLowerCase());

    // then
    // 100 * 7.5 / 107.5 = 6.976...
    await expect(checkoutPage.taxLabel).toHaveText(`Includes VAT 7.5% (${country.countryCode})`);
    await expect(checkoutPage.taxAmount).toHaveText('$6.98');
  });

  test('explains that an unknown country is checked out without VAT', async ({ shopper, checkoutPage }) => {
    // given
    await shopper.fillCart({ price: 100 });
    await checkoutPage.goto();

    // when
    await checkoutPage.country.fill('Narnia');

    // then
    await expect(checkoutPage.taxUnavailable).toHaveText('No VAT rate for "Narnia"; the order is placed without VAT.');
    await expect(checkoutPage.taxPreview).toBeHidden();
    await expect(checkoutPage.payableTotal).toHaveText('$100.00');
  });

  test('places the order with the previewed VAT', async ({ shopper, checkoutPage, orderDetailsPage }) => {
    // given
    await shopper.fillCart({ price: 100 });
    await checkoutPage.goto();
    await checkoutPage.fillAddress(addresses.poland);
    await expect(checkoutPage.taxLabel).toHaveText('Includes VAT 23% (PL)');
    await expect(checkoutPage.taxAmount).toHaveText('$18.70');

    // when
    const orderId = await checkoutPage.placeOrder();

    // then
    expect(await shopper.getOrder(orderId)).toMatchObject({ totalAmount: 100, taxCountry: 'PL', taxRate: 23, taxAmount: 18.7, netAmount: 81.3 });
    await orderDetailsPage.goto(orderId);
    await expect(orderDetailsPage.vat.root).toHaveText('Includes VAT 23% (PL): $18.70, net: $81.30');
  });
});
