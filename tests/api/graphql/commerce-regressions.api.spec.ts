import { test, expect } from '@fixtures';
import { GraphQlClient } from '@api/graphql.client';
import type { GraphQlResponse } from '@models/commerce-fixes';

// T-022: money strings have two decimals on every operation, except zero ("0", course contract).
// T-024: updateOrderStatus follows the same forward-only transitions as the REST endpoint.
test.describe('POST /api/v1/graphql - commerce regressions', { tag: ['@graphql'] }, () => {
  test('createProduct echoes the price with the scale a later read returns - 200', async ({ api, shopper }) => {
    // given
    const adminGraphql = new GraphQlClient(api.request, await api.getAdminToken());
    const shopperGraphql = new GraphQlClient(api.request, shopper.token);

    // when
    const created = await adminGraphql.execute(
      'mutation($input: ProductCreateInput!) { createProduct(input: $input) { id price } }',
      { input: { name: `Scale ${Date.now()}`, description: 'GraphQL money scale', price: '12.5', stockQuantity: 3, category: 'Probe' } },
    );
    const createdBody: GraphQlResponse<{ createProduct: { id: string; price: string } }> = await created.json();
    api.trackProduct({ id: Number(createdBody.data!.createProduct.id) });
    const read = await shopperGraphql.execute('query($id: ID!) { product(id: $id) { price } }', { id: createdBody.data!.createProduct.id });
    const emptyCart = await shopperGraphql.execute('{ cart { totalPrice } }');

    // then
    await expect(created).toHaveStatus(200);
    expect(createdBody.errors).toBeUndefined();
    expect(createdBody.data!.createProduct.price).toBe('12.50');
    expect(await read.json()).toEqual({ data: { product: { price: '12.50' } } });
    expect(await emptyCart.json()).toEqual({ data: { cart: { totalPrice: '0' } } });
  });

  test('updateOrderStatus cannot reopen a cancelled order - 200 with BAD_REQUEST', async ({ api, shopper, admin }) => {
    // given
    const { order } = await shopper.placeOrder(20);
    await expect(await admin.orders.updateStatus(order.id, 'CANCELLED'), 'Cancel the order').toHaveStatus(200);
    const adminGraphql = new GraphQlClient(api.request, await api.getAdminToken());

    // when
    const response = await adminGraphql.execute(
      'mutation($id: ID!) { updateOrderStatus(id: $id, status: PAID) { status } }', { id: String(order.id) });

    // then
    await expect(response).toHaveStatus(200);
    const body: GraphQlResponse<{ updateOrderStatus: null }> = await response.json();
    expect(body.data).toEqual({ updateOrderStatus: null });
    expect(body.errors).toEqual([expect.objectContaining({
      message: 'Cannot change order status from CANCELLED to PAID',
      extensions: expect.objectContaining({ code: 'BAD_REQUEST' }),
    })]);
    expect((await shopper.getOrder(order.id)).status).toBe('CANCELLED');
  });
});
