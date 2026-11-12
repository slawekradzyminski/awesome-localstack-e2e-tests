import { test, expect } from '@fixtures';
import { AdminGiftCardsPage } from '@pages/admin/admin-gift-cards.page';
import { recordRequests } from '@support/network';
import { signInBrowser } from '@support/browser-session';
import { ADMIN_PASSWORD, ADMIN_USERNAME, APP_BASE_URL } from '@config';
import { applyGiftCard, disableGiftCard, giftCardDetails } from '@support/tenders';
import type { GiftCardPageDto } from '@models/tenders';

const GIFT_CARD_CODE = /^GC-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/;

// datetime-local value in the browser's zone, the format the issue form sends.
const localDateTimeInput = (offsetMs: number) => {
  const date = new Date(Date.now() + offsetMs);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

test.describe('admin gift cards page', { tag: ['@gift-cards'] }, () => {
  test('issuing a card shows its new code and lists it', async ({ admin, shopper, adminGiftCardsPage }) => {
    // given
    await adminGiftCardsPage.goto();
    const note = `UI issue ${Date.now()}`;

    // when
    await adminGiftCardsPage.issueForm.issue({ amount: '25.50', recipient: shopper.username, note });

    // then
    await expect(adminGiftCardsPage.issued).toContainText(`Issued a $25.50 gift card for ${shopper.username}:`);
    await expect(adminGiftCardsPage.issuedCode).toHaveText(GIFT_CARD_CODE);
    const code = (await adminGiftCardsPage.issuedCode.textContent())!;
    await expect(adminGiftCardsPage.issueForm.amount).toHaveValue('');
    await expect(adminGiftCardsPage.row(code).status).toHaveText('ACTIVE');
    await expect(adminGiftCardsPage.row(code).balance).toContainText('$25.50');
    expect(await giftCardDetails(admin, code)).toMatchObject({
      initialAmount: 25.5, balance: 25.5, status: 'ACTIVE', recipientUsername: shopper.username, note, expiresAt: null,
    });
  });

  test('an expiry picked in the form is stored on the card', async ({ admin, adminGiftCardsPage }) => {
    // given
    await adminGiftCardsPage.goto();
    const expires = localDateTimeInput(3 * 24 * 3600_000);

    // when
    await adminGiftCardsPage.issueForm.issue({ amount: '5', expires });

    // then
    await expect(adminGiftCardsPage.issuedCode).toHaveText(GIFT_CARD_CODE);
    const card = await giftCardDetails(admin, (await adminGiftCardsPage.issuedCode.textContent())!);
    // the form sends the picked local time as a UTC instant; the backend stores UTC
    expect(card.expiresAt?.slice(0, 16)).toBe(new Date(expires).toISOString().slice(0, 16));
  });

  test('an expiry picked in a browser east of the server zone is stored as the same instant', async ({ browser, baseURL, request, admin }) => {
    // given: an administrator in Auckland (UTC+12/+13) picks an expiry three hours from now
    const context = await browser.newContext({ baseURL: baseURL ?? APP_BASE_URL, timezoneId: 'Pacific/Auckland' });
    try {
      await signInBrowser(context, request, { username: ADMIN_USERNAME, password: ADMIN_PASSWORD });
      const page = await context.newPage();
      const adminGiftCardsPage = new AdminGiftCardsPage(page);
      await adminGiftCardsPage.goto();
      const expiresAt = new Date(Date.now() + 3 * 3600_000);
      const expires = await page.evaluate((epoch) => {
        const date = new Date(epoch);
        const pad = (value: number) => String(value).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
      }, expiresAt.getTime());

      // when
      await adminGiftCardsPage.issueForm.issue({ amount: '5', expires });

      // then: the card exists and expires at the chosen instant (the server keeps UTC local time)
      await expect(adminGiftCardsPage.issueForm.formError).toBeHidden();
      await expect(adminGiftCardsPage.issuedCode).toHaveText(GIFT_CARD_CODE);
      const card = await giftCardDetails(admin, (await adminGiftCardsPage.issuedCode.textContent())!);
      expect(card.expiresAt?.slice(0, 16)).toBe(expiresAt.toISOString().slice(0, 16));
    } finally {
      await context.close();
    }
  });

  for (const { title, amount, message } of [
    { title: 'a missing amount', amount: '', message: 'Amount is required' },
    { title: 'a non-numeric amount', amount: 'ten', message: 'Amount must be a number' },
    { title: 'an amount below 1', amount: '0.50', message: 'Amount must be between 1 and 1000' },
    { title: 'an amount above 1000', amount: '1000.01', message: 'Amount must be between 1 and 1000' },
    { title: 'an amount with three decimals', amount: '10.005', message: 'Use at most 2 decimal places' },
  ]) {
    test(`${title} is flagged in the form and nothing is issued`, async ({ adminPage, adminGiftCardsPage }) => {
      // given
      await adminGiftCardsPage.goto();
      const issueRequests = recordRequests(adminPage, (request) => request.method() === 'POST' && request.url().endsWith('/api/v1/admin/gift-cards'));

      // when
      await adminGiftCardsPage.issueForm.issue({ amount });

      // then
      await expect(adminGiftCardsPage.issueForm.amountError).toHaveText(message);
      await expect(adminGiftCardsPage.issued).toBeHidden();
      expect(issueRequests).toEqual([]);
    });
  }

  test('an expiry in the past is flagged in the form', async ({ adminGiftCardsPage }) => {
    // given
    await adminGiftCardsPage.goto();

    // when
    await adminGiftCardsPage.issueForm.issue({ amount: '10', expires: localDateTimeInput(-24 * 3600_000) });

    // then
    await expect(adminGiftCardsPage.issueForm.expiresError).toHaveText('Expiry must be in the future');
    await expect(adminGiftCardsPage.issued).toBeHidden();
  });

  test('an unknown recipient shows the server error', async ({ adminGiftCardsPage }) => {
    // given
    await adminGiftCardsPage.goto();

    // when
    await adminGiftCardsPage.issueForm.issue({ amount: '10', recipient: `nobody-${Date.now()}` });

    // then
    await expect(adminGiftCardsPage.issueForm.formError).toHaveText('Recipient user not found');
    await expect(adminGiftCardsPage.issued).toBeHidden();
    await expect(adminGiftCardsPage.issueForm.amount).toHaveValue('10');
  });

  test('the details drawer shows the balance and the ledger with the order that spent the card', async ({ admin, shopper, adminGiftCardsPage }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 30, note: 'Ledger in the UI' });
    await shopper.fillCart({ price: 12.5 });
    await applyGiftCard(shopper, card.code);
    const order = await shopper.checkout();
    await adminGiftCardsPage.goto();

    // when
    await adminGiftCardsPage.openDetails(card.code);

    // then
    await expect(adminGiftCardsPage.details.title).toHaveText(`Gift card ${card.code}`);
    await expect(adminGiftCardsPage.details.status).toHaveText('ACTIVE');
    await expect(adminGiftCardsPage.details.balance).toHaveText('$17.50 of $30.00');
    await expect(adminGiftCardsPage.details.ledgerRows).toHaveCount(2);
    await expect(adminGiftCardsPage.details.ledgerCell(0, 'type')).toHaveText('ISSUED');
    await expect(adminGiftCardsPage.details.ledgerCell(0, 'reference')).toHaveText('admin');
    await expect(adminGiftCardsPage.details.ledgerCell(1, 'type')).toHaveText('REDEEMED');
    await expect(adminGiftCardsPage.details.ledgerCell(1, 'amount')).toHaveText('-$12.50');
    await expect(adminGiftCardsPage.details.ledgerCell(1, 'balanceAfter')).toHaveText('$17.50');
    await expect(adminGiftCardsPage.details.ledgerCell(1, 'reference')).toHaveText(`#${order.id}`);
  });

  test('cancelling the disable confirmation keeps the card active', async ({ admin, adminGiftCardsPage }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 40 });
    await adminGiftCardsPage.goto();
    await adminGiftCardsPage.openDetails(card.code);
    await adminGiftCardsPage.details.startDisabling();
    await expect(adminGiftCardsPage.details.confirmMessage).toHaveText('The remaining $40.00 can no longer be spent. This cannot be undone.');

    // when
    await adminGiftCardsPage.details.cancelDisable();

    // then
    await expect(adminGiftCardsPage.details.confirmDialog).toBeHidden();
    await expect(adminGiftCardsPage.details.status).toHaveText('ACTIVE');
    expect((await giftCardDetails(admin, card.code)).status).toBe('ACTIVE');
  });

  test('confirming disables the card, adds a DISABLED ledger row and hides the button', async ({ admin, adminGiftCardsPage }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 40 });
    await adminGiftCardsPage.goto();
    await adminGiftCardsPage.openDetails(card.code);
    await adminGiftCardsPage.details.startDisabling();

    // when
    await adminGiftCardsPage.details.confirmDisable();

    // then
    await expect(adminGiftCardsPage.details.status).toHaveText('DISABLED');
    await expect(adminGiftCardsPage.details.disableButton).toBeHidden();
    await expect(adminGiftCardsPage.details.ledgerRows).toHaveCount(2);
    await expect(adminGiftCardsPage.details.ledgerCell(1, 'type')).toHaveText('DISABLED');
    await expect(adminGiftCardsPage.row(card.code).status).toHaveText('DISABLED');
    expect(await giftCardDetails(admin, card.code)).toMatchObject({ status: 'DISABLED', balance: 40 });
  });

  test('a card disabled elsewhere while the drawer is open shows the server conflict', async ({ admin, adminGiftCardsPage }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 40 });
    await adminGiftCardsPage.goto();
    await adminGiftCardsPage.openDetails(card.code);
    await expect(adminGiftCardsPage.details.status).toHaveText('ACTIVE');
    await disableGiftCard(admin, card.code);
    await adminGiftCardsPage.details.startDisabling();

    // when
    await adminGiftCardsPage.details.confirmDisable();

    // then
    await expect(adminGiftCardsPage.details.disableError).toHaveText('Gift card is already disabled');
    await expect(adminGiftCardsPage.details.confirmDialog).toBeHidden();
    expect((await giftCardDetails(admin, card.code)).transactions.filter(row => row.type === 'DISABLED')).toHaveLength(1);
  });

  test('a failing list shows an error instead of the table', { tag: '@slow' }, async ({ adminPage, adminGiftCardsPage }) => {
    // given
    await adminPage.route(/\/api\/v1\/admin\/gift-cards\?/, route => route.fulfill({ status: 500, json: { message: 'Internal error' } }));

    // when
    await adminGiftCardsPage.goto();

    // then
    await expect(adminGiftCardsPage.loading).toHaveText('Loading gift cards…');
    // React Query retries a failed list three times with back-off before it gives up.
    await expect(adminGiftCardsPage.listError).toHaveText('Unable to load gift cards.', { timeout: 20_000 });
    await expect(adminGiftCardsPage.loading).toBeHidden();
    await expect(adminGiftCardsPage.issueForm.submitButton).toBeEnabled();
  });

  test('the status filter lists only cards with that status', async ({ adminPage, admin, adminGiftCardsPage }) => {
    // given
    const active = await admin.issueGiftCard();
    const disabled = await admin.issueGiftCard();
    await disableGiftCard(admin, disabled.code);
    await adminGiftCardsPage.goto();
    await expect(adminGiftCardsPage.row(active.code).root).toBeVisible();

    // when
    const listed = adminPage.waitForResponse(response => response.url().includes('/api/v1/admin/gift-cards?') && response.url().includes('status=DISABLED'));
    await adminGiftCardsPage.filterBy('DISABLED');
    const page: GiftCardPageDto = await (await listed).json();

    // then
    await expect(adminGiftCardsPage.row(disabled.code).status).toHaveText('DISABLED');
    await expect(adminGiftCardsPage.row(active.code).root).toBeHidden();
    expect(page.content.every(card => card.status === 'DISABLED')).toBe(true);
  });
});
