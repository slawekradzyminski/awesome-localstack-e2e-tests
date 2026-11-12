import { test, expect } from '@fixtures';
import {
  TENDER_FIELDS,
  applyGiftCard,
  disableGiftCard,
  issueExpiredGiftCard,
  issueRedeemedGiftCard,
  readCart,
} from '@support/tenders';

test.describe('cart gift card panel', { tag: ['@gift-cards'] }, () => {
  test('applying a gift card shows what it covers and the amount due', async ({ shopper, admin, cartPage }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 15 });
    await shopper.fillCart({ price: 20 }, 2);
    await cartPage.goto();
    await expect(cartPage.summary.root).toBeHidden();

    // when
    await cartPage.giftCard.apply(card.code.toLowerCase());

    // then
    await expect(cartPage.giftCard.appliedCode).toHaveText(card.code);
    await expect(cartPage.giftCard.coveredAmount).toHaveText('Covers $15.00');
    await expect(cartPage.giftCard.input).toBeHidden();
    await expect(cartPage.summary.giftCard).toHaveText('−$15.00');
    await expect(cartPage.summary.amountDue).toHaveText('$25.00');
    await expect(cartPage.summary.points).toBeHidden();
    expect(await readCart(shopper)).toMatchObject({ giftCardCode: card.code, giftCardAmount: 15, amountDue: 25 });
  });

  test('a card worth more than the cart covers only the cart total', async ({ shopper, admin, cartPage }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 100 });
    await shopper.fillCart({ price: 30 });
    await cartPage.goto();

    // when
    await cartPage.giftCard.apply(card.code);

    // then
    await expect(cartPage.giftCard.coveredAmount).toHaveText('Covers $30.00');
    await expect(cartPage.summary.amountDue).toHaveText('$0.00');
  });

  test('the apply button stays disabled until a code is typed', async ({ shopper, cartPage }) => {
    // given
    await shopper.fillCart({ price: 20 });

    // when
    await cartPage.goto();

    // then
    await expect(cartPage.giftCard.applyButton).toBeDisabled();
    await cartPage.giftCard.input.fill('   ');
    await expect(cartPage.giftCard.applyButton).toBeDisabled();
    await cartPage.giftCard.input.fill('GC-AAAA-AAAA-AAAA');
    await expect(cartPage.giftCard.applyButton).toBeEnabled();
  });

  for (const { title, code, message } of [
    { title: 'an unknown code', code: 'GC-AAAA-AAAA-AAAA', message: 'Gift card not found' },
    { title: 'a malformed code', code: 'WELCOME10', message: 'Gift card code must look like GC-XXXX-XXXX-XXXX' },
  ]) {
    test(`${title} shows the server error and applies nothing`, async ({ shopper, cartPage }) => {
      // given
      await shopper.fillCart({ price: 20 });
      await cartPage.goto();

      // when
      await cartPage.giftCard.apply(code);

      // then
      await expect(cartPage.giftCard.error).toHaveText(message);
      await expect(cartPage.giftCard.input).toHaveValue(code);
      await expect(cartPage.giftCard.applied).toBeHidden();
      expect(await readCart(shopper)).not.toHaveProperty('giftCardCode');
    });
  }

  test('a disabled card is refused', async ({ shopper, admin, cartPage }) => {
    // given
    const card = await admin.issueGiftCard();
    await disableGiftCard(admin, card.code);
    await shopper.fillCart({ price: 20 });
    await cartPage.goto();

    // when
    await cartPage.giftCard.apply(card.code);

    // then
    await expect(cartPage.giftCard.error).toHaveText('Gift card is disabled');
    await expect(cartPage.giftCard.applied).toBeHidden();
  });

  test('an expired card is refused', async ({ shopper, admin, cartPage }) => {
    // given
    const card = await issueExpiredGiftCard(admin);
    await shopper.fillCart({ price: 20 });
    await cartPage.goto();

    // when
    await cartPage.giftCard.apply(card.code);

    // then
    await expect(cartPage.giftCard.error).toHaveText('Gift card has expired');
  });

  test('a fully spent card is refused', async ({ shopper, admin, cartPage }) => {
    // given
    const card = await issueRedeemedGiftCard(admin, shopper);
    await shopper.fillCart({ price: 20 });
    await cartPage.goto();

    // when
    await cartPage.giftCard.apply(card.code);

    // then
    await expect(cartPage.giftCard.error).toHaveText('Gift card has no remaining balance');
  });

  test('a card disabled after it was applied is shown as unusable and the full total stays due', async ({ shopper, admin, cartPage }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 10 });
    await shopper.fillCart({ price: 20 });
    await applyGiftCard(shopper, card.code);
    await disableGiftCard(admin, card.code);

    // when
    await cartPage.goto();

    // then
    await expect(cartPage.giftCard.appliedCode).toHaveText(card.code);
    await expect(cartPage.giftCard.unusable).toHaveText('This card cannot be used right now.');
    await expect(cartPage.giftCard.coveredAmount).toBeHidden();
    await expect(cartPage.summary.giftCard).toHaveText('−$0.00');
    await expect(cartPage.summary.amountDue).toHaveText('$20.00');
  });

  test('removing the gift card brings back the form and drops the summary', async ({ shopper, admin, cartPage }) => {
    // given
    const card = await admin.issueGiftCard({ amount: 10 });
    await shopper.fillCart({ price: 20 });
    await applyGiftCard(shopper, card.code);
    await cartPage.goto();
    await expect(cartPage.giftCard.appliedCode).toHaveText(card.code);

    // when
    await cartPage.giftCard.remove();

    // then
    await expect(cartPage.giftCard.input).toBeVisible();
    await expect(cartPage.giftCard.applied).toBeHidden();
    await expect(cartPage.summary.root).toBeHidden();
    const saved = await readCart(shopper);
    for (const field of TENDER_FIELDS) expect(saved, `cart without ${field}`).not.toHaveProperty(field);
  });
});
