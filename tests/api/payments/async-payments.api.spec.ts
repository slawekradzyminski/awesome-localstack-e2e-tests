import { test, expect } from '@fixtures';
import { TEST_CARDS } from '@api/payments.client';
import { expectedPayment, orderPayments } from '@support/payments';
import type { PaymentDto } from '@models/payment';

// The delayed test cards settle after payment-service's PAYMENT_SETTLEMENT_DELAY (10 s locally).
test.describe('POST /api/v1/payments with delayed settlement', { tag: ['@payments', '@slow'] }, () => {
  test('answers PROCESSING for 0077 and later captures it and marks the order PAID - 201', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(70);

    // when
    const response = await shopper.payments.pay(order.id, TEST_CARDS.asyncSuccess);

    // then
    await expect(response).toHaveStatus(201);
    const payment: PaymentDto = await response.json();
    expect(payment).toEqual(expectedPayment(order.id, 70, TEST_CARDS.asyncSuccess, 'PROCESSING'));
    expect(await shopper.getOrder(order.id)).toMatchObject({ status: 'PENDING' });
    expect(await shopper.waitForPaymentStatus(payment.id, 'CAPTURED'))
      .toEqual({ ...expectedPayment(order.id, 70, TEST_CARDS.asyncSuccess, 'CAPTURED'), id: payment.id });
    await shopper.waitForOrderStatus(order.id, 'PAID');
  });

  test('answers PROCESSING for 0119 and later fails it with PROVIDER_TIMEOUT, leaving the order PENDING - 201', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(70);

    // when
    const response = await shopper.payments.pay(order.id, TEST_CARDS.asyncTimeout);

    // then
    await expect(response).toHaveStatus(201);
    const payment: PaymentDto = await response.json();
    expect(payment).toEqual(expectedPayment(order.id, 70, TEST_CARDS.asyncTimeout, 'PROCESSING'));
    expect(await shopper.waitForPaymentStatus(payment.id, 'FAILED'))
      .toEqual({ ...expectedPayment(order.id, 70, TEST_CARDS.asyncTimeout, 'FAILED', 'PROVIDER_TIMEOUT'), id: payment.id });
    expect(await shopper.getOrder(order.id)).toMatchObject({ status: 'PENDING' });
  });

  test('accepts a new card once a provider timeout has settled - 201', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(70);
    const timedOut = await shopper.pay(order.id, TEST_CARDS.asyncTimeout);
    await shopper.waitForPaymentStatus(timedOut.id, 'FAILED');

    // when
    const response = await shopper.payments.pay(order.id, TEST_CARDS.mastercard);

    // then
    await expect(response).toHaveStatus(201);
    const captured: PaymentDto = await response.json();
    expect(captured).toMatchObject({ status: 'CAPTURED', cardBrand: 'MASTERCARD' });
    await shopper.waitForOrderStatus(order.id, 'PAID');
    expect((await orderPayments(shopper, order.id)).map(({ id }) => id)).toEqual([captured.id, timedOut.id]);
  });
});
