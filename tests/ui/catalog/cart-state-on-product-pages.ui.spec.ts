import { test, expect } from '@fixtures';
import { ProductDetailsPage } from '@pages/shop/product-details.page';

const CART = '**/api/v1/cart';

test.describe('cart state on product pages', { tag: ['@catalog'] }, () => {
  test('a failed cart read is not shown as "not in cart" (T-065)', async ({ shopper, shopperPage }) => {
    // given: the product is already in the cart, but the cart cannot be read
    const { product } = await shopper.fillCart({}, 2);
    await shopperPage.route(CART, (route) => (route.request().method() === 'GET'
      ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Internal server error' }) })
      : route.continue()));
    const details = new ProductDetailsPage(shopperPage);

    // when
    await details.goto(product.id);

    // then
    await expect(details.cartUnavailable).toBeVisible();
    await expect(details.addToCart).toBeDisabled();

    // when
    await shopperPage.unroute(CART);
    await details.retryCart.click();

    // then
    await expect(details.cartUnavailable).toBeHidden();
    await expect(details.addToCart).toHaveText('Update Cart');
    await expect(details.cartQuantity).toHaveText('2 in cart');
  });

  test('the Shop API selector stays disabled while a cart write is pending (T-066)', async ({ api, shopperPage }) => {
    // given
    const product = await api.createProduct();
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    await shopperPage.route('**/api/v1/cart/items', async (route) => {
      await held;
      await route.continue();
    });
    const details = new ProductDetailsPage(shopperPage);
    await details.goto(product.id);
    await expect(details.shopApi).toBeEnabled();

    // when
    await details.addToCart.click();

    // then
    await expect(details.shopApi).toBeDisabled();

    // when
    release();

    // then
    await expect(details.cartQuantity).toHaveText('1 in cart');
    await expect(details.shopApi).toBeEnabled();
  });
});
