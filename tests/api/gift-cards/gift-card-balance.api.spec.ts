import { test, expect } from '@fixtures';
import { GiftCardsClient } from '@api/tenders.client';
import {
  disableGiftCard,
  issueExpiredGiftCard,
  issueRedeemedGiftCard,
  serverLocalDateTime,
} from '@support/tenders';

test.describe('GET /api/v1/gift-cards/{code}', { tag: ['@gift-cards'] }, () => {
  test('any signed-in user sees balance, status and expiry but never the recipient or note - 200', async ({ admin, shopper, otherShopper }) => {
    // given
    const expiresAt = serverLocalDateTime(7 * 24 * 3600_000);
    const card = await admin.issueGiftCard({ amount: 35, expiresAt, recipientUsername: otherShopper.username, note: 'Private note' });

    // when
    const response = await shopper.giftCards.balance(card.code);

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual({ code: card.code, balance: 35, status: 'ACTIVE', expiresAt: card.expiresAt });
  });

  test('the code is trimmed and case-insensitive - 200', async ({ admin, shopper }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 8 });

    // when
    const response = await shopper.giftCards.balance(` ${card.code.toLowerCase()} `);

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual({ code: card.code, balance: 8, status: 'ACTIVE', expiresAt: null });
  });

  test('a disabled card shows its kept balance with status DISABLED - 200', async ({ admin, shopper }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 9 });
    await disableGiftCard(admin, card.code);

    // when
    const response = await shopper.giftCards.balance(card.code);

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual({ code: card.code, balance: 9, status: 'DISABLED', expiresAt: null });
  });

  test('an expired card shows status EXPIRED - 200', async ({ admin, shopper }) => {
    // given
    const card = await issueExpiredGiftCard(admin, 7);

    // when
    const response = await shopper.giftCards.balance(card.code);

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual({ code: card.code, balance: 7, status: 'EXPIRED', expiresAt: card.expiresAt });
  });

  test('a fully spent card shows a zero balance with status REDEEMED - 200', async ({ admin, shopper }) => {
    // given
    const card = await issueRedeemedGiftCard(admin, shopper, 6);

    // when
    const response = await shopper.giftCards.balance(card.code);

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual({ code: card.code, balance: 0, status: 'REDEEMED', expiresAt: null });
  });

  test('a malformed code is rejected - 400', async ({ shopper }) => {
    // when
    const response = await shopper.giftCards.balance('GC-1111-OOOO-IIII');

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ message: 'Gift card code must look like GC-XXXX-XXXX-XXXX' });
  });

  test('an unknown code is not found - 404', async ({ shopper }) => {
    // when
    const response = await shopper.giftCards.balance('GC-AAAA-AAAA-AAAA');

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual({ message: 'Gift card not found' });
  });

  test('an anonymous caller cannot check a balance - 401', async ({ admin, request }) => {
    // given
    const card = await admin.issueGiftCard();

    // when
    const response = await new GiftCardsClient(request).balance(card.code);

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});
