import { test, expect } from '@fixtures';
import { CartTendersClient } from '@api/tenders.client';
import {
  TENDER_FIELDS,
  applyGiftCard,
  disableGiftCard,
  issueExpiredGiftCard,
  issueRedeemedGiftCard,
  readCart,
} from '@support/tenders';

test.describe('PUT /api/v1/cart/gift-card', { tag: ['@gift-cards'] }, () => {
  test('applies a card that covers part of the cart and shows the amount due - 200', async ({ admin, shopper }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 15 });
    await shopper.fillCart({ price: 20 }, 2);

    // when
    const response = await shopper.tenders.applyGiftCard(card.code.toLowerCase());

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toMatchObject({
      totalPrice: 40, giftCardCode: card.code, giftCardAmount: 15, amountDue: 25,
    });
    expect(await readCart(shopper)).toMatchObject({ giftCardCode: card.code, giftCardAmount: 15, amountDue: 25 });
  });

  test('caps the applied amount at the cart total - 200', async ({ admin, shopper }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 100 });
    await shopper.fillCart({ price: 30 });

    // when
    const response = await shopper.tenders.applyGiftCard(card.code);

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toMatchObject({ totalPrice: 30, giftCardAmount: 30, amountDue: 0 });
  });

  test('the cart preview follows the cart when items change - 200', async ({ admin, shopper }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 50 });
    const { product } = await shopper.fillCart({ price: 20 });
    await applyGiftCard(shopper, card.code);

    // when
    const response = await shopper.cart.updateItem(product.id, { quantity: 4 });

    // then
    await expect(response).toHaveStatus(200);
    expect(await readCart(shopper)).toMatchObject({ totalPrice: 80, giftCardAmount: 50, amountDue: 30 });
  });

  test('a second card replaces the first one - 200', async ({ admin, shopper }) => {
    // given
    const first = await admin.issueGiftCard({ amount: 5 });
    const second = await admin.issueGiftCard({ amount: 7 });
    await shopper.fillCart({ price: 20 });
    await applyGiftCard(shopper, first.code);

    // when
    const response = await shopper.tenders.applyGiftCard(second.code);

    // then
    await expect(response).toHaveStatus(200);
    expect(await readCart(shopper)).toMatchObject({ giftCardCode: second.code, giftCardAmount: 7, amountDue: 13 });
  });

  test('a card issued to another user can still be applied, gift cards are bearer cards - 200', async ({ admin, shopper, otherShopper }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 10, recipientUsername: otherShopper.username });
    await shopper.fillCart({ price: 20 });

    // when
    const response = await shopper.tenders.applyGiftCard(card.code);

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toMatchObject({ giftCardCode: card.code, giftCardAmount: 10, amountDue: 10 });
  });

  test('a card disabled after it was applied previews as 0.00 - 200', async ({ admin, shopper }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 10 });
    await shopper.fillCart({ price: 20 });
    await applyGiftCard(shopper, card.code);

    // when
    await disableGiftCard(admin, card.code);

    // then
    expect(await readCart(shopper)).toMatchObject({ giftCardCode: card.code, giftCardAmount: 0, amountDue: 20 });
  });

  test('an empty cart cannot take a gift card - 400', async ({ admin, shopper }) => {
    // given
    const card = await admin.issueGiftCard();

    // when
    const response = await shopper.tenders.applyGiftCard(card.code);

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ message: 'Cart is empty' });
  });

  for (const { title, code, body } of [
    { title: 'a malformed code', code: 'GIFT-2024', body: { message: 'Gift card code must look like GC-XXXX-XXXX-XXXX' } },
  ]) {
    test(`${title} is rejected - 400`, async ({ shopper }) => {
      // given
      await shopper.fillCart({ price: 20 });

      // when
      const response = await shopper.tenders.applyGiftCard(code);

      // then
      await expect(response).toHaveStatus(400);
      expect(await response.json()).toEqual(body);
      expect(await readCart(shopper)).not.toHaveProperty('giftCardCode');
    });
  }

  test('a blank code is rejected - 400', async ({ shopper }) => {
    // given
    await shopper.fillCart({ price: 20 });

    // when
    const response = await shopper.tenders.applyGiftCard('');

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ code: 'Gift card code is required' });
    expect(await readCart(shopper)).not.toHaveProperty('giftCardCode');
  });

  test('a blank code always gets the same validation message - 400', async ({ shopper }) => {
    // given
    await shopper.fillCart({ price: 20 });

    // when
    const bodies = [];
    for (let attempt = 0; attempt < 10; attempt++) {
      const response = await shopper.tenders.applyGiftCard('');
      await expect(response).toHaveStatus(400);
      bodies.push(await response.json());
    }

    // then
    expect(bodies).toEqual(bodies.map(() => ({ code: 'Gift card code is required' })));
  });

  test('a disabled card is rejected - 400', async ({ admin, shopper }) => {
    // given
    const card = await admin.issueGiftCard();
    await disableGiftCard(admin, card.code);
    await shopper.fillCart({ price: 20 });

    // when
    const response = await shopper.tenders.applyGiftCard(card.code);

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ message: 'Gift card is disabled' });
    expect(await readCart(shopper)).not.toHaveProperty('giftCardCode');
  });

  test('an expired card is rejected - 400', async ({ admin, shopper }) => {
    // given
    const card = await issueExpiredGiftCard(admin);
    await shopper.fillCart({ price: 20 });

    // when
    const response = await shopper.tenders.applyGiftCard(card.code);

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ message: 'Gift card has expired' });
    expect(await readCart(shopper)).not.toHaveProperty('giftCardCode');
  });

  test('an unknown card is not found - 404', async ({ shopper }) => {
    // given
    await shopper.fillCart({ price: 20 });

    // when
    const response = await shopper.tenders.applyGiftCard('GC-AAAA-AAAA-AAAA');

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual({ message: 'Gift card not found' });
  });

  test('a fully spent card is a conflict - 409', async ({ admin, shopper }) => {
    // given
    const card = await issueRedeemedGiftCard(admin, shopper);
    await shopper.fillCart({ price: 20 });

    // when
    const response = await shopper.tenders.applyGiftCard(card.code);

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual({ message: 'Gift card has no remaining balance' });
    expect(await readCart(shopper)).not.toHaveProperty('giftCardCode');
  });

  test('an anonymous caller cannot apply a gift card - 401', async ({ request }) => {
    // when
    const response = await new CartTendersClient(request).applyGiftCard('GC-AAAA-AAAA-AAAA');

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});

test.describe('DELETE /api/v1/cart/gift-card', { tag: ['@gift-cards'] }, () => {
  test('removes the card and the cart drops every tender field - 200', async ({ admin, shopper }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 10 });
    await shopper.fillCart({ price: 20 });
    await applyGiftCard(shopper, card.code);

    // when
    const response = await shopper.tenders.removeGiftCard();

    // then
    await expect(response).toHaveStatus(200);
    const cart = await response.json();
    for (const field of TENDER_FIELDS) expect(cart, `cart without ${field}`).not.toHaveProperty(field);
    expect(cart).toMatchObject({ totalPrice: 20, totalItems: 1 });
    expect(Object.keys(await readCart(shopper)).sort()).toEqual(['items', 'totalItems', 'totalPrice', 'username']);
  });

  test('removing when no card is applied succeeds - 200', async ({ shopper }) => {
    // given
    await shopper.fillCart({ price: 20 });

    // when
    const response = await shopper.tenders.removeGiftCard();

    // then
    await expect(response).toHaveStatus(200);
    expect(Object.keys(await response.json()).sort()).toEqual(['items', 'totalItems', 'totalPrice', 'username']);
  });

  test('an anonymous caller cannot remove a gift card - 401', async ({ request }) => {
    // when
    const response = await new CartTendersClient(request).removeGiftCard();

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});

test.describe('GET /api/v1/cart without tenders', { tag: ['@gift-cards'] }, () => {
  test('a cart without a gift card or points keeps its legacy shape - 200', async ({ shopper }) => {
    // given
    await shopper.fillCart({ price: 20 });

    // when
    const response = await shopper.cart.getCart();

    // then
    await expect(response).toHaveStatus(200);
    expect(Object.keys(await response.json()).sort()).toEqual(['items', 'totalItems', 'totalPrice', 'username']);
  });

  test('clearing the cart drops an applied gift card - 204', async ({ admin, shopper }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 10 });
    await shopper.fillCart({ price: 20 });
    await applyGiftCard(shopper, card.code);

    // when
    const response = await shopper.cart.clear();

    // then
    await expect(response).toHaveStatus(204);
    await shopper.fillCart({ price: 20 });
    const cart = await readCart(shopper);
    for (const field of TENDER_FIELDS) expect(cart, `cart without ${field}`).not.toHaveProperty(field);
  });
});
