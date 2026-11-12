import { test, expect } from '@fixtures';
import { TEST_CARDS, THREE_DS_CODE } from '@api/payments.client';
import { PublicTrackingPage } from '@pages/shop/public-tracking.page';
import { addresses } from '@support/addresses';
import { InboxReceiver, isSignedWith } from '@support/webhooks';

// The whole storefront story in a browser, with the services that work behind it checked through the API:
// search (backend) -> cart with a gift card -> checkout with VAT -> 3-D Secure card payment (payment-service)
// -> PAID through the signed result notification -> shipped and delivered (warehouse-service carrier)
// -> visible to the customer and on the public tracking page; webhooks fire along the way.
test.describe('storefront journey', { tag: ['@journey', '@slow'] }, () => {
  test('a customer finds a product, pays with a gift card and 3-D Secure, and follows the parcel to the door', async ({
    api, browser, shopper, admin, warehouse, productSearchPage, cartPage, checkoutPage, paymentPage, orderDetailsPage,
  }) => {
    // given
    const product = await api.createProduct({ name: `Journey lamp ${test.info().testId}`, price: 80, stockQuantity: 5 });
    const giftCard = await admin.issueGiftCard({ amount: 20 });
    const webhooks = await InboxReceiver.subscribe(shopper, ['order.paid', 'shipment.delivered']);

    await test.step('find the product and put it in the cart', async () => {
      await productSearchPage.goto();
      await productSearchPage.search(product.name);
      await productSearchPage.product(product.name).addToCart();
      await expect(productSearchPage.product(product.name).cartQuantity).toContainText('1');
    });

    await test.step('apply the gift card in the cart', async () => {
      await cartPage.goto();
      await cartPage.giftCard.apply(giftCard.code);
      await expect(cartPage.summary.amountDue).toHaveText('$60.00');
    });

    const orderId = await test.step('check out to Poland, VAT included', async () => {
      await cartPage.proceedToCheckout();
      await checkoutPage.fillAddress(addresses.poland);
      await expect(checkoutPage.taxLabel).toHaveText('Includes VAT 23% (PL)');
      await expect(checkoutPage.summary.amountDue).toHaveText('$60.00');
      return checkoutPage.placeOrder();
    });

    await test.step('pay the rest with a 3-D Secure card', async () => {
      await paymentPage.expectOpenFor(orderId);
      await expect(paymentPage.amountDue).toHaveText('$60.00');
      await paymentPage.cardForm.payWith({ number: TEST_CARDS.threeDs });
      await paymentPage.threeDs.verify(THREE_DS_CODE);
      await expect(paymentPage.successDetails).toContainText('$60.00 was charged to Visa •••• 3220');
    });

    // then: the backend marked the order PAID from payment-service's signed result
    const paid = await shopper.waitForOrderStatus(orderId, 'PAID');
    expect(paid).toMatchObject({ totalAmount: 80, giftCardAmount: 20, amountDue: 60, taxCountry: 'PL', taxRate: 23 });
    expect((await shopper.giftCards.balance(giftCard.code).then(response => response.json())).balance).toBe(0);
    expect((await shopper.loyaltyAccount()).balance).toBe(80);
    const paidEvent = await webhooks.waitFor('order.paid', orderId);
    expect(isSignedWith(webhooks.secret, paidEvent)).toBe(true);

    // when: the warehouse ships it and the carrier delivers
    const trackingNumber = await test.step('the warehouse ships it and the carrier delivers', async () => {
      const shipment = await warehouse.shipSimulated(orderId);
      await warehouse.advanceUntil(shipment, 'DELIVERED');
      return shipment.trackingNumber!;
    });

    // then
    await test.step('the customer sees the delivered order', async () => {
      await shopper.waitForOrderStatus(orderId, 'DELIVERED');
      await orderDetailsPage.goto(orderId);
      await expect(orderDetailsPage.status).toHaveText('DELIVERED');
      await expect(orderDetailsPage.shipment.timeline.currentStatus).toHaveText('Delivered');
      await expect(orderDetailsPage.shipment.timeline.trackingNumber).toHaveText(trackingNumber);
    });

    await test.step('anyone can track the parcel without signing in', async () => {
      const anonymous = await browser.newContext();
      try {
        const publicTracking = new PublicTrackingPage(await anonymous.newPage());
        await publicTracking.goto(trackingNumber);
        await expect(publicTracking.timeline.currentStatus).toHaveText('Delivered');
      } finally {
        await anonymous.close();
      }
    });

    const delivered = await webhooks.waitFor('shipment.delivered', orderId);
    expect(isSignedWith(webhooks.secret, delivered)).toBe(true);
  });
});
