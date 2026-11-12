import { test, expect } from '@fixtures';
import { addresses } from '@support/addresses';
import {
  applyGiftCard,
  applyPoints,
  earnPoints,
  giftCardDetails,
  loyaltyTransactions,
  readCart,
  waitForLoyaltyBalance,
} from '@support/tenders';

const ANY_TIME = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/);

test.describe('POST /api/v1/orders with loyalty points', { tag: ['@loyalty'] }, () => {
  test('checkout copies the points onto the order and debits the balance with a REDEEMED row - 201', async ({ shopper }) => {
    // given
    await earnPoints(shopper, 500);
    await shopper.fillCart({ price: 20 });
    await applyPoints(shopper, 300);

    // when
    const order = await shopper.checkout();

    // then
    expect(order).toMatchObject({ status: 'PENDING', totalAmount: 20, pointsRedeemed: 300, pointsAmount: 3, amountDue: 17 });
    expect(order).not.toHaveProperty('giftCardCode');
    expect(await shopper.getOrder(order.id)).toMatchObject({ pointsRedeemed: 300, pointsAmount: 3, amountDue: 17 });
    expect(await shopper.loyaltyAccount()).toMatchObject({ balance: 200, lifetimeEarned: 500 });
    expect((await loyaltyTransactions(shopper)).content[0]).toEqual({
      id: expect.any(Number), type: 'REDEEMED', points: -300, balanceAfter: 200, orderId: order.id, createdAt: ANY_TIME,
    });
    expect(await readCart(shopper)).not.toHaveProperty('pointsRedeemed');
  });

  test('gift card and points together leave amountDue = total - gift card - points - 201', async ({ admin, shopper }) => {
    // given
    await earnPoints(shopper, 500);
    const card = await admin.issueGiftCard({ amount: 10 });
    await shopper.fillCart({ price: 20 });
    await applyGiftCard(shopper, card.code);
    await applyPoints(shopper, 500);

    // when
    const order = await shopper.checkout();

    // then
    expect(order).toMatchObject({
      totalAmount: 20, giftCardCode: card.code, giftCardAmount: 10, pointsRedeemed: 500, pointsAmount: 5, amountDue: 5,
    });
    expect((await giftCardDetails(admin, card.code)).balance).toBe(0);
    expect((await shopper.loyaltyAccount()).balance).toBe(0);
  });

  test('paying the rest by card earns points only on the part not paid with points - 201', async ({ shopper }) => {
    // given
    await earnPoints(shopper, 300);
    await shopper.fillCart({ price: 20 });
    await applyPoints(shopper, 300);
    const order = await shopper.checkout();

    // when
    const payment = await shopper.payAndWaitForPaid(order.id);

    // then
    expect(payment).toMatchObject({ status: 'CAPTURED', amount: 17 });
    const account = await waitForLoyaltyBalance(shopper, 17);
    expect(account).toMatchObject({ balance: 17, lifetimeEarned: 317 });
    expect((await loyaltyTransactions(shopper)).content[0]).toMatchObject({ type: 'EARNED', points: 17, orderId: order.id });
  });

  test('an order covered by points becomes PAID without a card payment and earns nothing - 201', async ({ shopper }) => {
    // given
    await earnPoints(shopper, 500);
    await shopper.fillCart({ price: 3 });
    await applyPoints(shopper, 500);

    // when
    const order = await shopper.checkout();

    // then
    expect(order).toMatchObject({ status: 'PENDING', pointsRedeemed: 300, pointsAmount: 3, amountDue: 0 });
    await shopper.waitForOrderStatus(order.id, 'PAID');
    expect(await (await shopper.payments.listForOrder(order.id)).json()).toEqual([]);
    expect(await shopper.loyaltyAccount()).toMatchObject({ balance: 200, lifetimeEarned: 500 });
    expect((await loyaltyTransactions(shopper)).content.map(row => row.type)).toEqual(['REDEEMED', 'EARNED']);
  });

  test('points that are no longer on the balance fail checkout and keep the cart - 409', async ({ shopper }) => {
    // given
    const earningOrder = await earnPoints(shopper, 500);
    const { product } = await shopper.fillCart({ price: 20 });
    await applyPoints(shopper, 500);
    await expect(await shopper.orders.cancel(earningOrder.id), 'Cancelling the earning order revokes the points').toHaveStatus(200);

    // when
    const response = await shopper.orders.create(addresses.poland);

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual({ message: 'Applied loyalty points are no longer available: Insufficient loyalty points' });
    expect(await readCart(shopper)).toMatchObject({ items: [{ productId: product.id, quantity: 1 }], pointsRedeemed: 500 });
    expect((await shopper.loyaltyAccount()).balance).toBe(0);
  });
});

test.describe('cancelling an order paid with loyalty points', { tag: ['@loyalty'] }, () => {
  test('cancelling a pending order returns the redeemed points with a RESTORED row - 200', async ({ shopper }) => {
    // given
    await earnPoints(shopper, 500);
    await shopper.fillCart({ price: 20 });
    await applyPoints(shopper, 400);
    const order = await shopper.checkout();

    // when
    const response = await shopper.orders.cancel(order.id);

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toMatchObject({ status: 'CANCELLED', pointsRedeemed: 400 });
    expect(await shopper.loyaltyAccount()).toMatchObject({ balance: 500, lifetimeEarned: 500 });
    expect((await loyaltyTransactions(shopper)).content[0]).toEqual({
      id: expect.any(Number), type: 'RESTORED', points: 400, balanceAfter: 500, orderId: order.id, createdAt: ANY_TIME,
    });
  });

  test('cancelling a paid mixed order restores both tenders, revokes earned points and refunds the card - 200', { tag: '@slow' }, async ({ admin, shopper }) => {
    // given
    await earnPoints(shopper, 1_000);
    const card = await admin.issueGiftCard({ amount: 20 });
    await shopper.fillCart({ price: 100 });
    await applyGiftCard(shopper, card.code);
    await applyPoints(shopper, 1_000);
    const order = await shopper.checkout();
    expect(order).toMatchObject({ giftCardAmount: 20, pointsAmount: 10, amountDue: 70 });
    const payment = await shopper.payAndWaitForPaid(order.id);
    await waitForLoyaltyBalance(shopper, 90);

    // when
    const response = await shopper.orders.cancel(order.id);

    // then
    await expect(response).toHaveStatus(200);
    expect(await giftCardDetails(admin, card.code)).toMatchObject({ balance: 20, status: 'ACTIVE' });
    expect(await shopper.loyaltyAccount()).toMatchObject({ balance: 1_000, lifetimeEarned: 1_090, tier: 'SILVER' });
    const ledger = (await loyaltyTransactions(shopper, { size: 100 })).content.filter(row => row.orderId === order.id);
    expect(ledger.map(row => [row.type, row.points])).toEqual([
      ['REVOKED', -90], ['RESTORED', 1_000], ['EARNED', 90], ['REDEEMED', -1_000],
    ]);
    const refunded = await shopper.waitForPaymentStatus(payment.id, 'REFUNDED');
    expect(refunded.refundedAmount).toBe(70);
  });

  test('a second cancellation changes nothing - 400', async ({ shopper }) => {
    // given
    await earnPoints(shopper, 500);
    await shopper.fillCart({ price: 20 });
    await applyPoints(shopper, 400);
    const order = await shopper.checkout();
    await expect(await shopper.orders.cancel(order.id)).toHaveStatus(200);

    // when
    const response = await shopper.orders.cancel(order.id);

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ message: 'Order cannot be cancelled in current status' });
    expect((await shopper.loyaltyAccount()).balance).toBe(500);
    expect((await loyaltyTransactions(shopper)).content.filter(row => row.type === 'RESTORED')).toHaveLength(1);
  });
});
