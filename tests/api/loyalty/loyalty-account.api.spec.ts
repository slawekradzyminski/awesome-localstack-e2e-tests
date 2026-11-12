import { test, expect } from '@fixtures';
import { LoyaltyClient } from '@api/tenders.client';
import { earnPoints, loyaltyTransactions, waitForLoyaltyBalance } from '@support/tenders';
import type { LoyaltyAccountDto } from '@models/tenders';

const ANY_TIME = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/);

test.describe('GET /api/v1/loyalty', { tag: ['@loyalty'] }, () => {
  test('a user who never earned points has a zero BRONZE account - 200', async ({ shopper }) => {
    // when
    const response = await shopper.loyalty.account();

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual({ balance: 0, lifetimeEarned: 0, tier: 'BRONZE', valueOfBalance: 0 });
  });

  test('a paid order earns one point per full 1.00 of its total - 200', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder(40.99);

    // when
    await shopper.payAndWaitForPaid(order.id);

    // then
    const account = await waitForLoyaltyBalance(shopper, 40);
    expect(account).toEqual({ balance: 40, lifetimeEarned: 40, tier: 'BRONZE', valueOfBalance: 0.4 });
    expect((await loyaltyTransactions(shopper)).content).toEqual([
      { id: expect.any(Number), type: 'EARNED', points: 40, balanceAfter: 40, orderId: order.id, createdAt: ANY_TIME },
    ]);
  });

  test('a pending order earns nothing until it is paid - 200', async ({ shopper }) => {
    // given
    const { order: unpaid } = await shopper.placeOrder(70);

    // when
    const paid = await earnPoints(shopper, 25);

    // then
    expect(await shopper.loyaltyAccount()).toMatchObject({ balance: 25, lifetimeEarned: 25 });
    expect((await loyaltyTransactions(shopper)).content.map(row => row.orderId)).toEqual([paid.id]);
    expect((await shopper.getOrder(unpaid.id)).status).toBe('PENDING');
  });

  test('1000 lifetime points reach the SILVER tier - 200', async ({ shopper }) => {
    // when
    await earnPoints(shopper, 1_000);

    // then
    const response = await shopper.loyalty.account();
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual({ balance: 1_000, lifetimeEarned: 1_000, tier: 'SILVER', valueOfBalance: 10 });
  });

  test('999 lifetime points stay BRONZE - 200', async ({ shopper }) => {
    // when
    await earnPoints(shopper, 999);

    // then
    const account: LoyaltyAccountDto = await (await shopper.loyalty.account()).json();
    expect(account).toEqual({ balance: 999, lifetimeEarned: 999, tier: 'BRONZE', valueOfBalance: 9.99 });
  });

  test('5000 lifetime points reach the GOLD tier - 200', async ({ shopper }) => {
    // when
    await earnPoints(shopper, 5_000);

    // then
    expect(await shopper.loyaltyAccount()).toEqual({ balance: 5_000, lifetimeEarned: 5_000, tier: 'GOLD', valueOfBalance: 50 });
  });

  test('an anonymous caller cannot read a loyalty account - 401', async ({ request }) => {
    // when
    const response = await new LoyaltyClient(request).account();

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});

test.describe('GET /api/v1/loyalty/transactions', { tag: ['@loyalty'] }, () => {
  test('a user without activity has an empty history - 200', async ({ shopper }) => {
    // when
    const response = await shopper.loyalty.transactions();

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual({ content: [], pageNumber: 0, pageSize: 20, totalElements: 0, totalPages: 0 });
  });

  test('lists the ledger newest first with signed points, page by page - 200', async ({ shopper }) => {
    // given
    const first = await earnPoints(shopper, 30);
    const second = await earnPoints(shopper, 20);
    await expect(await shopper.orders.cancel(first.id), 'Cancel the first paid order').toHaveStatus(200);

    // when
    const page0 = await shopper.loyalty.transactions({ page: 0, size: 2 });
    const page1 = await shopper.loyalty.transactions({ page: 1, size: 2 });

    // then
    await expect(page0).toHaveStatus(200);
    await expect(page1).toHaveStatus(200);
    expect(await page0.json()).toEqual({
      content: [
        { id: expect.any(Number), type: 'REVOKED', points: -30, balanceAfter: 20, orderId: first.id, createdAt: ANY_TIME },
        { id: expect.any(Number), type: 'EARNED', points: 20, balanceAfter: 50, orderId: second.id, createdAt: ANY_TIME },
      ],
      pageNumber: 0, pageSize: 2, totalElements: 3, totalPages: 2,
    });
    expect(await page1.json()).toEqual({
      content: [{ id: expect.any(Number), type: 'EARNED', points: 30, balanceAfter: 30, orderId: first.id, createdAt: ANY_TIME }],
      pageNumber: 1, pageSize: 2, totalElements: 3, totalPages: 2,
    });
  });

  test('clamps a negative page and an out-of-range size - 200', async ({ shopper }) => {
    // when
    const negative = await loyaltyTransactions(shopper, { page: -1, size: 0 });
    const huge = await loyaltyTransactions(shopper, { size: 500 });

    // then
    expect(negative).toMatchObject({ pageNumber: 0, pageSize: 1 });
    expect(huge).toMatchObject({ pageNumber: 0, pageSize: 100 });
  });

  test('shows only the caller\'s own transactions - 200', async ({ shopper, otherShopper }) => {
    // given
    await earnPoints(otherShopper, 12);

    // when
    const page = await loyaltyTransactions(shopper);

    // then
    expect(page).toMatchObject({ content: [], totalElements: 0 });
  });

  test('an anonymous caller cannot read loyalty transactions - 401', async ({ request }) => {
    // when
    const response = await new LoyaltyClient(request).transactions();

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});
