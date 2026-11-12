import { test, expect } from '@fixtures';
import { addresses } from '@support/addresses';
import { applyGiftCard, applyPoints, earnPoints, giftCardDetails } from '@support/tenders';

test.describe('checkout and payment with a gift card and points', { tag: ['@gift-cards', '@loyalty'] }, () => {
  test('checkout lists the tenders, charges only the amount due and the payment page repeats them', async ({ shopper, admin, checkoutPage, paymentPage }) => {
    test.fixme(true, 'bugs/BUG-CHECKOUT-01-placed-order-redirects-to-empty-cart.md');
    // given
    await earnPoints(shopper, 500);
    const card = await admin.issueGiftCard({ amount: 10 });
    await shopper.fillCart({ price: 20 });
    await applyGiftCard(shopper, card.code);
    await applyPoints(shopper, 500);
    await checkoutPage.goto();
    await expect(checkoutPage.cartTotal).toHaveText('$20.00');
    await expect(checkoutPage.summary.giftCard).toHaveText('−$10.00');
    await expect(checkoutPage.summary.points).toHaveText('−$5.00');
    await expect(checkoutPage.summary.amountDue).toHaveText('$5.00');
    await expect(checkoutPage.payableTotal).toHaveText('$5.00');

    // when
    await checkoutPage.fillAddress(addresses.poland);
    const orderId = await checkoutPage.placeOrder();

    // then
    await paymentPage.expectOpenFor(orderId);
    await expect(paymentPage.total).toHaveText('$20.00');
    await expect(paymentPage.giftCard).toHaveText('−$10.00');
    await expect(paymentPage.points).toHaveText('−$5.00');
    await expect(paymentPage.amountDue).toHaveText('$5.00');
    await expect(paymentPage.cardForm.root).toBeVisible();
    expect(await shopper.getOrder(orderId)).toMatchObject({
      status: 'PENDING', giftCardCode: card.code, giftCardAmount: 10, pointsRedeemed: 500, pointsAmount: 5, amountDue: 5,
    });
    expect((await giftCardDetails(admin, card.code)).balance).toBe(0);
    expect((await shopper.loyaltyAccount()).balance).toBe(0);
  });

  test('an order covered by the gift card shows the paid-by-tenders state instead of a card form', async ({ shopper, admin, paymentPage }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 50 });
    await shopper.fillCart({ price: 30 });
    await applyGiftCard(shopper, card.code);
    const order = await shopper.checkout();
    await shopper.waitForOrderStatus(order.id, 'PAID');

    // when
    await paymentPage.goto(order.id);

    // then
    await expect(paymentPage.paidByTenders).toHaveText('Paid with gift card / points. Nothing is left to pay by card.');
    await expect(paymentPage.cardForm.root).toBeHidden();
    await expect(paymentPage.giftCard).toHaveText('−$30.00');
    await expect(paymentPage.points).toBeHidden();
    await expect(paymentPage.amountDue).toHaveText('$0.00');
  });

  test('a cancelled order paid partly with points says there is nothing to pay', async ({ shopper, paymentPage }) => {
    // given
    await earnPoints(shopper, 300);
    await shopper.fillCart({ price: 20 });
    await applyPoints(shopper, 300);
    const order = await shopper.checkout();
    await expect(await shopper.orders.cancel(order.id)).toHaveStatus(200);

    // when
    await paymentPage.goto(order.id);

    // then
    await expect(paymentPage.cancelled).toHaveText('This order was cancelled, so there is nothing to pay.');
    await expect(paymentPage.points).toHaveText('−$3.00');
    await expect(paymentPage.amountDue).toHaveText('$17.00');
    expect((await shopper.loyaltyAccount()).balance).toBe(300);
  });
});
