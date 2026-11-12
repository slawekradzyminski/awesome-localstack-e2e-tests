import { test, expect } from '@fixtures';
import { TEST_CARDS } from '@api/payments.client';
import { orderPayments } from '@support/payments';
import { ASYNC_TIMEOUT } from '@config';

test.describe('Card payment page', { tag: ['@payments'] }, () => {
  test('pays a PENDING order from the Pay now button and shows it PAID', async ({ shopper, paymentPage, orderDetailsPage }) => {
    // given
    const { order } = await shopper.placeOrder(42.5);
    await orderDetailsPage.goto(order.id);
    await expect(orderDetailsPage.payment.awaiting).toHaveText('Awaiting payment of $42.50.');
    await expect(orderDetailsPage.payment.none).toHaveText('No card payments yet.');

    // when
    await orderDetailsPage.payment.payNow();

    // then
    await paymentPage.expectOpenFor(order.id);
    await expect(paymentPage.title).toHaveText(`Pay for order #${order.id}`);
    await expect(paymentPage.amountDue).toHaveText('$42.50');
    await expect(paymentPage.cardForm.submitButton).toHaveText('Pay $42.50');

    // when
    await paymentPage.cardForm.payWith({ number: '4242 4242 4242 4242' });

    // then
    await expect(paymentPage.success).toContainText('Payment received');
    await expect(paymentPage.successDetails).toHaveText('$42.50 was charged to Visa •••• 4242. Your order will show as paid in a moment.');
    await shopper.waitForOrderStatus(order.id, 'PAID');

    // when
    await paymentPage.openOrder();

    // then
    await orderDetailsPage.expectOpenFor(order.id);
    await expect(orderDetailsPage.status).toHaveText('PAID');
    await expect(orderDetailsPage.payment.status).toHaveText('Captured');
    await expect(orderDetailsPage.payment.card).toHaveText('Visa •••• 4242');
    await expect(orderDetailsPage.payment.amount).toHaveText('$42.50');
    await expect(orderDetailsPage.payment.payNowLink).toBeHidden();
    await expect(orderDetailsPage.payment.awaiting).toBeHidden();
    expect(await orderPayments(shopper, order.id)).toEqual([
      expect.objectContaining({ status: 'CAPTURED', amount: 42.5, cardBrand: 'VISA', cardLast4: '4242' }),
    ]);
  });

  test('explains every required card field and sends nothing', async ({ shopper, paymentPage }) => {
    // given
    const { order } = await shopper.placeOrder(20);
    await paymentPage.goto(order.id);

    // when
    await paymentPage.cardForm.submit();

    // then
    await expect(paymentPage.cardForm.cardNumberError).toHaveText('Card number is required');
    await expect(paymentPage.cardForm.expiryError).toHaveText('Expiry date is required');
    await expect(paymentPage.cardForm.cvcError).toHaveText('CVC is required');
    await expect(paymentPage.cardForm.holderError).toHaveText('Name on card is required');
    expect(await orderPayments(shopper, order.id)).toEqual([]);
  });

  test('rejects an invalid number, a past expiry and a short CVC before sending', async ({ shopper, paymentPage }) => {
    // given
    const { order } = await shopper.placeOrder(20);
    await paymentPage.goto(order.id);

    // when
    await paymentPage.cardForm.payWith({ number: '4242 4242 4242 4241', expiry: '01/20', cvc: '12' });

    // then
    await expect(paymentPage.cardForm.cardNumberError).toHaveText('Card number is not valid');
    await expect(paymentPage.cardForm.expiryError).toHaveText('This card has expired');
    await expect(paymentPage.cardForm.cvcError).toHaveText('CVC must be 3 or 4 digits');
    await expect(paymentPage.cardForm.holderError).toBeHidden();
    expect(await orderPayments(shopper, order.id)).toEqual([]);
  });

  test('rejects a too short number and an expiry outside MM/YY', async ({ shopper, paymentPage }) => {
    // given
    const { order } = await shopper.placeOrder(20);
    await paymentPage.goto(order.id);

    // when
    await paymentPage.cardForm.payWith({ number: '4242 4242', expiry: '13/30' });

    // then
    await expect(paymentPage.cardForm.cardNumberError).toHaveText('Card number must have 12 to 19 digits');
    await expect(paymentPage.cardForm.expiryError).toHaveText('Use the MM/YY format');
    expect(await orderPayments(shopper, order.id)).toEqual([]);
  });

  test('lists the test cards and fills the form with the one picked', async ({ shopper, paymentPage }) => {
    // given
    const { order } = await shopper.placeOrder(20);
    await paymentPage.goto(order.id);
    await expect(paymentPage.cardForm.testCardsToggle).toHaveText('Show test cards');

    // when
    await paymentPage.cardForm.toggleTestCards();

    // then
    await expect(paymentPage.cardForm.testCardsToggle).toHaveText('Hide test cards');
    await expect(paymentPage.cardForm.testCardsList.getByRole('listitem')).toHaveText([
      /4242 4242 4242 4242\s*Visa: Captured immediately/,
      /5555 5555 5555 4444\s*Mastercard: Captured immediately/,
      /4000 0000 0000 0002\s*Declined: Fails: card declined/,
      /4000 0000 0000 9995\s*Insufficient funds: Fails: insufficient funds/,
      /4000 0000 0000 3220\s*3-D Secure: Needs code 123456/,
      /4000 0000 0000 0077\s*Async success: Processing, then captured/,
      /4000 0000 0000 0119\s*Async timeout: Processing, then provider timeout/,
      /4000 0000 0000 0259\s*Duplicate notification: Captured, result delivered twice/,
    ]);

    // when
    await paymentPage.cardForm.pickTestCard(TEST_CARDS.mastercard);

    // then
    const expiryYear = String((new Date().getFullYear() + 3) % 100).padStart(2, '0');
    await expect(paymentPage.cardForm.cardNumber).toHaveValue('5555 5555 5555 4444');
    await expect(paymentPage.cardForm.expiry).toHaveValue(`12/${expiryYear}`);
    await expect(paymentPage.cardForm.cvc).toHaveValue('123');
    await expect(paymentPage.cardForm.holder).toHaveValue('Test Cardholder');

    // when
    await paymentPage.cardForm.toggleTestCards();

    // then
    await expect(paymentPage.cardForm.testCardsList).toBeHidden();
  });

  const failures = [
    { card: TEST_CARDS.declined, message: 'Your card was declined. Try another card.' },
    { card: TEST_CARDS.insufficientFunds, message: 'The card has insufficient funds. Try another card.' },
  ];

  for (const { card, message } of failures) {
    test(`shows why card ${card} failed and keeps the order PENDING`, async ({ shopper, paymentPage }) => {
      // given
      const { order } = await shopper.placeOrder(20);
      await paymentPage.goto(order.id);

      // when
      await paymentPage.cardForm.payWithTestCard(card);

      // then
      await expect(paymentPage.failedMessage).toHaveText(message);
      await expect(paymentPage.tryAnotherCardButton).toBeVisible();
      expect(await orderPayments(shopper, order.id)).toEqual([expect.objectContaining({ status: 'FAILED' })]);
      expect(await shopper.getOrder(order.id)).toMatchObject({ status: 'PENDING' });
    });
  }

  test('pays with another card after a decline', async ({ shopper, paymentPage }) => {
    // given
    const { order } = await shopper.placeOrder(20);
    await paymentPage.goto(order.id);
    await paymentPage.cardForm.payWithTestCard(TEST_CARDS.declined);
    await expect(paymentPage.failedMessage).toBeVisible();

    // when
    await paymentPage.tryAnotherCard();
    await paymentPage.cardForm.payWith({ number: '5555 5555 5555 4444' });

    // then
    await expect(paymentPage.successDetails).toContainText('Mastercard •••• 4444');
    await shopper.waitForOrderStatus(order.id, 'PAID');
    expect((await orderPayments(shopper, order.id)).map(({ status }) => status)).toEqual(['CAPTURED', 'FAILED']);
  });

  test('shows Processing for card 0077 and turns into success without a reload', { tag: '@slow' }, async ({ shopper, paymentPage }) => {
    // given
    const { order } = await shopper.placeOrder(20);
    await paymentPage.goto(order.id);

    // when
    await paymentPage.cardForm.payWithTestCard(TEST_CARDS.asyncSuccess);

    // then
    await expect(paymentPage.processing).toContainText('Processing… the card provider is confirming Visa •••• 0077.');
    await expect(paymentPage.success).toContainText('Payment received', { timeout: ASYNC_TIMEOUT });
    await expect(paymentPage.successDetails).toContainText('Visa •••• 0077');
    await shopper.waitForOrderStatus(order.id, 'PAID');
  });

  test('reports the provider timeout of card 0119 and that the card was not charged', { tag: '@slow' }, async ({ shopper, paymentPage }) => {
    // given
    const { order } = await shopper.placeOrder(20);
    await paymentPage.goto(order.id);

    // when
    await paymentPage.cardForm.payWithTestCard(TEST_CARDS.asyncTimeout);

    // then
    await expect(paymentPage.processing).toBeVisible();
    await expect(paymentPage.failedMessage)
      .toHaveText('The card provider did not respond in time. Your card was not charged.', { timeout: ASYNC_TIMEOUT });
    await expect(paymentPage.tryAnotherCardButton).toBeVisible();
    expect(await orderPayments(shopper, order.id)).toEqual([
      expect.objectContaining({ status: 'FAILED', failureCode: 'PROVIDER_TIMEOUT' }),
    ]);
    expect(await shopper.getOrder(order.id)).toMatchObject({ status: 'PENDING' });
  });

  test('tells the customer an order paid meanwhile cannot be paid again', async ({ shopper, paymentPage }) => {
    // given
    const { order } = await shopper.placeOrder(20);
    await paymentPage.goto(order.id);
    await paymentPage.cardForm.fill({ number: '4242 4242 4242 4242' });
    const first = await shopper.payAndWaitForPaid(order.id, TEST_CARDS.mastercard);

    // when
    await paymentPage.cardForm.submit();

    // then
    await expect(paymentPage.notPayableMessage).toHaveText('This order cannot be paid: Order is not payable');
    expect((await orderPayments(shopper, order.id)).map(({ id }) => id)).toEqual([first.id]);
  });

  test('shows an already paid order without the card form', async ({ shopper, paymentPage }) => {
    // given
    const { order } = await shopper.placeOrder(20);
    await shopper.payAndWaitForPaid(order.id);

    // when
    await paymentPage.goto(order.id);

    // then
    await expect(paymentPage.alreadyPaid).toHaveText('This order is already paid.');
    await expect(paymentPage.cardForm.submitButton).toBeHidden();
  });

  test('shows a cancelled order without the card form', async ({ shopper, paymentPage }) => {
    // given
    const { order } = await shopper.placeOrder(20);
    await expect(await shopper.orders.cancel(order.id)).toHaveStatus(200);

    // when
    await paymentPage.goto(order.id);

    // then
    await expect(paymentPage.cancelled).toHaveText('This order was cancelled, so there is nothing to pay.');
    await expect(paymentPage.cardForm.submitButton).toBeHidden();
  });

  test('shows an order a gift card covers in full as nothing left to pay', async ({ shopper, admin, paymentPage }) => {
    // given
    const giftCard = await admin.issueGiftCard({ amount: 50 });
    await shopper.fillCart({ price: 30 });
    await expect(await shopper.tenders.applyGiftCard(giftCard.code)).toHaveStatus(200);
    const order = await shopper.checkout();

    // when
    await paymentPage.goto(order.id);

    // then
    await expect(paymentPage.paidByTenders).toHaveText('Paid with gift card / points. Nothing is left to pay by card.');
    await expect(paymentPage.cardForm.submitButton).toBeHidden();
    await expect(paymentPage.giftCard).toHaveText('−$30.00');
    await expect(paymentPage.amountDue).toHaveText('$0.00');
  });

  test('offers to continue a payment that still waits for 3-D Secure', async ({ shopper, paymentPage }) => {
    // given
    const { order } = await shopper.placeOrder(20);
    await shopper.pay(order.id, TEST_CARDS.threeDs);
    await paymentPage.goto(order.id);
    await expect(paymentPage.inProgress).toHaveText(/A payment with Visa •••• 3220 is still waiting for 3-D Secure\./);

    // when
    await paymentPage.resumePayment();
    await paymentPage.threeDs.verify('123456');

    // then
    await expect(paymentPage.success).toContainText('Payment received');
    await shopper.waitForOrderStatus(order.id, 'PAID');
  });

  test("shows another customer's order as not found", { tag: '@slow' }, async ({ otherShopper, paymentPage }) => {
    // given
    const { order } = await otherShopper.placeOrder(20);

    // when
    await paymentPage.goto(order.id);

    // then
    // The order query retries the backend's 404 three times with backoff (about 7 s) before giving up.
    await expect(paymentPage.orderNotFound).toHaveText('Order not found', { timeout: 15_000 });
    await expect(paymentPage.cardForm.submitButton).toBeHidden();
    expect(await orderPayments(otherShopper, order.id)).toEqual([]);
  });
});
