import { test, expect } from '@fixtures';
import { TEST_CARDS } from '@api/payments.client';
import { OrderDetailsPage } from '@pages/shop/order-details.page';

test.describe('Order details payment panel', { tag: ['@payments'] }, () => {
  test('shows the latest attempt and every attempt with its status', async ({ shopper, orderDetailsPage }) => {
    // given
    const { order } = await shopper.placeOrder(27);
    const declined = await shopper.pay(order.id, TEST_CARDS.declined);
    const captured = await shopper.payAndWaitForPaid(order.id, TEST_CARDS.mastercard);

    // when
    await orderDetailsPage.goto(order.id);

    // then
    await expect(orderDetailsPage.status).toHaveText('PAID');
    await expect(orderDetailsPage.payment.status).toHaveText('Captured');
    await expect(orderDetailsPage.payment.card).toHaveText('Mastercard •••• 4444');
    await expect(orderDetailsPage.payment.amount).toHaveText('$27.00');
    await expect(orderDetailsPage.payment.failure).toBeHidden();
    await expect(orderDetailsPage.payment.attempts).toHaveCount(2);
    await expect(orderDetailsPage.payment.attempts.nth(0)).toContainText('Mastercard •••• 4444');
    await expect(orderDetailsPage.payment.attempts.nth(1)).toContainText('Visa •••• 0002');
    await expect(orderDetailsPage.payment.attemptStatus(captured.id)).toHaveText('Captured');
    await expect(orderDetailsPage.payment.attemptStatus(declined.id)).toHaveText('Failed');
  });

  test('explains a failed latest attempt and still offers Pay now', async ({ shopper, orderDetailsPage }) => {
    // given
    const { order } = await shopper.placeOrder(27);
    await shopper.pay(order.id, TEST_CARDS.insufficientFunds);

    // when
    await orderDetailsPage.goto(order.id);

    // then
    await expect(orderDetailsPage.status).toHaveText('PENDING');
    await expect(orderDetailsPage.payment.status).toHaveText('Failed');
    await expect(orderDetailsPage.payment.failure).toHaveText('The card has insufficient funds. Try another card.');
    await expect(orderDetailsPage.payment.awaiting).toHaveText('Awaiting payment of $27.00.');
    await expect(orderDetailsPage.payment.payNowLink).toBeVisible();
  });

  test('shows a payment waiting for 3-D Secure', async ({ shopper, orderDetailsPage }) => {
    // given
    const { order } = await shopper.placeOrder(27);
    await shopper.pay(order.id, TEST_CARDS.threeDs);

    // when
    await orderDetailsPage.goto(order.id);

    // then
    await expect(orderDetailsPage.payment.status).toHaveText('Needs verification');
    await expect(orderDetailsPage.payment.card).toHaveText('Visa •••• 3220');
  });

  test('does not offer Pay now on a cancelled order', async ({ shopper, orderDetailsPage }) => {
    // given
    const { order } = await shopper.placeOrder(27);
    await expect(await shopper.orders.cancel(order.id)).toHaveStatus(200);

    // when
    await orderDetailsPage.goto(order.id);

    // then
    await expect(orderDetailsPage.status).toHaveText('CANCELLED');
    await expect(orderDetailsPage.payment.none).toHaveText('No card payments yet.');
    await expect(orderDetailsPage.payment.payNowLink).toBeHidden();
    await expect(orderDetailsPage.payment.awaiting).toBeHidden();
  });

  test("does not offer Pay now to an admin viewing a customer's PENDING order", async ({ adminPage, shopper }) => {
    // given
    const { order } = await shopper.placeOrder(27);
    const orderDetailsPage = new OrderDetailsPage(adminPage);

    // when
    await orderDetailsPage.goto(order.id);

    // then
    await expect(orderDetailsPage.status).toHaveText('PENDING');
    await expect(orderDetailsPage.payment.awaiting).toHaveText('Awaiting payment of $27.00.');
    await expect(orderDetailsPage.payment.none).toBeVisible();
    await expect(orderDetailsPage.payment.payNowLink).toBeHidden();
  });
});
