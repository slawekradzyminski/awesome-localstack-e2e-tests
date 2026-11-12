import { test, expect } from '@fixtures';
import { PaymentsClient, TEST_CARDS } from '@api/payments.client';
import { expectSamePayment, sortableTimestamp, timestampNanos } from '@support/payments';
import type { PaymentDto, PaymentPageDto } from '@models/payment';

// Other tests add payments concurrently, so assertions look for this test's payments near the top
// of the newest-first list and check the shape and filter of the whole page.
test.describe('GET /api/v1/admin/payments', { tag: ['@payments'] }, () => {
  test('lists all customers\' payments newest first in a page - 200', async ({ shopper, otherShopper, admin }) => {
    // given
    const { order: first } = await shopper.placeOrder(11);
    const { order: second } = await otherShopper.placeOrder(12);
    const older = await shopper.pay(first.id, TEST_CARDS.declined);
    const newer = await otherShopper.pay(second.id);

    // when
    const response = await admin.payments.listAll({ page: 0, size: 100 });

    // then
    await expect(response).toHaveStatus(200);
    const page: PaymentPageDto = await response.json();
    expect(page).toMatchObject({ pageNumber: 0, pageSize: 100, totalElements: expect.any(Number), totalPages: expect.any(Number) });
    expect(page.totalPages).toBe(Math.ceil(page.totalElements / 100));
    const ids = page.content.map(({ id }) => id);
    expect(ids).toContain(older.id);
    expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));
    expectSamePayment(page.content.find(({ id }) => id === older.id)!, older);
    const created = page.content.map(({ createdAt }) => sortableTimestamp(createdAt));
    expect(created).toEqual([...created].sort().reverse());
  });

  test('filters by status - 200', async ({ shopper, admin }) => {
    // given
    const { order: pendingOrder } = await shopper.placeOrder(11);
    const { order: failedOrder } = await shopper.placeOrder(12);
    const challenge = await shopper.pay(pendingOrder.id, TEST_CARDS.threeDs);
    const failed = await shopper.pay(failedOrder.id, TEST_CARDS.declined);

    // when
    const response = await admin.payments.listAll({ status: 'REQUIRES_ACTION', size: 100 });

    // then
    await expect(response).toHaveStatus(200);
    const { content }: PaymentPageDto = await response.json();
    expect(content.map(({ id }) => id)).toContain(challenge.id);
    expect(content.map(({ id }) => id)).not.toContain(failed.id);
    expect(new Set(content.map(({ status }) => status))).toEqual(new Set(['REQUIRES_ACTION']));
  });

  test('pages through the list with page and size - 200', async ({ shopper, admin }) => {
    // given
    const { order: first } = await shopper.placeOrder(11);
    const { order: second } = await shopper.placeOrder(12);
    await shopper.pay(first.id, TEST_CARDS.declined);
    await shopper.pay(second.id, TEST_CARDS.declined);

    // when
    const firstPage = await admin.payments.listAll({ status: 'FAILED', page: 0, size: 1 });
    const secondPage = await admin.payments.listAll({ status: 'FAILED', page: 1, size: 1 });

    // then
    await expect(firstPage).toHaveStatus(200);
    await expect(secondPage).toHaveStatus(200);
    const one: PaymentPageDto = await firstPage.json();
    const two: PaymentPageDto = await secondPage.json();
    expect(one).toMatchObject({ pageNumber: 0, pageSize: 1, content: [expect.objectContaining({ status: 'FAILED' })] });
    expect(two).toMatchObject({ pageNumber: 1, pageSize: 1, content: [expect.objectContaining({ status: 'FAILED' })] });
    expect(one.totalElements).toBeGreaterThanOrEqual(2);
    expect(one.totalPages).toBe(one.totalElements);
    expect(timestampNanos(two.content[0].createdAt)).toBeLessThanOrEqual(timestampNanos(one.content[0].createdAt));
  });

  test('rejects an unknown status - 400', async ({ admin }) => {
    // when
    const response = await admin.payments.listAll({ status: 'NOPE' as PaymentDto['status'] });

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({ message: 'Invalid value for status' });
  });

  test('requires authentication - 401', async ({ request }) => {
    // when
    const response = await new PaymentsClient(request).listAll();

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });

  test('forbids a customer - 403', async ({ shopper }) => {
    // when
    const response = await shopper.payments.listAll();

    // then
    await expect(response).toHaveStatus(403);
    expect(await response.json()).toEqual({ message: 'Access denied' });
  });
});
