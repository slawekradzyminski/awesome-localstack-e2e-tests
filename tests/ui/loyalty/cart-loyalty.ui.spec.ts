import { test, expect } from '@fixtures';
import { TENDER_FIELDS, applyGiftCard, applyPoints, earnPoints, readCart } from '@support/tenders';

test.describe('cart loyalty points panel', { tag: ['@loyalty'] }, () => {
  test('a shopper without points sees a zero balance and the redemption minimum', async ({ shopper, cartPage }) => {
    // given
    await shopper.fillCart({ price: 20 });

    // when
    await cartPage.goto();

    // then
    await expect(cartPage.loyalty.balance).toHaveText('Balance: 0 points (worth $0.00)');
    await expect(cartPage.loyalty.minimum).toHaveText('Collect at least 100 points to redeem them.');
    await expect(cartPage.loyalty.form).toBeHidden();
  });

  test('a failing loyalty API hides the redemption form behind an unavailable notice', async ({ shopperPage, shopper, cartPage }) => {
    // given
    await shopper.fillCart({ price: 20 });
    await shopperPage.route(/\/api\/v1\/loyalty(\?.*)?$/, route => route.fulfill({ status: 503, json: { message: 'Service unavailable' } }));

    // when
    await cartPage.goto();

    // then
    await expect(cartPage.loyalty.unavailable).toHaveText('Loyalty points are unavailable right now.');
    await expect(cartPage.loyalty.balance).toBeHidden();
    await expect(cartPage.loyalty.form).toBeHidden();
    await expect(cartPage.loyalty.minimum).toBeHidden();
    await expect(cartPage.giftCard.input).toBeVisible();
  });

  test('"use max" fills the redeemable balance, previews it and applies it to the cart', async ({ shopper, cartPage }) => {
    // given
    await earnPoints(shopper, 550);
    await shopper.fillCart({ price: 20 });
    await cartPage.goto();
    await expect(cartPage.loyalty.balance).toHaveText('Balance: 550 points (worth $5.50)');

    // when
    await cartPage.loyalty.useMax();

    // then
    await expect(cartPage.loyalty.useMaxButton).toHaveText('Use 500');
    await expect(cartPage.loyalty.input).toHaveValue('500');
    await expect(cartPage.loyalty.preview).toHaveText('500 points = −$5.00');

    // when
    await cartPage.loyalty.applyEnteredPoints();

    // then
    await expect(cartPage.loyalty.redeemed).toHaveText('Redeeming 500 points (−$5.00)');
    await expect(cartPage.loyalty.form).toBeHidden();
    await expect(cartPage.summary.points).toHaveText('−$5.00');
    await expect(cartPage.summary.amountDue).toHaveText('$15.00');
    expect(await readCart(shopper)).toMatchObject({ pointsRedeemed: 500, pointsAmount: 5, amountDue: 15 });
  });

  for (const { title, input, message } of [
    { title: 'a step that is not a multiple of 100', input: '150', message: 'Redeem points in multiples of 100.' },
    { title: 'more points than the balance', input: '400', message: 'You only have 300 points.' },
    { title: 'a fraction', input: '100.5', message: 'Enter a whole number of points.' },
    { title: 'a negative amount', input: '-100', message: 'Enter a whole number of points.' },
  ]) {
    test(`${title} is flagged before it is sent`, async ({ shopper, cartPage }) => {
      // given
      await earnPoints(shopper, 300);
      await shopper.fillCart({ price: 20 });
      await cartPage.goto();

      // when
      await cartPage.loyalty.input.fill(input);

      // then
      await expect(cartPage.loyalty.validation).toHaveText(message);
      await expect(cartPage.loyalty.applyButton).toBeDisabled();
      await expect(cartPage.loyalty.preview).toBeHidden();
      expect(await readCart(shopper)).not.toHaveProperty('pointsRedeemed');
    });
  }

  test('points worth more than the cart redeem only what the cart needs', async ({ shopper, cartPage }) => {
    // given
    await earnPoints(shopper, 500);
    await shopper.fillCart({ price: 2.5 });
    await cartPage.goto();

    // when
    await cartPage.loyalty.apply(500);

    // then
    await expect(cartPage.loyalty.redeemed).toHaveText('Redeeming 250 points (−$2.50)');
    await expect(cartPage.summary.amountDue).toHaveText('$0.00');
  });

  test('gift card and points are both listed and the amount due is what is left', async ({ shopper, admin, cartPage }) => {
    // given
    await earnPoints(shopper, 300);
    const card = await admin.issueGiftCard({ amount: 10 });
    await shopper.fillCart({ price: 20 });
    await applyGiftCard(shopper, card.code);
    await cartPage.goto();

    // when
    await cartPage.loyalty.apply(300);

    // then
    await expect(cartPage.summary.giftCard).toHaveText('−$10.00');
    await expect(cartPage.summary.points).toHaveText('−$3.00');
    await expect(cartPage.summary.amountDue).toHaveText('$7.00');
  });

  test('points that left the balance after the page loaded show the server error', async ({ shopper, cartPage }) => {
    // given
    const earningOrder = await earnPoints(shopper, 300);
    await shopper.fillCart({ price: 20 });
    await cartPage.goto();
    await expect(cartPage.loyalty.balance).toHaveText('Balance: 300 points (worth $3.00)');
    await expect(await shopper.orders.cancel(earningOrder.id), 'Cancelling the earning order revokes the points').toHaveStatus(200);

    // when
    await cartPage.loyalty.apply(300);

    // then
    await expect(cartPage.loyalty.error).toHaveText('Insufficient loyalty points');
    await expect(cartPage.loyalty.applied).toBeHidden();
    expect(await readCart(shopper)).not.toHaveProperty('pointsRedeemed');
  });

  test('removing the points brings back the form and drops the summary', async ({ shopper, cartPage }) => {
    // given
    await earnPoints(shopper, 200);
    await shopper.fillCart({ price: 20 });
    await applyPoints(shopper, 200);
    await cartPage.goto();
    await expect(cartPage.loyalty.redeemed).toHaveText('Redeeming 200 points (−$2.00)');

    // when
    await cartPage.loyalty.remove();

    // then
    await expect(cartPage.loyalty.form).toBeVisible();
    await expect(cartPage.loyalty.applied).toBeHidden();
    await expect(cartPage.summary.root).toBeHidden();
    const saved = await readCart(shopper);
    for (const field of TENDER_FIELDS) expect(saved, `cart without ${field}`).not.toHaveProperty(field);
  });
});
