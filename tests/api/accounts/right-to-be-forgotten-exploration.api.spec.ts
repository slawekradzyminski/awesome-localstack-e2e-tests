import { test, expect } from '@fixtures';
import { CartClient } from '@api/cart.client';
import { ExplorationFunctionalClient } from '@api/exploration-functional.client';
import { OrdersClient } from '@api/orders.client';
import { PaymentsClient, TEST_CARDS, card } from '@api/payments.client';
import { UsersClient } from '@api/users.client';
import { ASYNC_TIMEOUT, POLL_INTERVALS } from '@config';
import type { OrderDto, OrderStatus } from '@models/order';
import type { PaymentDto } from '@models/payment';
import type { ProductDto } from '@models/product';
import { addresses } from '@support/addresses';
import type { ApiTestContext } from '@support/api-test-context';
import { generateUser } from '@support/generators/user.generator';

// X-06: erasing an account cancels its open orders first, so their stock goes back to the catalogue and
// card payments are refunded. The user is registered outside the api fixture because the test deletes it.
test.describe('DELETE /api/v1/users/{username}/right-to-be-forgotten - open orders', { tag: ['@accounts', '@orders'] }, () => {
  test('restores the stock of PENDING and PAID orders but not of DELIVERED ones - 204', async ({ api, admin }) => {
    // given
    const customer = await forgettableCustomer(api);
    const pendingProduct = await api.createProduct({ stockQuantity: 5, price: 10 });
    const paidProduct = await api.createProduct({ stockQuantity: 5, price: 10 });
    const deliveredProduct = await api.createProduct({ stockQuantity: 5, price: 10 });
    await customer.order(pendingProduct, 2);
    const paid = await customer.order(paidProduct, 3);
    const delivered = await customer.order(deliveredProduct, 1);
    await expect(await admin.orders.updateStatus(paid.id, 'PAID'), 'Mark the order paid').toHaveStatus(200);
    await expect(await admin.orders.updateStatus(delivered.id, 'DELIVERED'), 'Mark the order delivered').toHaveStatus(200);
    expect(await admin.stockOf(pendingProduct.id)).toBe(3);

    // when
    const response = await customer.client.forget(customer.username);

    // then
    await expect(response).toHaveStatus(204);
    // the cancelled orders' stock comes back through warehouse-service (backend 3.22.0, asynchronous)
    await admin.waitForStock(pendingProduct.id, 5);
    await admin.waitForStock(paidProduct.id, 5);
    expect(await admin.stockOf(deliveredProduct.id)).toBe(4);
    await expect(await admin.orders.getById(paid.id), 'The erased order is gone').toHaveStatus(404);
  });

  test('refunds the card payment of a paid order through the event feed - 204', { tag: ['@payments', '@slow'] },
    async ({ api, admin }) => {
      // given
      const customer = await forgettableCustomer(api);
      const product = await api.createProduct({ stockQuantity: 5, price: 18 });
      const order = await customer.order(product, 1);
      const payment = await customer.payByCard(order.id);

      // when
      const response = await customer.client.forget(customer.username);

      // then
      await expect(response).toHaveStatus(204);
      await admin.waitForStock(product.id, 5);
      await expect.poll(async () => paymentStatus(admin.payments, payment.id),
        { message: `payment ${payment.id} is refunded`, timeout: ASYNC_TIMEOUT, intervals: POLL_INTERVALS })
        .toBe('REFUNDED');
    });
});

async function forgettableCustomer(api: ApiTestContext) {
  const user = generateUser();
  await expect(await new UsersClient(api.request).register(user), 'Register a customer to erase').toHaveStatus(201);
  const token = await api.login(user.username, user.password);
  const cart = new CartClient(api.request, token);
  const orders = new OrdersClient(api.request, token);
  const payments = new PaymentsClient(api.request, token);
  return {
    username: user.username,
    client: new ExplorationFunctionalClient(api.request, token),
    async order(product: ProductDto, quantity: number): Promise<OrderDto> {
      await expect(await cart.addItem({ productId: product.id, quantity }), 'Add to cart').toHaveStatus(200);
      const response = await orders.create(addresses.poland);
      await expect(response, 'Checkout').toHaveStatus(201);
      return response.json();
    },
    async payByCard(orderId: number): Promise<PaymentDto> {
      const response = await payments.create({ orderId, card: card(TEST_CARDS.visa) });
      await expect(response, 'Pay by card').toHaveStatus(201);
      await expect.poll(async () => orderStatus(orders, orderId),
        { message: `order ${orderId} becomes PAID`, timeout: ASYNC_TIMEOUT, intervals: POLL_INTERVALS }).toBe('PAID');
      return response.json();
    },
  };
}

async function orderStatus(orders: OrdersClient, orderId: number): Promise<OrderStatus> {
  return ((await (await orders.getById(orderId)).json()) as OrderDto).status;
}

async function paymentStatus(payments: PaymentsClient, paymentId: string): Promise<PaymentDto['status']> {
  return ((await (await payments.getById(paymentId)).json()) as PaymentDto).status;
}
