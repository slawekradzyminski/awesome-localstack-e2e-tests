import { test, expect } from '@fixtures';
import { TEST_CARDS, THREE_DS_CODE } from '@api/payments.client';
import { orderPayments } from '@support/payments';

test.describe('3-D Secure challenge', { tag: ['@payments'] }, () => {
  test('captures the payment with the right code', async ({ shopper, paymentPage }) => {
    // given
    const { order } = await shopper.placeOrder(36);
    await paymentPage.goto(order.id);
    await paymentPage.cardForm.payWith({ number: '4000 0000 0000 3220' });
    await expect(paymentPage.threeDs.root).toBeVisible();
    await expect(paymentPage.threeDs.hint).toHaveText('Use 123456');
    await expect(paymentPage.threeDs.code).toBeFocused();
    await expect(paymentPage.threeDs.verifyButton).toBeDisabled();

    // when
    await paymentPage.threeDs.verify(THREE_DS_CODE);

    // then
    await expect(paymentPage.threeDs.root).toBeHidden();
    await expect(paymentPage.successDetails).toHaveText('$36.00 was charged to Visa •••• 3220. Your order will show as paid in a moment.');
    await shopper.waitForOrderStatus(order.id, 'PAID');
    expect(await orderPayments(shopper, order.id)).toEqual([expect.objectContaining({ status: 'CAPTURED', cardLast4: '3220' })]);
  });

  test('fails the payment with a wrong code and offers another card', async ({ shopper, paymentPage }) => {
    // given
    const { order } = await shopper.placeOrder(36);
    await paymentPage.goto(order.id);
    await paymentPage.cardForm.payWithTestCard(TEST_CARDS.threeDs);

    // when
    await paymentPage.threeDs.verify('000000');

    // then
    await expect(paymentPage.threeDs.root).toBeHidden();
    await expect(paymentPage.failedMessage).toHaveText('3-D Secure verification failed. The code was not accepted.');
    await expect(paymentPage.tryAnotherCardButton).toBeVisible();
    expect(await orderPayments(shopper, order.id)).toEqual([
      expect.objectContaining({ status: 'FAILED', failureCode: 'THREE_DS_FAILED' }),
    ]);
    expect(await shopper.getOrder(order.id)).toMatchObject({ status: 'PENDING' });
  });

  test('can be cancelled and reopened to finish the verification', async ({ shopper, paymentPage }) => {
    // given
    const { order } = await shopper.placeOrder(36);
    await paymentPage.goto(order.id);
    await paymentPage.cardForm.payWithTestCard(TEST_CARDS.threeDs);
    await expect(paymentPage.threeDs.root).toBeVisible();

    // when
    await paymentPage.threeDs.cancel();

    // then
    await expect(paymentPage.threeDs.root).toBeHidden();
    await expect(paymentPage.challenge).toContainText('Your bank needs to verify this payment with 3-D Secure.');
    await expect(paymentPage.reopenChallengeButton).toHaveText('Complete verification');
    expect(await orderPayments(shopper, order.id)).toEqual([expect.objectContaining({ status: 'REQUIRES_ACTION' })]);

    // when
    await paymentPage.reopenChallenge();
    await paymentPage.threeDs.verify(THREE_DS_CODE);

    // then
    await expect(paymentPage.success).toContainText('Payment received');
    await shopper.waitForOrderStatus(order.id, 'PAID');
  });
});
