import { test, expect } from '@fixtures';
import { TEST_CARDS } from '@api/payments.client';
import { addresses } from '@support/addresses';
import {
  TENDER_FIELDS,
  applyGiftCard,
  disableGiftCard,
  giftCardDetails,
  readCart,
  serverLocalDateTime,
  waitForGiftCardStatus,
  waitForLoyaltyBalance,
} from '@support/tenders';
import type { OrderDto } from '@models/order';

const ANY_TIME = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/);

test.describe('POST /api/v1/orders with a gift card', { tag: ['@gift-cards'] }, () => {
  test('checkout copies the gift card onto the order and debits its ledger - 201', async ({ admin, shopper }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 15 });
    await shopper.fillCart({ price: 40 });
    await applyGiftCard(shopper, card.code);

    // when
    const order = await shopper.checkout();

    // then
    expect(order).toMatchObject({ status: 'PENDING', totalAmount: 40, giftCardCode: card.code, giftCardAmount: 15, amountDue: 25 });
    expect(order).not.toHaveProperty('pointsRedeemed');
    expect(await shopper.getOrder(order.id)).toMatchObject({ giftCardCode: card.code, giftCardAmount: 15, amountDue: 25 });
    const saved = await giftCardDetails(admin, card.code);
    expect(saved).toMatchObject({ balance: 0, status: 'REDEEMED' });
    expect(saved.transactions.at(-1)).toEqual({
      type: 'REDEEMED', amount: -15, balanceAfter: 0, orderId: order.id, actor: shopper.username, createdAt: ANY_TIME,
    });
    const cart = await readCart(shopper);
    expect(cart.items).toEqual([]);
    for (const field of TENDER_FIELDS) expect(cart, `cart without ${field}`).not.toHaveProperty(field);
  });

  test('an order without tenders has no tender fields - 201', async ({ shopper }) => {
    // when
    const { order } = await shopper.placeOrder(20);

    // then
    for (const field of TENDER_FIELDS) expect(order, `order without ${field}`).not.toHaveProperty(field);
    expect(order).toMatchObject({ totalAmount: 20, status: 'PENDING' });
  });

  test('a card larger than the order keeps the rest of its balance for the next order - 201', async ({ admin, shopper }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 50 });
    await shopper.fillCart({ price: 30 });
    await applyGiftCard(shopper, card.code);
    const first = await shopper.checkout();
    await shopper.fillCart({ price: 30 });
    await applyGiftCard(shopper, card.code);

    // when
    const second = await shopper.checkout();

    // then
    expect(first).toMatchObject({ giftCardAmount: 30, amountDue: 0 });
    expect(second).toMatchObject({ giftCardAmount: 20, amountDue: 10 });
    const saved = await giftCardDetails(admin, card.code);
    expect(saved).toMatchObject({ balance: 0, status: 'REDEEMED' });
    expect(saved.transactions.map(row => [row.type, row.amount, row.balanceAfter, row.orderId])).toEqual([
      ['ISSUED', 50, 50, null],
      ['REDEEMED', -30, 20, first.id],
      ['REDEEMED', -20, 0, second.id],
    ]);
  });

  test('the rest of a partly gift-card-paid order is charged to the card - 201', async ({ admin, shopper }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 15 });
    await shopper.fillCart({ price: 40 });
    await applyGiftCard(shopper, card.code);
    const order = await shopper.checkout();

    // when
    const payment = await shopper.payAndWaitForPaid(order.id);

    // then
    expect(payment).toMatchObject({ orderId: order.id, status: 'CAPTURED', amount: 25 });
    expect(await shopper.getOrder(order.id)).toMatchObject({ status: 'PAID', giftCardAmount: 15, amountDue: 25 });
  });

  test('an order the gift card covers completely becomes PAID without a card payment - 201', async ({ admin, shopper }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 50 });
    await shopper.fillCart({ price: 30 });
    await applyGiftCard(shopper, card.code);

    // when
    const order = await shopper.checkout();

    // then
    expect(order).toMatchObject({ status: 'PENDING', giftCardAmount: 30, amountDue: 0 });
    await shopper.waitForOrderStatus(order.id, 'PAID');
    const payments = await shopper.payments.listForOrder(order.id);
    await expect(payments).toHaveStatus(200);
    expect(await payments.json()).toEqual([]);
  });

  test('a card payment for an order already covered by the gift card is rejected - 409', async ({ admin, shopper }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 50 });
    await shopper.fillCart({ price: 30 });
    await applyGiftCard(shopper, card.code);
    const order = await shopper.checkout();
    await shopper.waitForOrderStatus(order.id, 'PAID');

    // when
    const response = await shopper.payments.pay(order.id, TEST_CARDS.visa);

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual({ message: 'Order is not payable' });
  });

  test('a card disabled after it was applied fails checkout and keeps the cart - 409', async ({ admin, shopper }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 10 });
    const { product } = await shopper.fillCart({ price: 20 });
    await applyGiftCard(shopper, card.code);
    await disableGiftCard(admin, card.code);

    // when
    const response = await shopper.orders.create(addresses.poland);

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual({ message: 'Applied gift card is no longer valid: Gift card is disabled' });
    expect(await readCart(shopper)).toMatchObject({ items: [{ productId: product.id, quantity: 1 }], giftCardCode: card.code });
    expect(await giftCardDetails(admin, card.code)).toMatchObject({ balance: 10, status: 'DISABLED' });
  });

  test('a card that expired after it was applied fails checkout - 409', async ({ admin, shopper }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 10, expiresAt: serverLocalDateTime(3_000) });
    await shopper.fillCart({ price: 20 });
    await applyGiftCard(shopper, card.code);
    await waitForGiftCardStatus(admin, card.code, 'EXPIRED');

    // when
    const response = await shopper.orders.create(addresses.poland);

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual({ message: 'Applied gift card is no longer valid: Gift card has expired' });
    expect(await giftCardDetails(admin, card.code)).toMatchObject({ balance: 10, status: 'EXPIRED' });
  });
});

test.describe('cancelling an order paid with a gift card', { tag: ['@gift-cards'] }, () => {
  test('cancelling a pending order puts the gift card amount back with a RESTORED row - 200', async ({ admin, shopper }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 15 });
    await shopper.fillCart({ price: 40 });
    await applyGiftCard(shopper, card.code);
    const order = await shopper.checkout();

    // when
    const response = await shopper.orders.cancel(order.id);

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toMatchObject({ status: 'CANCELLED', giftCardAmount: 15 });
    const saved = await giftCardDetails(admin, card.code);
    expect(saved).toMatchObject({ balance: 15, status: 'ACTIVE' });
    expect(saved.transactions.at(-1)).toEqual({
      type: 'RESTORED', amount: 15, balanceAfter: 15, orderId: order.id, actor: null, createdAt: ANY_TIME,
    });
  });

  test('cancelling a paid order restores the gift card, revokes earned points and refunds the card - 200', { tag: '@slow' }, async ({ admin, shopper }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 15 });
    await shopper.fillCart({ price: 40 });
    await applyGiftCard(shopper, card.code);
    const order = await shopper.checkout();
    const payment = await shopper.payAndWaitForPaid(order.id);
    await waitForLoyaltyBalance(shopper, 40);

    // when
    const response = await shopper.orders.cancel(order.id);

    // then
    await expect(response).toHaveStatus(200);
    const cancelled: OrderDto = await response.json();
    expect(cancelled.status).toBe('CANCELLED');
    expect(await giftCardDetails(admin, card.code)).toMatchObject({ balance: 15, status: 'ACTIVE' });
    expect(await shopper.loyaltyAccount()).toMatchObject({ balance: 0, lifetimeEarned: 40 });
    const refunded = await shopper.waitForPaymentStatus(payment.id, 'REFUNDED');
    expect(refunded.refundedAmount).toBe(25);
  });

  test('a fully gift-card-paid order earns points that cancelling revokes - 200', async ({ admin, shopper }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 50 });
    await shopper.fillCart({ price: 30 });
    await applyGiftCard(shopper, card.code);
    const order = await shopper.checkout();
    await shopper.waitForOrderStatus(order.id, 'PAID');
    await waitForLoyaltyBalance(shopper, 30);

    // when
    const response = await shopper.orders.cancel(order.id);

    // then
    await expect(response).toHaveStatus(200);
    expect(await giftCardDetails(admin, card.code)).toMatchObject({ balance: 50, status: 'ACTIVE' });
    expect(await shopper.loyaltyAccount()).toMatchObject({ balance: 0, lifetimeEarned: 30 });
  });
});
