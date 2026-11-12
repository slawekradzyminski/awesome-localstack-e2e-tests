import { test, expect } from '@fixtures';
import { TEST_CARDS } from '@api/payments.client';
import { AdminPaymentsPage } from '@pages/admin/admin-payments.page';

// The list is newest first, 20 per page, and shared with concurrent tests: each test looks for the
// payments it has just created.
test.describe('Admin payments page', { tag: ['@payments'] }, () => {
  test("lists a customer's payment with its order, amount, card and status", async ({ shopper, adminPaymentsPage }) => {
    // given
    const { order } = await shopper.placeOrder(61.25);
    const payment = await shopper.pay(order.id, TEST_CARDS.mastercard);

    // when
    await adminPaymentsPage.goto();

    // then
    const row = adminPaymentsPage.row(payment.id);
    await expect(row).toContainText(payment.id.slice(0, 8));
    await expect(row).toContainText(`#${order.id}`);
    await expect(row).toContainText('MASTERCARD •••• 4444');
    await expect(adminPaymentsPage.amount(payment.id)).toHaveText('$61.25');
    await expect(adminPaymentsPage.status(payment.id)).toHaveText('CAPTURED');
  });

  test('shows the failure reason of a failed payment', async ({ shopper, adminPaymentsPage }) => {
    // given
    const { order } = await shopper.placeOrder(14);
    const payment = await shopper.pay(order.id, TEST_CARDS.declined);

    // when
    await adminPaymentsPage.goto();

    // then
    await expect(adminPaymentsPage.status(payment.id)).toHaveText('FAILED');
    await expect(adminPaymentsPage.row(payment.id)).toContainText('CARD_DECLINED: Your card was declined');
  });

  test('filters the list by status', async ({ shopper, adminPaymentsPage }) => {
    // given
    const { order: challenged } = await shopper.placeOrder(14);
    const { order: declined } = await shopper.placeOrder(15);
    const waiting = await shopper.pay(challenged.id, TEST_CARDS.threeDs);
    const failed = await shopper.pay(declined.id, TEST_CARDS.declined);
    await adminPaymentsPage.goto();
    await expect(adminPaymentsPage.row(failed.id)).toBeVisible();

    // when
    await adminPaymentsPage.filterBy('REQUIRES_ACTION');

    // then
    await expect(adminPaymentsPage.status(waiting.id)).toHaveText('REQUIRES ACTION');
    await expect(adminPaymentsPage.row(failed.id)).toBeHidden();
    await expect(adminPaymentsPage.rows.getByText(/^(CAPTURED|FAILED|PROCESSING|VOIDED|REFUNDED|PARTIALLY REFUNDED)$/)).toHaveCount(0);

    // when
    await adminPaymentsPage.filterBy('FAILED');

    // then
    await expect(adminPaymentsPage.status(failed.id)).toHaveText('FAILED');
    await expect(adminPaymentsPage.row(waiting.id)).toBeHidden();
  });

  test('keeps customers out', async ({ shopperPage }) => {
    // given
    const adminPaymentsPage = new AdminPaymentsPage(shopperPage);

    // when
    await adminPaymentsPage.goto();

    // then
    await expect(shopperPage).toHaveURL('/');
    await expect(adminPaymentsPage.root).toBeHidden();
  });
});
