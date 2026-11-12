import { test, expect } from '@fixtures';
import { GiftCardsClient } from '@api/tenders.client';
import { timestampNanos } from '@support/payments';
import { applyGiftCard, disableGiftCard, giftCardDetails } from '@support/tenders';
import type { GiftCardDto } from '@models/tenders';

const UNKNOWN_CODE = 'GC-AAAA-AAAA-AAAA';
const ANY_TIME = expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/);

test.describe('GET /api/v1/admin/gift-cards/{code}', { tag: ['@gift-cards'] }, () => {
  test('returns the card with its ledger, oldest first, for a case-insensitive code - 200', async ({ admin, shopper }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 30, note: 'Ledger check' });
    await shopper.fillCart({ price: 12.5 });
    await applyGiftCard(shopper, card.code);
    const order = await shopper.checkout();

    // when
    const response = await admin.giftCards.getDetails(card.code.toLowerCase());

    // then
    await expect(response).toHaveStatus(200);
    const details: GiftCardDto = await response.json();
    expect(details).toMatchObject({ code: card.code, initialAmount: 30, balance: 17.5, status: 'ACTIVE', note: 'Ledger check' });
    expect(details.transactions).toEqual([
      { type: 'ISSUED', amount: 30, balanceAfter: 30, orderId: null, actor: 'admin', createdAt: ANY_TIME },
      { type: 'REDEEMED', amount: -12.5, balanceAfter: 17.5, orderId: order.id, actor: shopper.username, createdAt: ANY_TIME },
    ]);
  });

  test('a malformed code is rejected - 400', async ({ admin }) => {
    // when
    const response = await admin.giftCards.getDetails('not-a-card');

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ message: 'Gift card code must look like GC-XXXX-XXXX-XXXX' });
  });

  test('an unknown code is not found - 404', async ({ admin }) => {
    // when
    const response = await admin.giftCards.getDetails(UNKNOWN_CODE);

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual({ message: 'Gift card not found' });
  });

  test('a client cannot read gift card details - 403', async ({ admin, shopper }) => {
    // given
    const card = await admin.issueGiftCard();

    // when
    const response = await shopper.giftCards.getDetails(card.code);

    // then
    await expect(response).toHaveStatus(403);
    expect(await response.json()).toEqual({ message: 'Access denied' });
  });

  test('an anonymous caller cannot read gift card details - 401', async ({ request }) => {
    // when
    const response = await new GiftCardsClient(request).getDetails(UNKNOWN_CODE);

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});

test.describe('POST /api/v1/admin/gift-cards/{code}/disable', { tag: ['@gift-cards'] }, () => {
  test('disables a card, keeps its balance and writes a DISABLED ledger row - 200', async ({ admin }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 25 });

    // when
    const response = await admin.giftCards.disable(card.code);

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toMatchObject({ code: card.code, balance: 25, status: 'DISABLED' });
    const saved = await giftCardDetails(admin, card.code);
    expect(saved).toMatchObject({ balance: 25, status: 'DISABLED' });
    expect(saved.transactions.at(-1)).toEqual({
      type: 'DISABLED', amount: 0, balanceAfter: 25, orderId: null, actor: 'admin', createdAt: ANY_TIME,
    });
  });

  test('the disable response carries the same updatedAt as the stored card - 200', async ({ admin }) => {
    test.fixme(true, 'bugs/BUG-GIFTCARDS-03-disable-response-stale-updated-at.md');
    // given
    const card = await admin.issueGiftCard({ amount: 25 });

    // when
    const response = await admin.giftCards.disable(card.code);

    // then
    await expect(response).toHaveStatus(200);
    const disabled: GiftCardDto = await response.json();
    const saved = await giftCardDetails(admin, card.code);
    expect(disabled.updatedAt).toBe(saved.updatedAt);
    expect(timestampNanos(disabled.updatedAt)).toBeGreaterThan(timestampNanos(card.updatedAt));
  });

  test('a disabled card can no longer be applied to a cart - 400', async ({ admin, shopper }) => {
    // given
    const card = await admin.issueGiftCard();
    await disableGiftCard(admin, card.code);
    await shopper.fillCart({ price: 10 });

    // when
    const response = await shopper.tenders.applyGiftCard(card.code);

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ message: 'Gift card is disabled' });
  });

  test('disabling twice is a conflict - 409', async ({ admin }) => {
    // given
    const card = await admin.issueGiftCard();
    await disableGiftCard(admin, card.code);

    // when
    const response = await admin.giftCards.disable(card.code);

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual({ message: 'Gift card is already disabled' });
    expect((await giftCardDetails(admin, card.code)).transactions.filter(row => row.type === 'DISABLED')).toHaveLength(1);
  });

  test('a malformed code is rejected - 400', async ({ admin }) => {
    // when
    const response = await admin.giftCards.disable('GC-0000');

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ message: 'Gift card code must look like GC-XXXX-XXXX-XXXX' });
  });

  test('an unknown code is not found - 404', async ({ admin }) => {
    // when
    const response = await admin.giftCards.disable(UNKNOWN_CODE);

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual({ message: 'Gift card not found' });
  });

  test('a client cannot disable gift cards - 403', async ({ admin, shopper }) => {
    // given
    const card = await admin.issueGiftCard();

    // when
    const response = await shopper.giftCards.disable(card.code);

    // then
    await expect(response).toHaveStatus(403);
    expect(await response.json()).toEqual({ message: 'Access denied' });
    expect((await giftCardDetails(admin, card.code)).status).toBe('ACTIVE');
  });

  test('an anonymous caller cannot disable gift cards - 401', async ({ request }) => {
    // when
    const response = await new GiftCardsClient(request).disable(UNKNOWN_CODE);

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});
