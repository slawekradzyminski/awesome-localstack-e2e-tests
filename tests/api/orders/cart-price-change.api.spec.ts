import { test, expect } from '@fixtures';
import type { CartWithLinesDto } from '@models/commerce-fixes';
import type { OrderDto } from '@models/order';

// T-023: the cart keeps, and checkout charges, the price of the moment a line was added or updated
// (the course contract's price snapshot); a line whose product price changed since then is flagged.
test.describe('GET /api/v1/cart - price change notice', { tag: ['@orders'] }, () => {
  test('flags a changed price on the line and checkout charges the cart price - 200', async ({ api, shopper }) => {
    // given
    const { product } = await shopper.fillCart({ price: 10 }, 2);
    await expect(await (await api.adminProducts()).update(product.id, { price: 20 }), 'Raise the price').toHaveStatus(200);

    // when
    const response = await shopper.cart.getCart();
    const order: OrderDto = await shopper.checkout();

    // then
    await expect(response).toHaveStatus(200);
    const cart: CartWithLinesDto = await response.json();
    expect(cart.items).toEqual([{ productId: product.id, quantity: 2, priceChanged: true, unitPrice: 10, currentPrice: 20 }]);
    expect(cart.totalPrice).toBe(20);
    expect(order.totalAmount).toBe(cart.totalPrice);
    expect(order.items).toEqual([expect.objectContaining({ productId: product.id, quantity: 2, unitPrice: 10, totalPrice: 20 })]);
  });

  test('an unchanged line keeps only productId and quantity - 200', async ({ shopper }) => {
    // given
    const { product } = await shopper.fillCart({ price: 10 }, 1);

    // when
    const response = await shopper.cart.getCart();

    // then
    await expect(response).toHaveStatus(200);
    expect(((await response.json()) as CartWithLinesDto).items).toEqual([{ productId: product.id, quantity: 1 }]);
  });

  test('updating the line takes the current price and clears the notice - 200', async ({ api, shopper }) => {
    // given
    const { product } = await shopper.fillCart({ price: 10 }, 3);
    await expect(await (await api.adminProducts()).update(product.id, { price: 8 }), 'Lower the price').toHaveStatus(200);

    // when
    const response = await shopper.cart.updateItem(product.id, { quantity: 3 });

    // then
    await expect(response).toHaveStatus(200);
    const cart: CartWithLinesDto = await response.json();
    expect(cart.items).toEqual([{ productId: product.id, quantity: 3 }]);
    expect(cart.totalPrice).toBe(24);
  });
});
