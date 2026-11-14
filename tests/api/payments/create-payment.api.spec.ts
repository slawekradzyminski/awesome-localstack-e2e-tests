import { test, expect } from '@fixtures';
import { InboxReceiver } from '@support/webhooks';
import { TEST_CARDS } from '@api/payments.client';
import { PAYMENT_FIELDS, expectedPayment, orderPayments } from '@support/payments';
import type { PaymentDto } from '@models/payment';

test.describe('POST /api/v1/payments', { tag: ['@payments'] }, () => {
  const capturingCards = [
    { brand: 'Visa', number: TEST_CARDS.visa },
    { brand: 'Mastercard', number: TEST_CARDS.mastercard },
  ];

  for (const { brand, number } of capturingCards) {
    test(`captures a ${brand} card and marks the order PAID - 201`, async ({ shopper }) => {
      // given
      const { order } = await shopper.placeOrder(64.5);

      // when
      const response = await shopper.payments.pay(order.id, number);

      // then
      await expect(response).toHaveStatus(201);
      const payment: PaymentDto = await response.json();
      expect(payment).toEqual(expectedPayment(order.id, 64.5, number, 'CAPTURED'));
      expect(await shopper.getPayment(payment.id)).toEqual(expectedPayment(order.id, 64.5, number, 'CAPTURED'));
      await shopper.waitForOrderStatus(order.id, 'PAID');
    });
  }

  const failingCards = [
    { reason: 'a declined card', number: TEST_CARDS.declined, failureCode: 'CARD_DECLINED' },
    { reason: 'a card with insufficient funds', number: TEST_CARDS.insufficientFunds, failureCode: 'INSUFFICIENT_FUNDS' },
  ] as const;

  for (const { reason, number, failureCode } of failingCards) {
    test(`records ${reason} as FAILED ${failureCode} and leaves the order PENDING - 201`, async ({ shopper }) => {
      // given
      const { order } = await shopper.placeOrder(30);

      // when
      const response = await shopper.payments.pay(order.id, number);

      // then
      await expect(response).toHaveStatus(201);
      const payment: PaymentDto = await response.json();
      expect(payment).toEqual(expectedPayment(order.id, 30, number, 'FAILED', failureCode));
      expect(await orderPayments(shopper, order.id)).toEqual([expectedPayment(order.id, 30, number, 'FAILED', failureCode)]);
      expect(await shopper.getOrder(order.id)).toMatchObject({ status: 'PENDING' });
    });
  }

  test('asks for 3-D Secure and keeps the order PENDING until it is answered - 201', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(45);

    // when
    const response = await shopper.payments.pay(order.id, TEST_CARDS.threeDs);

    // then
    await expect(response).toHaveStatus(201);
    const payment: PaymentDto = await response.json();
    expect(payment).toEqual(expectedPayment(order.id, 45, TEST_CARDS.threeDs, 'REQUIRES_ACTION'));
    expect(await shopper.getPayment(payment.id)).toMatchObject({ status: 'REQUIRES_ACTION' });
    expect(await shopper.getOrder(order.id)).toMatchObject({ status: 'PENDING' });
  });

  test('returns only the card brand and last four digits, never the number or CVC - 201', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(12);

    // when
    const response = await shopper.payments.pay(order.id, TEST_CARDS.mastercard);

    // then
    await expect(response).toHaveStatus(201);
    const body = await response.text();
    expect(Object.keys(JSON.parse(body)).sort()).toEqual(PAYMENT_FIELDS);
    expect(body).not.toContain(TEST_CARDS.mastercard);
    expect(body).not.toContain('"cvc"');
    expect(JSON.parse(body)).toMatchObject({ cardBrand: 'MASTERCARD', cardLast4: '4444' });
  });

  test('charges the amount due after a gift card instead of the order total - 201', async ({ shopper, admin }) => {
    // given
    const giftCard = await admin.issueGiftCard({ amount: 20 });
    await shopper.fillCart({ price: 100 });
    await expect(await shopper.tenders.applyGiftCard(giftCard.code)).toHaveStatus(200);
    const order = await shopper.checkout();
    expect(order).toMatchObject({ totalAmount: 100, giftCardAmount: 20, amountDue: 80 });

    // when
    const response = await shopper.payments.pay(order.id);

    // then
    await expect(response).toHaveStatus(201);
    expect(await response.json()).toEqual(expectedPayment(order.id, 80, TEST_CARDS.visa, 'CAPTURED'));
    await shopper.waitForOrderStatus(order.id, 'PAID');
  });

  test('accepts another card after a declined attempt and pays the order - 201', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(25);
    const declined = await shopper.pay(order.id, TEST_CARDS.declined);

    // when
    const response = await shopper.payments.pay(order.id, TEST_CARDS.visa);

    // then
    await expect(response).toHaveStatus(201);
    const captured: PaymentDto = await response.json();
    expect(captured).toEqual(expectedPayment(order.id, 25, TEST_CARDS.visa, 'CAPTURED'));
    await shopper.waitForOrderStatus(order.id, 'PAID');
    expect((await orderPayments(shopper, order.id)).map(({ id, status }) => ({ id, status }))).toEqual([
      { id: captured.id, status: 'CAPTURED' },
      { id: declined.id, status: 'FAILED' },
    ]);
  });

  test('pays the order exactly once although the 0259 result reaches the backend twice - 201', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(33);
    const receiver = await InboxReceiver.subscribe(shopper, ['order.paid']);

    // when
    const response = await shopper.payments.pay(order.id, TEST_CARDS.duplicateNotification);

    // then
    await expect(response).toHaveStatus(201);
    const payment: PaymentDto = await response.json();
    expect(payment).toEqual(expectedPayment(order.id, 33, TEST_CARDS.duplicateNotification, 'CAPTURED'));
    await shopper.waitForOrderStatus(order.id, 'PAID');
    // Both copies are sent right after the payment commits, so a second order.paid would reach the event feed
    // next to the first; notification-service records the deliveries when it reads the feed.
    await receiver.waitFor('order.paid', order.id);
    expect(await orderPayments(shopper, order.id)).toEqual([
      expectedPayment(order.id, 33, TEST_CARDS.duplicateNotification, 'CAPTURED'),
    ]);
    expect(await receiver.publishedEvents('order.paid', order.id)).toEqual([
      expect.objectContaining({ type: 'order.paid', data: expect.objectContaining({ orderId: order.id, paymentId: payment.id }) }),
    ]);
  });
});
