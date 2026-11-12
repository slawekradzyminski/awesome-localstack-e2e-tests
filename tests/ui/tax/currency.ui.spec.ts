import { test, expect } from '@fixtures';
import { addresses } from '@support/addresses';
import { createSearchProduct, searchToken } from '@support/search';
import { currencyWithRate } from '@support/tax';

// EUR (1 EUR = 1.08 USD) is seeded and never changed by tests; conversions are display only.
test.describe('display currency', { tag: ['@currencies'] }, () => {
  test('converts product prices and keeps the selection after a reload', async ({ api, shopperPage, productSearchPage, currencySelector }) => {
    // given
    const token = searchToken();
    await createSearchProduct(api, { name: `Headphones ${token}`, category: 'Audio', price: 100 });
    await createSearchProduct(api, { name: `Cable ${token}`, category: 'Audio', price: 19.99 });
    await productSearchPage.goto({ q: token, sort: 'price-desc' });
    await expect(productSearchPage.productPrices).toHaveText(['$100.00', '$19.99']);

    // when
    await currencySelector.choose('EUR');

    // then
    await expect(productSearchPage.productPrices).toHaveText(['€92.59', '€18.51']);

    // when
    await shopperPage.reload();

    // then
    await expect(currencySelector.select).toHaveValue('EUR');
    await expect(productSearchPage.productPrices).toHaveText(['€92.59', '€18.51']);
  });

  test('converts the cart and notes that checkout charges USD', async ({ shopper, cartPage, checkoutPage, currencySelector }) => {
    // given
    const { product } = await shopper.fillCart({ price: 100 }, 2);
    await cartPage.goto();
    await expect(cartPage.total).toHaveText('$200.00');

    // when
    await currencySelector.choose('EUR');

    // then
    // 200 / 1.08 = 185.185...
    await expect(cartPage.itemPrice(product.id)).toHaveText('€92.59');
    await expect(cartPage.itemTotal(product.id)).toHaveText('€185.19');
    await expect(cartPage.total).toHaveText('€185.19');

    // when
    await cartPage.proceedToCheckout();

    // then
    await expect(checkoutPage.payableTotal).toHaveText('€185.19');
    await expect(checkoutPage.chargedInUsd).toHaveText('Charged in USD: $200.00. EUR prices are estimates.');
  });

  test('converts the order total and its VAT breakdown', async ({ shopper, orderDetailsPage, currencySelector }) => {
    // given
    const { order } = await shopper.placeOrder(200, addresses.poland);
    expect(order).toMatchObject({ taxAmount: 37.4, netAmount: 162.6 });
    await orderDetailsPage.goto(order.id);
    await expect(orderDetailsPage.vat.root).toHaveText('Includes VAT 23% (PL): $37.40, net: $162.60');

    // when
    await currencySelector.choose('EUR');

    // then
    // 37.40 / 1.08 = 34.629..., 162.60 / 1.08 = 150.555...
    await expect(orderDetailsPage.total).toHaveText('€185.19');
    await expect(orderDetailsPage.vat.root).toHaveText('Includes VAT 23% (PL): €34.63, net: €150.56');
  });

  test('offers a currency added by the admin and puts a longer symbol after the amount', async ({ admin, api, productSearchPage, currencySelector }) => {
    // given
    const added = await currencyWithRate(admin.tax, 0.5, 'PW');
    const token = searchToken();
    await createSearchProduct(api, { name: `Widget ${token}`, category: 'Widgets', price: 10 });
    await productSearchPage.goto({ q: token });
    await expect(currencySelector.option(added.code)).toHaveText(`${added.code} (PW)`);

    // when
    await currencySelector.choose(added.code);

    // then
    await expect(productSearchPage.productPrices).toHaveText(['20.00 PW']);
  });

  test('returns to dollar prices when USD is chosen again', async ({ api, shopperPage, productSearchPage, currencySelector }) => {
    // given
    const token = searchToken();
    await createSearchProduct(api, { name: `Lamp ${token}`, category: 'Lighting', price: 54 });
    await productSearchPage.goto({ q: token });
    await currencySelector.choose('EUR');
    await expect(productSearchPage.productPrices).toHaveText(['€50.00']);

    // when
    await currencySelector.choose('USD');

    // then
    await expect(productSearchPage.productPrices).toHaveText(['$54.00']);
    await shopperPage.reload();
    await expect(currencySelector.select).toHaveValue('USD');
    await expect(productSearchPage.productPrices).toHaveText(['$54.00']);
  });
});
