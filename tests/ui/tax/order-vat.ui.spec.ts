import { test, expect } from '@fixtures';
import { addresses } from '@support/addresses';

test.describe('order details VAT', { tag: ['@tax'] }, () => {
  test('shows the rate, country, VAT and net amount contained in the total', async ({ shopper, orderDetailsPage }) => {
    // given
    const { order } = await shopper.placeOrder(100, addresses.poland);

    // when
    await orderDetailsPage.goto(order.id);

    // then
    await expect(orderDetailsPage.total).toHaveText('$100.00');
    await expect(orderDetailsPage.vat.root).toHaveText('Includes VAT 23% (PL): $18.70, net: $81.30');
    await expect(orderDetailsPage.vat.country).toHaveText('PL');
    await expect(orderDetailsPage.vat.amount).toHaveText('$18.70');
    await expect(orderDetailsPage.vat.net).toHaveText('$81.30');
  });

  test('shows a zero rate for a country without VAT', async ({ shopper, orderDetailsPage }) => {
    // given
    const { order } = await shopper.placeOrder(30, { ...addresses.poland, country: 'United States' });

    // when
    await orderDetailsPage.goto(order.id);

    // then
    await expect(orderDetailsPage.vat.root).toHaveText('Includes VAT 0% (US): $0.00, net: $30.00');
  });

  test('shows no VAT block for an order to an unknown country', async ({ shopper, orderDetailsPage }) => {
    // given
    const { order } = await shopper.placeOrder(25, { ...addresses.poland, country: 'Narnia' });

    // when
    await orderDetailsPage.goto(order.id);

    // then
    await expect(orderDetailsPage.total).toHaveText('$25.00');
    await expect(orderDetailsPage.vat.root).toBeHidden();
  });
});
