import { test, expect } from '@fixtures';
import { PaymentsClient, TEST_CARDS, THREE_DS_CODE } from '@api/payments.client';
import { expectedPayment } from '@support/payments';
import type { PaymentDto } from '@models/payment';

const NOT_REQUIRING_ACTION = { message: 'Payment does not require action' };
const PAYMENT_NOT_FOUND = { message: 'Payment not found' };

test.describe('POST /api/v1/payments/{id}/3ds', { tag: ['@payments'] }, () => {
  test('captures the payment with the right code and marks the order PAID - 200', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(55);
    const challenge = await shopper.pay(order.id, TEST_CARDS.threeDs);

    // when
    const response = await shopper.payments.submit3ds(challenge.id, THREE_DS_CODE);

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual({ ...expectedPayment(order.id, 55, TEST_CARDS.threeDs, 'CAPTURED'), id: challenge.id });
    expect(await shopper.getPayment(challenge.id)).toMatchObject({ status: 'CAPTURED', nextAction: null });
    await shopper.waitForOrderStatus(order.id, 'PAID');
  });

  test('fails the payment with a wrong code and leaves the order PENDING - 200', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(55);
    const challenge = await shopper.pay(order.id, TEST_CARDS.threeDs);

    // when
    const response = await shopper.payments.submit3ds(challenge.id, '000000');

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual({
      ...expectedPayment(order.id, 55, TEST_CARDS.threeDs, 'FAILED', 'THREE_DS_FAILED'),
      id: challenge.id,
    });
    expect(await shopper.getPayment(challenge.id)).toMatchObject({ status: 'FAILED', failureCode: 'THREE_DS_FAILED' });
    expect(await shopper.getOrder(order.id)).toMatchObject({ status: 'PENDING' });
  });

  test('lets the customer pay again after a failed challenge - 201', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(55);
    const challenge = await shopper.pay(order.id, TEST_CARDS.threeDs);
    await expect(await shopper.payments.submit3ds(challenge.id, '999999')).toHaveStatus(200);

    // when
    const response = await shopper.payments.pay(order.id, TEST_CARDS.threeDs);

    // then
    await expect(response).toHaveStatus(201);
    const retry: PaymentDto = await response.json();
    expect(retry).toMatchObject({ status: 'REQUIRES_ACTION' });
    await expect(await shopper.payments.submit3ds(retry.id)).toHaveStatus(200);
    await shopper.waitForOrderStatus(order.id, 'PAID');
  });

  test('refuses a payment that was captured without a challenge - 409', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(55);
    const captured = await shopper.pay(order.id, TEST_CARDS.visa);

    // when
    const response = await shopper.payments.submit3ds(captured.id, THREE_DS_CODE);

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual(NOT_REQUIRING_ACTION);
    expect(await shopper.getPayment(captured.id)).toMatchObject({ status: 'CAPTURED' });
  });

  test('refuses to answer a failed challenge again with the right code - 409', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(55);
    const challenge = await shopper.pay(order.id, TEST_CARDS.threeDs);
    await expect(await shopper.payments.submit3ds(challenge.id, '000000')).toHaveStatus(200);

    // when
    const response = await shopper.payments.submit3ds(challenge.id, THREE_DS_CODE);

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual(NOT_REQUIRING_ACTION);
    expect(await shopper.getPayment(challenge.id)).toMatchObject({ status: 'FAILED', failureCode: 'THREE_DS_FAILED' });
    expect(await shopper.getOrder(order.id)).toMatchObject({ status: 'PENDING' });
  });

  test('requires a code - 400', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(55);
    const challenge = await shopper.pay(order.id, TEST_CARDS.threeDs);

    // when
    const response = await shopper.payments.submit3dsUnchecked(challenge.id, {});

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ code: 'Code is required' });
    expect(await shopper.getPayment(challenge.id)).toMatchObject({ status: 'REQUIRES_ACTION' });
  });

  test('rejects a payment id that is not a UUID - 400', async ({ shopper }) => {
    // when
    const response = await shopper.payments.submit3ds('not-a-uuid');

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ message: 'Invalid value for id' });
  });

  test('requires authentication - 401', async ({ shopper, request }) => {
    // given
    const { order } = await shopper.placeOrder(55);
    const challenge = await shopper.pay(order.id, TEST_CARDS.threeDs);

    // when
    const response = await new PaymentsClient(request).submit3ds(challenge.id);

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
    expect(await shopper.getPayment(challenge.id)).toMatchObject({ status: 'REQUIRES_ACTION' });
  });

  test("hides another customer's payment - 404", async ({ shopper, otherShopper }) => {
    // given
    const { order } = await shopper.placeOrder(55);
    const challenge = await shopper.pay(order.id, TEST_CARDS.threeDs);

    // when
    const response = await otherShopper.payments.submit3ds(challenge.id);

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual(PAYMENT_NOT_FOUND);
    expect(await shopper.getPayment(challenge.id)).toMatchObject({ status: 'REQUIRES_ACTION' });
    expect(await shopper.getOrder(order.id)).toMatchObject({ status: 'PENDING' });
  });

  test('returns not found for an unknown payment - 404', async ({ shopper }) => {
    // when
    const response = await shopper.payments.submit3ds('00000000-0000-0000-0000-000000000000');

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual(PAYMENT_NOT_FOUND);
  });
});
