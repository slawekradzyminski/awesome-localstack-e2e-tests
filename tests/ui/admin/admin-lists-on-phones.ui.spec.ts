import { test } from '@fixtures';
import { AdminOrderListPage } from '@pages/admin/admin-order-list.page';
import { AdminProductListPage } from '@pages/admin/admin-product-list.page';
import { expectReachable, PHONE } from '@support/layout';

test.describe('admin lists on phones', { tag: ['@admin'] }, () => {
  test('product Edit and Delete stay reachable (T-058)', async ({ api, adminPage }) => {
    // given
    const product = await api.createProduct({ category: 'A long category name for a narrow table' });
    await adminPage.setViewportSize(PHONE);
    const products = new AdminProductListPage(adminPage);

    // when
    await products.goto();

    // then
    await expectReachable(products.editLink(product.id));
    await expectReachable(products.deleteButton(product.id));
  });

  test('order View Details stays reachable (T-058)', async ({ shopper, adminPage }) => {
    // given
    await shopper.placeOrder(30);
    await adminPage.setViewportSize(PHONE);
    const orders = new AdminOrderListPage(adminPage);

    // when
    await orders.goto();

    // then
    await expectReachable(orders.table.getByRole('link', { name: 'View Details' }).first());
  });
});
