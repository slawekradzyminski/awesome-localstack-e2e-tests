import { test, expect } from '@fixtures';
import { AdminInventoryPage } from '@pages/admin/admin-inventory.page';
import { OrderStatusControl } from '@pages/admin/order-status-control.component';
import { recordRequests } from '@support/network';

test.describe('admin pages for keyboard and screen reader users', { tag: ['@admin'] }, () => {
  test('an inventory row opens from the keyboard (T-047)', async ({ api, adminPage }) => {
    // given
    const product = await api.createProduct();
    const inventory = new AdminInventoryPage(adminPage);
    await inventory.goto();
    await inventory.searchFor(product.name);

    // when
    await inventory.productLink(product.id).focus();
    await adminPage.keyboard.press('Enter');

    // then
    await expect(adminPage).toHaveURL(new RegExp(`/admin/inventory/${product.id}$`));
    await expect(inventory.selectedName).toHaveText(product.name);
    await expect(inventory.productLink(product.id)).toHaveAttribute('aria-current', 'true');
  });

  test('the order status select is named "Order status" (T-048)', async ({ shopper, adminPage }) => {
    // given
    const { order } = await shopper.placeOrder(40);
    const control = new OrderStatusControl(adminPage);

    // when
    await adminPage.goto(`/orders/${order.id}`);

    // then
    await expect(control.select).toBeVisible();
    await expect(control.select).toHaveValue('PENDING');
  });

  test('an order id beyond the safe integer range is not found at once (T-064)', async ({ adminPage }) => {
    // given
    const control = new OrderStatusControl(adminPage);
    const orderReads = recordRequests(adminPage, (request) => /\/api\/v1\/orders\/\d+$/.test(new URL(request.url()).pathname));

    // when
    await adminPage.goto('/orders/9223372036854775807');

    // then
    await expect(control.notFound).toHaveText('Order not found', { timeout: 2_000 });
    await expect(control.loading).toBeHidden();
    expect(orderReads).toEqual([]);
  });
});
