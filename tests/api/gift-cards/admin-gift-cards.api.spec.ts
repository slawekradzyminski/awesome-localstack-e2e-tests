import { test, expect } from '@fixtures';
import { GiftCardsClient } from '@api/tenders.client';
import {
  disableGiftCard,
  giftCardDetails,
  issueExpiredGiftCard,
  issueRedeemedGiftCard,
  serverLocalDateTime,
} from '@support/tenders';
import type { GiftCardDto, GiftCardPageDto, GiftCardStatus } from '@models/tenders';

const GIFT_CARD_CODE = /^GC-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;
const ISO_LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

test.describe('POST /api/v1/admin/gift-cards', { tag: ['@gift-cards'] }, () => {
  test('admin issues a gift card with a generated code and an ISSUED ledger row - 201', async ({ admin, shopper }) => {
    // given
    const expiresAt = serverLocalDateTime(30 * 24 * 3600_000);

    // when
    const response = await admin.giftCards.issue({
      amount: 42.5, expiresAt, recipientUsername: shopper.username, note: 'Apology for a late delivery',
    });

    // then
    await expect(response).toHaveStatus(201);
    const card: GiftCardDto = await response.json();
    expect(card).toMatchObject({
      initialAmount: 42.5,
      balance: 42.5,
      status: 'ACTIVE',
      recipientUsername: shopper.username,
      note: 'Apology for a late delivery',
      createdBy: 'admin',
    });
    expect(card.code).toMatch(GIFT_CARD_CODE);
    expect(card.expiresAt?.slice(0, 19)).toBe(expiresAt.slice(0, 19));
    expect(card.createdAt).toMatch(ISO_LOCAL_DATE_TIME);
    expect(card).not.toHaveProperty('transactions');
    const saved = await giftCardDetails(admin, card.code);
    expect(saved.transactions).toEqual([
      { type: 'ISSUED', amount: 42.5, balanceAfter: 42.5, orderId: null, actor: 'admin', createdAt: expect.stringMatching(ISO_LOCAL_DATE_TIME) },
    ]);
  });

  test('a card without expiry, recipient or note is issued with nulls - 201', async ({ admin }) => {
    // when
    const response = await admin.giftCards.issue({ amount: 1 });

    // then
    await expect(response).toHaveStatus(201);
    expect(await response.json()).toMatchObject({
      initialAmount: 1, balance: 1, status: 'ACTIVE', expiresAt: null, recipientUsername: null, note: null,
    });
  });

  test('the largest allowed amount is accepted - 201', async ({ admin }) => {
    // when
    const response = await admin.giftCards.issue({ amount: 1000 });

    // then
    await expect(response).toHaveStatus(201);
    expect(await response.json()).toMatchObject({ initialAmount: 1000, balance: 1000 });
  });

  for (const { title, amount, message } of [
    { title: 'below 1.00', amount: 0.99, message: 'Gift card amount must be between 1.00 and 1000.00' },
    { title: 'above 1000.00', amount: 1000.01, message: 'Gift card amount must be between 1.00 and 1000.00' },
    { title: 'with three decimals', amount: 1.001, message: 'Gift card amount must have at most 2 decimals' },
  ]) {
    test(`an amount ${title} is rejected - 400`, async ({ admin }) => {
      // when
      const response = await admin.giftCards.issue({ amount });

      // then
      await expect(response).toHaveStatus(400);
      expect(await response.json()).toEqual({ amount: message });
    });
  }

  test('a missing amount is rejected - 400', async ({ admin }) => {
    // when
    const response = await admin.giftCards.issue({} as never);

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ amount: 'Gift card amount is required' });
  });

  test('an expiry in the past is rejected - 400', async ({ admin }) => {
    // when
    const response = await admin.giftCards.issue({ amount: 10, expiresAt: serverLocalDateTime(-60_000) });

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ message: 'expiresAt must be in the future' });
  });

  test('a note longer than 255 characters is rejected - 400', async ({ admin }) => {
    // when
    const response = await admin.giftCards.issue({ amount: 10, note: 'n'.repeat(256) });

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ note: 'Note cannot exceed 255 characters' });
  });

  test('an unknown recipient is rejected - 404', async ({ admin }) => {
    // when
    const response = await admin.giftCards.issue({ amount: 10, recipientUsername: `nobody-${Date.now()}` });

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual({ message: 'Recipient user not found' });
  });

  test('a client cannot issue gift cards - 403', async ({ shopper }) => {
    // when
    const response = await shopper.giftCards.issue({ amount: 10 });

    // then
    await expect(response).toHaveStatus(403);
    expect(await response.json()).toEqual({ message: 'Access denied' });
  });

  test('an anonymous caller cannot issue gift cards - 401', async ({ request }) => {
    // when
    const response = await new GiftCardsClient(request).issue({ amount: 10 });

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});

test.describe('GET /api/v1/admin/gift-cards', { tag: ['@gift-cards'] }, () => {
  const list = async (client: GiftCardsClient, params: Parameters<GiftCardsClient['list']>[0]): Promise<GiftCardPageDto> => {
    const response = await client.list(params);
    await expect(response).toHaveStatus(200);
    return response.json();
  };

  test('lists gift cards newest first - 200', async ({ admin }) => {
    // given
    const older = await admin.issueGiftCard({ amount: 11 });
    const newer = await admin.issueGiftCard({ amount: 12 });

    // when
    const page = await list(admin.giftCards, { size: 100 });

    // then
    const codes = page.content.map(card => card.code);
    expect(codes).toContain(older.code);
    expect(codes.indexOf(newer.code)).toBeLessThan(codes.indexOf(older.code));
    expect(page.content.find(card => card.code === newer.code)).toMatchObject({ initialAmount: 12, status: 'ACTIVE' });
    expect(page.content.find(card => card.code === newer.code)).not.toHaveProperty('transactions');
  });

  test('pages through the cards with page and size - 200', async ({ admin }) => {
    // given
    await admin.issueGiftCard();
    await admin.issueGiftCard();

    // when
    const first = await list(admin.giftCards, { page: 0, size: 1 });
    const second = await list(admin.giftCards, { page: 1, size: 1 });

    // then
    expect(first).toMatchObject({ pageNumber: 0, pageSize: 1 });
    expect(second).toMatchObject({ pageNumber: 1, pageSize: 1 });
    expect(first.content).toHaveLength(1);
    expect(second.content).toHaveLength(1);
    expect(first.totalElements).toBeGreaterThanOrEqual(2);
    expect(first.totalPages).toBe(first.totalElements);
    expect(second.content[0].code).not.toBe(first.content[0].code);
  });

  test('clamps a negative page and an out-of-range size - 200', async ({ admin }) => {
    // when
    const negative = await list(admin.giftCards, { page: -3, size: 0 });
    const huge = await list(admin.giftCards, { size: 1000 });

    // then
    expect(negative).toMatchObject({ pageNumber: 0, pageSize: 1 });
    expect(huge).toMatchObject({ pageNumber: 0, pageSize: 100 });
  });

  test('filters by effective status - 200', async ({ admin, shopper }) => {
    // given
    const active = await admin.issueGiftCard();
    const disabled = await admin.issueGiftCard();
    await disableGiftCard(admin, disabled.code);
    const expired = await issueExpiredGiftCard(admin);
    const redeemed = await issueRedeemedGiftCard(admin, shopper);
    const expected: Record<GiftCardStatus, string> = {
      ACTIVE: active.code, DISABLED: disabled.code, EXPIRED: expired.code, REDEEMED: redeemed.code,
    };

    for (const [status, code] of Object.entries(expected) as [GiftCardStatus, string][]) {
      // when
      const page = await list(admin.giftCards, { status, size: 100 });

      // then
      expect(page.content.map(card => card.status), `only ${status} cards`).toEqual(page.content.map(() => status));
      expect(page.content.map(card => card.code), `${status} contains its card`).toContain(code);
      for (const other of Object.values(expected).filter(value => value !== code)) {
        expect(page.content.map(card => card.code), `${status} excludes ${other}`).not.toContain(other);
      }
    }
  });

  test('an unknown status is rejected - 400', async ({ admin }) => {
    // when
    const response = await admin.giftCards.list({ status: 'LOST' as GiftCardStatus });

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).not.toHaveProperty('content');
  });

  test('an unknown status is answered with the documented ErrorDto - 400', async ({ admin }) => {
    test.fixme(true, 'bugs/BUG-GIFTCARDS-01-unknown-status-error-body.md');
    // when
    const response = await admin.giftCards.list({ status: 'LOST' as GiftCardStatus });

    // then
    await expect(response).toHaveStatus(400);
    const body = await response.json();
    expect(body).toEqual({ message: expect.stringContaining('LOST') });
    expect(JSON.stringify(body)).not.toContain('com.awesome');
  });

  test('a client cannot list gift cards - 403', async ({ shopper }) => {
    // when
    const response = await shopper.giftCards.list();

    // then
    await expect(response).toHaveStatus(403);
    expect(await response.json()).toEqual({ message: 'Access denied' });
  });

  test('an anonymous caller cannot list gift cards - 401', async ({ request }) => {
    // when
    const response = await new GiftCardsClient(request).list();

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});
