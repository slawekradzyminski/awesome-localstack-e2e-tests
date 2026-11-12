import { test, expect } from '@fixtures';
import { addresses } from '@support/addresses';

// Regression for bugs/BUG-CHECKOUT-01: placing an order must always lead to its payment page, also on a slow
// device where the emptied cart is refetched before the payment page has replaced the checkout.
test.describe('checkout to payment', { tag: ['@payments'] }, () => {
  test('placing an order opens its payment page on a slow device', async ({ shopper, page, checkoutPage, paymentPage }) => {
    // given
    await shopper.fillCart({ price: 30 });
    await checkoutPage.goto();
    await checkoutPage.fillAddress(addresses.poland);
    // a slow device: Chromium runs the page's JavaScript 6x slower, like a busy CI runner
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });

    // when
    const orderId = await checkoutPage.placeOrder();

    // then
    await paymentPage.expectOpenFor(orderId);
    await expect(paymentPage.cardForm.root).toBeVisible();
    await expect(page).toHaveURL(`/orders/${orderId}/pay`);
  });
});
