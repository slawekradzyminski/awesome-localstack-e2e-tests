import { test, expect } from '@fixtures';
import { applyPoints, disableGiftCard, earnPoints, loyaltyTransactions, serverLocalDateTime } from '@support/tenders';

test.describe('loyalty account page', { tag: ['@loyalty'] }, () => {
  test('a new shopper sees an empty BRONZE account and no history', async ({ loyaltyPage }) => {
    // given

    // when
    await loyaltyPage.goto();

    // then
    await expect(loyaltyPage.balance).toHaveText('0 pts');
    await expect(loyaltyPage.value).toHaveText('$0.00');
    await expect(loyaltyPage.tier).toHaveText('BRONZE');
    await expect(loyaltyPage.lifetime).toHaveText('0 pts');
    await expect(loyaltyPage.nextTier).toHaveText('1,000 more lifetime points to reach Silver. 100 points = $1.00 at checkout.');
    await expect(loyaltyPage.history.empty).toHaveText('No points activity yet. You earn points when an order is paid.');
    await expect(loyaltyPage.history.table).toBeHidden();
  });

  test('points earned on a paid order appear in the balance and the history', async ({ shopper, loyaltyPage }) => {
    // given
    const order = await earnPoints(shopper, 40);
    const [earned] = (await loyaltyTransactions(shopper)).content;

    // when
    await loyaltyPage.goto();

    // then
    await expect(loyaltyPage.balance).toHaveText('40 pts');
    await expect(loyaltyPage.value).toHaveText('$0.40');
    await expect(loyaltyPage.lifetime).toHaveText('40 pts');
    await expect(loyaltyPage.nextTier).toHaveText('960 more lifetime points to reach Silver. 100 points = $1.00 at checkout.');
    await expect(loyaltyPage.history.rows).toHaveCount(1);
    const row = loyaltyPage.history.row(earned.id);
    await expect(row.type).toHaveText('EARNED');
    await expect(row.points).toHaveText('+40');
    await expect(row.order).toHaveText(`#${order.id}`);
    await expect(row.order).toHaveAttribute('href', `/orders/${order.id}`);
    await expect(loyaltyPage.history.pagination).toBeHidden();
  });

  test('a SILVER shopper sees the distance to GOLD and redeemed points as negative rows', async ({ shopper, loyaltyPage }) => {
    // given
    await earnPoints(shopper, 1_200);
    await shopper.fillCart({ price: 20 });
    await applyPoints(shopper, 1_000);
    const order = await shopper.checkout();
    const [redeemed] = (await loyaltyTransactions(shopper)).content;

    // when
    await loyaltyPage.goto();

    // then
    await expect(loyaltyPage.balance).toHaveText('200 pts');
    await expect(loyaltyPage.value).toHaveText('$2.00');
    await expect(loyaltyPage.tier).toHaveText('SILVER');
    await expect(loyaltyPage.lifetime).toHaveText('1,200 pts');
    await expect(loyaltyPage.nextTier).toHaveText('3,800 more lifetime points to reach Gold. 100 points = $1.00 at checkout.');
    await expect(loyaltyPage.history.row(redeemed.id).type).toHaveText('REDEEMED');
    await expect(loyaltyPage.history.row(redeemed.id).points).toHaveText('-1,000');
    await expect(loyaltyPage.history.row(redeemed.id).order).toHaveText(`#${order.id}`);
  });

  test('a long history is split into pages of ten', async ({ shopper, loyaltyPage }) => {
    // given: one EARNED row plus five REDEEMED/RESTORED pairs = 11 rows
    await earnPoints(shopper, 100);
    for (let round = 0; round < 5; round++) {
      await shopper.fillCart({ price: 5 });
      await applyPoints(shopper, 100);
      const order = await shopper.checkout();
      await expect(await shopper.orders.cancel(order.id), `Cancel order ${order.id}`).toHaveStatus(200);
    }
    const ledger = (await loyaltyTransactions(shopper, { size: 20 })).content;
    expect(ledger).toHaveLength(11);
    await loyaltyPage.goto();
    await expect(loyaltyPage.history.rows).toHaveCount(10);
    await expect(loyaltyPage.history.pageIndicator).toHaveText('Page 1 of 2');
    await expect(loyaltyPage.history.previousButton).toBeDisabled();
    await expect(loyaltyPage.history.row(ledger[0].id).type).toHaveText('RESTORED');

    // when
    await loyaltyPage.history.nextPage();

    // then
    await expect(loyaltyPage.history.pageIndicator).toHaveText('Page 2 of 2');
    await expect(loyaltyPage.history.rows).toHaveCount(1);
    await expect(loyaltyPage.history.row(ledger[10].id).type).toHaveText('EARNED');
    await expect(loyaltyPage.history.nextButton).toBeDisabled();

    // when
    await loyaltyPage.history.previousPage();

    // then
    await expect(loyaltyPage.history.pageIndicator).toHaveText('Page 1 of 2');
    await expect(loyaltyPage.history.rows).toHaveCount(10);
  });
});

test.describe('loyalty account page when the API is slow or failing', { tag: ['@loyalty'] }, () => {
  test('shows loading placeholders until the account and history arrive', async ({ shopperPage, loyaltyPage }) => {
    // given
    let release!: () => void;
    const released = new Promise<void>(resolve => { release = resolve; });
    await shopperPage.route(/\/api\/v1\/loyalty(\/transactions)?(\?.*)?$/, async route => {
      await released;
      await route.continue();
    });

    // when
    await loyaltyPage.goto();

    // then
    await expect(loyaltyPage.accountLoading).toHaveText('Loading your points…');
    await expect(loyaltyPage.history.loading).toHaveText('Loading history…');

    // when
    release();

    // then
    await expect(loyaltyPage.balance).toHaveText('0 pts');
    await expect(loyaltyPage.history.empty).toBeVisible();
  });

  test('shows an error for the account and the history when the loyalty API fails', async ({ shopperPage, loyaltyPage }) => {
    // given
    await shopperPage.route(/\/api\/v1\/loyalty(\/transactions)?(\?.*)?$/, route =>
      route.fulfill({ status: 503, json: { message: 'Service unavailable' } }));

    // when
    await loyaltyPage.goto();

    // then
    await expect(loyaltyPage.accountError).toHaveText('Your loyalty account could not be loaded.');
    await expect(loyaltyPage.history.error).toHaveText('Your points history could not be loaded.');
    await expect(loyaltyPage.checker.input).toBeVisible();
  });
});

test.describe('gift card balance checker', { tag: ['@loyalty'] }, () => {
  test('shows the balance, status and expiry of a card', async ({ admin, loyaltyPage }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 35.5, expiresAt: serverLocalDateTime(10 * 24 * 3600_000) });
    await loyaltyPage.goto();

    // when
    await loyaltyPage.checker.check(card.code.toLowerCase());

    // then
    await expect(loyaltyPage.checker.code).toHaveText(card.code);
    await expect(loyaltyPage.checker.balance).toHaveText('$35.50');
    await expect(loyaltyPage.checker.status).toHaveText('ACTIVE');
    await expect(loyaltyPage.checker.expires).toBeVisible();
    await expect(loyaltyPage.checker.error).toBeHidden();
  });

  test('a disabled card shows its kept balance with the DISABLED status and no expiry', async ({ admin, loyaltyPage }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 12 });
    await disableGiftCard(admin, card.code);
    await loyaltyPage.goto();

    // when
    await loyaltyPage.checker.check(card.code);

    // then
    await expect(loyaltyPage.checker.balance).toHaveText('$12.00');
    await expect(loyaltyPage.checker.status).toHaveText('DISABLED');
    await expect(loyaltyPage.checker.expires).toBeHidden();
  });

  test('an unknown code shows that no card has it', async ({ loyaltyPage }) => {
    // given
    await loyaltyPage.goto();

    // when
    await loyaltyPage.checker.check('GC-AAAA-AAAA-AAAA');

    // then
    await expect(loyaltyPage.checker.error).toHaveText('No gift card has this code.');
    await expect(loyaltyPage.checker.result).toBeHidden();
  });

  test('a malformed code shows the server message', async ({ loyaltyPage }) => {
    // given
    await loyaltyPage.goto();
    await expect(loyaltyPage.checker.submitButton).toBeDisabled();

    // when
    await loyaltyPage.checker.check('HELLO');

    // then
    await expect(loyaltyPage.checker.error).toHaveText('Gift card code must look like GC-XXXX-XXXX-XXXX');
  });
});
