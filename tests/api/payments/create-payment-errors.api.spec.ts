import { test, expect } from '@fixtures';
import { PaymentsClient, TEST_CARDS, card } from '@api/payments.client';
import { NOT_PAYABLE, lastMonth, orderPayments } from '@support/payments';

test.describe('POST /api/v1/payments errors', { tag: ['@payments'] }, () => {
  test('rejects a Luhn-invalid card number without recording a payment - 400', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(20);

    // when
    const response = await shopper.payments.pay(order.id, TEST_CARDS.luhnInvalid);

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ message: 'Card number is invalid' });
    expect(await orderPayments(shopper, order.id)).toEqual([]);
  });

  test('rejects a card that expired last month - 400', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(20);

    // when
    const response = await shopper.payments.create({ orderId: order.id, card: card(TEST_CARDS.visa, lastMonth()) });

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ message: 'Card has expired' });
    expect(await orderPayments(shopper, order.id)).toEqual([]);
  });

  test('accepts a card that expires at the end of the current month - 201', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(20);
    const now = new Date();

    // when
    const response = await shopper.payments.create({
      orderId: order.id,
      card: card(TEST_CARDS.visa, { expiryMonth: now.getMonth() + 1, expiryYear: now.getFullYear() }),
    });

    // then
    await expect(response).toHaveStatus(201);
    expect(await response.json()).toMatchObject({ status: 'CAPTURED' });
  });

  test('names every missing card field - 400', async ({ shopper }) => {
    // when
    const response = await shopper.payments.createUnchecked({ card: {} });

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({
      orderId: 'Order id is required',
      'card.number': 'Card number is required',
      'card.expiryMonth': 'Expiry month is required',
      'card.expiryYear': 'Expiry year is required',
      'card.cvc': 'CVC is required',
      'card.holderName': 'Holder name is required',
    });
  });

  test('requires the order and the card - 400', async ({ shopper }) => {
    // when
    const response = await shopper.payments.createUnchecked({});

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ orderId: 'Order id is required', card: 'Card is required' });
  });

  test('explains every out-of-range card field - 400', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(20);

    // when
    const response = await shopper.payments.createUnchecked({
      orderId: order.id,
      card: { number: 'abc', expiryMonth: 13, expiryYear: 1999, cvc: 'ab', holderName: 'x'.repeat(101) },
    });

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({
      'card.number': 'Card number must contain 12-19 digits',
      'card.expiryMonth': 'Expiry month must be between 1 and 12',
      'card.expiryYear': 'Expiry year must be a four-digit year',
      'card.cvc': 'CVC must be 3 or 4 digits',
      'card.holderName': 'Holder name must be at most 100 characters',
    });
    expect(await orderPayments(shopper, order.id)).toEqual([]);
  });

  test('requires a positive order id and a holder name - 400', async ({ shopper }) => {
    // when
    const response = await shopper.payments.create({ orderId: 0, card: card(TEST_CARDS.visa, { holderName: '' }) });

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ orderId: 'Order id must be positive', 'card.holderName': 'Holder name is required' });
  });

  test('rejects a body that is not JSON - 400', async ({ shopper }) => {
    // when
    const response = await shopper.payments.createUnchecked('not json');

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ message: 'Malformed JSON request' });
  });

  test('requires authentication - 401', async ({ shopper, request }) => {
    // given
    const { order } = await shopper.placeOrder(20);

    // when
    const response = await new PaymentsClient(request).pay(order.id);

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
    expect(await shopper.getOrder(order.id)).toMatchObject({ status: 'PENDING' });
  });

  test("forbids paying another customer's order - 403", async ({ shopper, otherShopper }) => {
    // given
    const { order } = await shopper.placeOrder(20);

    // when
    const response = await otherShopper.payments.pay(order.id);

    // then
    await expect(response).toHaveStatus(403);
    expect(await response.json()).toEqual({ message: 'You can only pay for your own orders' });
    expect(await orderPayments(shopper, order.id)).toEqual([]);
    expect(await shopper.getOrder(order.id)).toMatchObject({ status: 'PENDING' });
  });

  test('returns not found for an unknown order - 404', async ({ shopper }) => {
    // when
    const response = await shopper.payments.pay(2_147_483_647);

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual({ message: 'Order not found' });
  });

  test('refuses an order that is already PAID - 409', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(20);
    const first = await shopper.payAndWaitForPaid(order.id);

    // when
    const response = await shopper.payments.pay(order.id, TEST_CARDS.mastercard);

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual(NOT_PAYABLE);
    expect((await orderPayments(shopper, order.id)).map(({ id }) => id)).toEqual([first.id]);
  });

  test('refuses a CANCELLED order - 409', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(20);
    await expect(await shopper.orders.cancel(order.id)).toHaveStatus(200);

    // when
    const response = await shopper.payments.pay(order.id);

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual(NOT_PAYABLE);
    expect(await orderPayments(shopper, order.id)).toEqual([]);
    expect(await shopper.getOrder(order.id)).toMatchObject({ status: 'CANCELLED' });
  });

  test('refuses a second payment while 3-D Secure is pending - 409', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(20);
    const pending = await shopper.pay(order.id, TEST_CARDS.threeDs);

    // when
    const response = await shopper.payments.pay(order.id, TEST_CARDS.visa);

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual(NOT_PAYABLE);
    expect((await orderPayments(shopper, order.id)).map(({ id, status }) => ({ id, status })))
      .toEqual([{ id: pending.id, status: 'REQUIRES_ACTION' }]);
  });

  test('refuses a second payment while the first is PROCESSING - 409', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(20);
    const processing = await shopper.pay(order.id, TEST_CARDS.asyncSuccess);
    expect(processing.status).toBe('PROCESSING');

    // when
    const response = await shopper.payments.pay(order.id, TEST_CARDS.visa);

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual(NOT_PAYABLE);
    expect((await orderPayments(shopper, order.id)).map(({ id }) => id)).toEqual([processing.id]);
  });

  test('refuses an order a gift card already covers in full - 409', async ({ shopper, admin }) => {
    // given
    const giftCard = await admin.issueGiftCard({ amount: 50 });
    await shopper.fillCart({ price: 30 });
    await expect(await shopper.tenders.applyGiftCard(giftCard.code)).toHaveStatus(200);
    const order = await shopper.checkout();
    expect(order).toMatchObject({ totalAmount: 30, giftCardAmount: 30, amountDue: 0 });

    // when
    const response = await shopper.payments.pay(order.id);

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual(NOT_PAYABLE);
    expect(await orderPayments(shopper, order.id)).toEqual([]);
  });
});
