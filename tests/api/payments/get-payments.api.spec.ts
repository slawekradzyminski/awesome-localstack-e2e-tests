import { test, expect } from '@fixtures';
import { PaymentsClient, TEST_CARDS } from '@api/payments.client';
import { expectedPayment } from '@support/payments';

const PAYMENT_NOT_FOUND = { message: 'Payment not found' };
const ORDER_NOT_FOUND = { message: 'Order not found' };
const UNKNOWN_PAYMENT_ID = '00000000-0000-0000-0000-000000000000';

test.describe('GET /api/v1/payments/{id}', { tag: ['@payments'] }, () => {
  test("returns the customer's own payment - 200", async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(18);
    const payment = await shopper.pay(order.id, TEST_CARDS.declined);

    // when
    const response = await shopper.payments.getById(payment.id);

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual({ ...expectedPayment(order.id, 18, TEST_CARDS.declined, 'FAILED', 'CARD_DECLINED'), id: payment.id });
  });

  test("lets an admin read any customer's payment - 200", async ({ shopper, admin }) => {
    // given
    const { order } = await shopper.placeOrder(18);
    const payment = await shopper.pay(order.id);

    // when
    const response = await admin.payments.getById(payment.id);

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toMatchObject({ id: payment.id, orderId: order.id, status: 'CAPTURED' });
  });

  test('requires authentication - 401', async ({ shopper, request }) => {
    // given
    const { order } = await shopper.placeOrder(18);
    const payment = await shopper.pay(order.id);

    // when
    const response = await new PaymentsClient(request).getById(payment.id);

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });

  test('rejects an id that is not a UUID - 400', async ({ shopper }) => {
    // when
    const response = await shopper.payments.getById('xyz');

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ message: 'Invalid value for id' });
  });

  test("hides another customer's payment like a missing one - 404", async ({ shopper, otherShopper }) => {
    // given
    const { order } = await shopper.placeOrder(18);
    const payment = await shopper.pay(order.id);

    // when
    const response = await otherShopper.payments.getById(payment.id);

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual(PAYMENT_NOT_FOUND);
  });

  test('returns not found for an unknown payment - 404', async ({ shopper }) => {
    // when
    const response = await shopper.payments.getById(UNKNOWN_PAYMENT_ID);

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual(PAYMENT_NOT_FOUND);
  });
});

test.describe('GET /api/v1/orders/{orderId}/payments', { tag: ['@payments'] }, () => {
  test('lists every attempt of the order, newest first - 200', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(18);
    const declined = await shopper.pay(order.id, TEST_CARDS.declined);
    const insufficient = await shopper.pay(order.id, TEST_CARDS.insufficientFunds);
    const captured = await shopper.pay(order.id, TEST_CARDS.mastercard);

    // when
    const response = await shopper.payments.listForOrder(order.id);

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual([
      { ...expectedPayment(order.id, 18, TEST_CARDS.mastercard, 'CAPTURED'), id: captured.id },
      { ...expectedPayment(order.id, 18, TEST_CARDS.insufficientFunds, 'FAILED', 'INSUFFICIENT_FUNDS'), id: insufficient.id },
      { ...expectedPayment(order.id, 18, TEST_CARDS.declined, 'FAILED', 'CARD_DECLINED'), id: declined.id },
    ]);
  });

  test('returns an empty list for an order without payments - 200', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(18);

    // when
    const response = await shopper.payments.listForOrder(order.id);

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual([]);
  });

  test("lets an admin list any customer's order payments - 200", async ({ shopper, admin }) => {
    // given
    const { order } = await shopper.placeOrder(18);
    const payment = await shopper.pay(order.id);

    // when
    const response = await admin.payments.listForOrder(order.id);

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual([expect.objectContaining({ id: payment.id })]);
  });

  test('requires authentication - 401', async ({ shopper, request }) => {
    // given
    const { order } = await shopper.placeOrder(18);

    // when
    const response = await new PaymentsClient(request).listForOrder(order.id);

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });

  test("hides another customer's order like a missing one - 404", async ({ shopper, otherShopper }) => {
    // given
    const { order } = await shopper.placeOrder(18);
    await shopper.pay(order.id);

    // when
    const response = await otherShopper.payments.listForOrder(order.id);

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual(ORDER_NOT_FOUND);
  });

  test('returns not found for an unknown order - 404', async ({ shopper }) => {
    // when
    const response = await shopper.payments.listForOrder(2_147_483_647);

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual(ORDER_NOT_FOUND);
  });
});
