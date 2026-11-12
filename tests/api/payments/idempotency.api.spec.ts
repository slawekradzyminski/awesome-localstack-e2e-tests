import { randomUUID } from 'node:crypto';
import { test, expect } from '@fixtures';
import { TEST_CARDS, card, newIdempotencyKey } from '@api/payments.client';
import { expectSamePayment, orderPayments } from '@support/payments';
import type { PaymentDto } from '@models/payment';

const KEY_ERROR = { message: 'Idempotency-Key header is required and must match ^[A-Za-z0-9_-]{8,64}$' };

test.describe('POST /api/v1/payments Idempotency-Key', { tag: ['@payments'] }, () => {
  test('replays the original payment for the same key and body - 200', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(40);
    const key = newIdempotencyKey();
    const body = { orderId: order.id, card: card(TEST_CARDS.visa) };
    const first = await shopper.payments.create(body, key);
    await expect(first).toHaveStatus(201);
    const original: PaymentDto = await first.json();
    expect(first.headers()['idempotent-replayed']).toBeUndefined();

    // when
    const response = await shopper.payments.create(body, key);

    // then
    await expect(response).toHaveStatus(200);
    expect(response.headers()['idempotent-replayed']).toBe('true');
    const replayed: PaymentDto = await response.json();
    expectSamePayment(replayed, original);
    expect((await orderPayments(shopper, order.id)).map(({ id }) => id)).toEqual([original.id]);
  });

  test('replays the original payment with identical timestamps - 200', async ({ shopper }) => {
    test.fixme(true, 'bugs/BUG-PAYMENTS-01-create-response-timestamps-differ-from-stored.md');
    // given
    const { order } = await shopper.placeOrder(40);
    const key = newIdempotencyKey();
    const body = { orderId: order.id, card: card(TEST_CARDS.visa) };
    const original: PaymentDto = await (await shopper.payments.create(body, key)).json();

    // when
    const response = await shopper.payments.create(body, key);

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual(original);
    expect(await shopper.getPayment(original.id)).toEqual(original);
  });

  test('replays a failed payment instead of charging the card again - 200', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(40);
    const key = newIdempotencyKey();
    const body = { orderId: order.id, card: card(TEST_CARDS.declined) };
    const original: PaymentDto = await (await shopper.payments.create(body, key)).json();

    // when
    const response = await shopper.payments.create(body, key);

    // then
    await expect(response).toHaveStatus(200);
    expect(response.headers()['idempotent-replayed']).toBe('true');
    expect(await response.json()).toMatchObject({ id: original.id, status: 'FAILED', failureCode: 'CARD_DECLINED' });
    expect(await orderPayments(shopper, order.id)).toHaveLength(1);
  });

  test('refuses the same key with a different body - 409', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(40);
    const key = newIdempotencyKey();
    const first: PaymentDto = await (await shopper.payments.create({ orderId: order.id, card: card(TEST_CARDS.declined) }, key)).json();

    // when
    const response = await shopper.payments.create({ orderId: order.id, card: card(TEST_CARDS.visa) }, key);

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual({ message: 'Idempotency-Key was already used with a different request' });
    expect((await orderPayments(shopper, order.id)).map(({ id }) => id)).toEqual([first.id]);
    expect(await shopper.getOrder(order.id)).toMatchObject({ status: 'PENDING' });
  });

  test('scopes keys to the customer, so another customer can use the same key - 201', async ({ shopper, otherShopper }) => {
    // given
    const key = newIdempotencyKey();
    const { order: mine } = await shopper.placeOrder(40);
    const { order: theirs } = await otherShopper.placeOrder(40);
    const first: PaymentDto = await (await shopper.payments.create({ orderId: mine.id, card: card() }, key)).json();

    // when
    const response = await otherShopper.payments.create({ orderId: theirs.id, card: card() }, key);

    // then
    await expect(response).toHaveStatus(201);
    const second: PaymentDto = await response.json();
    expect(second).toMatchObject({ orderId: theirs.id, status: 'CAPTURED' });
    expect(second.id).not.toBe(first.id);
  });

  test('requires the header - 400', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(40);

    // when
    const response = await shopper.payments.create({ orderId: order.id, card: card() }, null);

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual(KEY_ERROR);
    expect(await orderPayments(shopper, order.id)).toEqual([]);
  });

  const invalidKeys = [
    { name: 'shorter than 8 characters', key: 'abc1234' },
    { name: 'longer than 64 characters', key: 'k'.repeat(65) },
    { name: 'with characters outside A-Z, 0-9, _ and -', key: 'order 42!' },
  ];

  for (const { name, key } of invalidKeys) {
    test(`rejects a key ${name} - 400`, async ({ shopper }) => {
      // given
      const { order } = await shopper.placeOrder(40);

      // when
      const response = await shopper.payments.create({ orderId: order.id, card: card() }, key);

      // then
      await expect(response).toHaveStatus(400);
      expect(await response.json()).toEqual(KEY_ERROR);
      expect(await orderPayments(shopper, order.id)).toEqual([]);
    });
  }

  test('accepts keys of exactly 8 and 64 allowed characters - 201', async ({ shopper }) => {
    // given
    const { order: first } = await shopper.placeOrder(40);
    const { order: second } = await shopper.placeOrder(40);

    // when
    const shortest = await shopper.payments.create({ orderId: first.id, card: card() }, `a_-${Date.now()}`.slice(0, 8));
    const longest = await shopper.payments.create({ orderId: second.id, card: card() }, `Z9_-${randomUUID()}`.padEnd(64, 'x'));

    // then
    await expect(shortest).toHaveStatus(201);
    await expect(longest).toHaveStatus(201);
  });
});
