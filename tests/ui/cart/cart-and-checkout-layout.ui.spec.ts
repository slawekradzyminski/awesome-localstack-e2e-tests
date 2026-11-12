import { test, expect } from '@fixtures';
import { expectNoHorizontalPageOverflow, expectReachable, expectReadableText } from '@support/layout';

test.describe('cart and checkout readability', { tag: ['@cart'] }, () => {
  for (const viewport of [{ width: 393, height: 852 }, { width: 768, height: 1024 }]) {
    test(`cart quantity and Remove stay on screen at ${viewport.width}px (T-061)`, async ({ shopper, cartPage, shopperPage }) => {
      // given
      const { product } = await shopper.fillCart({ price: 19.99 }, 2);
      await shopperPage.setViewportSize(viewport);

      // when
      await cartPage.goto();

      // then
      await expect(cartPage.itemPrice(product.id)).toHaveText('$19.99');
      await expect(cartPage.itemTotal(product.id)).toHaveText('$39.98');
      await expectReachable(shopperPage.getByTestId(`cart-item-increase-${product.id}`));
      await expectReachable(shopperPage.getByTestId(`cart-item-remove-${product.id}`));
      await expectNoHorizontalPageOverflow(cartPage.content);
    });
  }

  test('checkout field errors are readable (T-049)', async ({ shopper, checkoutPage, shopperPage }) => {
    // given
    await shopper.fillCart();
    await checkoutPage.goto();

    // when
    await checkoutPage.submitButton.click();

    // then
    const streetError = shopperPage.getByTestId('checkout-street-error');
    await expect(streetError).toBeVisible();
    await expectReadableText(streetError);
  });
});
