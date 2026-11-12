import { test, expect } from '@fixtures';
import { CartTendersClient } from '@api/tenders.client';
import { TENDER_FIELDS, applyGiftCard, applyPoints, earnPoints, readCart } from '@support/tenders';

test.describe('PUT /api/v1/cart/loyalty-points', { tag: ['@loyalty'] }, () => {
  test('reserves points for the cart at 100 points = 1.00 without spending them yet - 200', async ({ shopper }) => {
    // given
    await earnPoints(shopper, 500);
    await shopper.fillCart({ price: 20 });

    // when
    const response = await shopper.tenders.applyPoints(300);

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toMatchObject({ totalPrice: 20, pointsRedeemed: 300, pointsAmount: 3, amountDue: 17 });
    expect(await readCart(shopper)).toMatchObject({ pointsRedeemed: 300, pointsAmount: 3, amountDue: 17 });
    expect(await readCart(shopper)).not.toHaveProperty('giftCardCode');
    expect((await shopper.loyaltyAccount()).balance).toBe(500);
  });

  test('caps the redeemed points at what the cart is worth - 200', async ({ shopper }) => {
    // given
    await earnPoints(shopper, 500);
    await shopper.fillCart({ price: 2.5 });

    // when
    const response = await shopper.tenders.applyPoints(500);

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toMatchObject({ totalPrice: 2.5, pointsRedeemed: 250, pointsAmount: 2.5, amountDue: 0 });
  });

  test('points pay after the gift card - 200', async ({ admin, shopper }) => {
    // given
    await earnPoints(shopper, 1_200);
    const card = await admin.issueGiftCard({ amount: 15 });
    await shopper.fillCart({ price: 20 });
    await applyGiftCard(shopper, card.code);

    // when
    const response = await shopper.tenders.applyPoints(1_200);

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toMatchObject({
      totalPrice: 20, giftCardCode: card.code, giftCardAmount: 15, pointsRedeemed: 500, pointsAmount: 5, amountDue: 0,
    });
  });

  test('a new amount replaces the previous one - 200', async ({ shopper }) => {
    // given
    await earnPoints(shopper, 500);
    await shopper.fillCart({ price: 20 });
    await applyPoints(shopper, 500);

    // when
    const response = await shopper.tenders.applyPoints(100);

    // then
    await expect(response).toHaveStatus(200);
    expect(await readCart(shopper)).toMatchObject({ pointsRedeemed: 100, pointsAmount: 1, amountDue: 19 });
  });

  test('the whole balance can be applied - 200', async ({ shopper }) => {
    // given
    await earnPoints(shopper, 200);
    await shopper.fillCart({ price: 20 });

    // when
    const response = await shopper.tenders.applyPoints(200);

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toMatchObject({ pointsRedeemed: 200, pointsAmount: 2, amountDue: 18 });
  });

  test('an empty cart cannot take points - 400', async ({ shopper }) => {
    // when
    const response = await shopper.tenders.applyPoints(100);

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ message: 'Cart is empty' });
  });

  for (const { title, body, expected } of [
    { title: 'fewer than the 100 point minimum', body: 50, expected: { points: 'Points must be at least 100' } },
    { title: 'zero points', body: 0, expected: { points: 'Points must be at least 100' } },
    { title: 'more than the 100000000 maximum', body: 100_000_100, expected: { points: 'Points cannot exceed 100000000' } },
    { title: 'a step that is not a multiple of 100', body: 150, expected: { message: 'Points must be a whole multiple of 100' } },
  ]) {
    test(`${title} is rejected - 400`, async ({ shopper }) => {
      // given
      await shopper.fillCart({ price: 20 });

      // when
      const response = await shopper.tenders.applyPoints(body);

      // then
      await expect(response).toHaveStatus(400);
      expect(await response.json()).toEqual(expected);
      expect(await readCart(shopper)).not.toHaveProperty('pointsRedeemed');
    });
  }

  test('missing points are rejected - 400', async ({ shopper }) => {
    // given
    await shopper.fillCart({ price: 20 });

    // when
    const response = await shopper.tenders.applyPoints(undefined as unknown as number);

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ points: 'Points are required' });
  });

  test('a user without points cannot redeem any - 409', async ({ shopper }) => {
    // given
    await shopper.fillCart({ price: 20 });

    // when
    const response = await shopper.tenders.applyPoints(100);

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual({ message: 'Insufficient loyalty points' });
  });

  test('more points than the balance are rejected - 409', async ({ shopper }) => {
    // given
    await earnPoints(shopper, 250);
    await shopper.fillCart({ price: 20 });

    // when
    const response = await shopper.tenders.applyPoints(300);

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual({ message: 'Insufficient loyalty points' });
    expect(await readCart(shopper)).not.toHaveProperty('pointsRedeemed');
  });

  test('an anonymous caller cannot apply points - 401', async ({ request }) => {
    // when
    const response = await new CartTendersClient(request).applyPoints(100);

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});

test.describe('DELETE /api/v1/cart/loyalty-points', { tag: ['@loyalty'] }, () => {
  test('stops using points and the cart drops every tender field - 200', async ({ shopper }) => {
    // given
    await earnPoints(shopper, 100);
    await shopper.fillCart({ price: 20 });
    await applyPoints(shopper, 100);

    // when
    const response = await shopper.tenders.removePoints();

    // then
    await expect(response).toHaveStatus(200);
    const cart = await response.json();
    for (const field of TENDER_FIELDS) expect(cart, `cart without ${field}`).not.toHaveProperty(field);
    expect(Object.keys(await readCart(shopper)).sort()).toEqual(['items', 'totalItems', 'totalPrice', 'username']);
  });

  test('removing points keeps an applied gift card - 200', async ({ admin, shopper }) => {
    // given
    await earnPoints(shopper, 100);
    const card = await admin.issueGiftCard({ amount: 5 });
    await shopper.fillCart({ price: 20 });
    await applyGiftCard(shopper, card.code);
    await applyPoints(shopper, 100);

    // when
    const response = await shopper.tenders.removePoints();

    // then
    await expect(response).toHaveStatus(200);
    const cart = await readCart(shopper);
    expect(cart).toMatchObject({ giftCardCode: card.code, giftCardAmount: 5, amountDue: 15 });
    expect(cart).not.toHaveProperty('pointsRedeemed');
    expect(cart).not.toHaveProperty('pointsAmount');
  });

  test('removing when no points are applied succeeds - 200', async ({ shopper }) => {
    // given
    await shopper.fillCart({ price: 20 });

    // when
    const response = await shopper.tenders.removePoints();

    // then
    await expect(response).toHaveStatus(200);
    expect(Object.keys(await response.json()).sort()).toEqual(['items', 'totalItems', 'totalPrice', 'username']);
  });

  test('an anonymous caller cannot remove points - 401', async ({ request }) => {
    // when
    const response = await new CartTendersClient(request).removePoints();

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});
