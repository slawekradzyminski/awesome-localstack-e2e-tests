import { test, expect } from '@fixtures';
import { addresses } from '@support/addresses';
import { recordRequests } from '@support/network';

// X-30: checkout let whitespace and ZIP codes such as 12abc through, showed the backend's field errors
// only in a native alert() and cancelled orders after a native confirm(). Since frontend 3.14.0 the
// rules match the backend, server field errors appear under their fields and cancelling asks in-app.
test.describe('checkout and order cancel without native dialogs', { tag: ['@orders'] }, () => {
  test('whitespace and a malformed ZIP code are rejected before any order request (X-30)', async ({ shopper, checkoutPage, shopperPage }) => {
    // given
    await shopper.fillCart();
    const orderPosts = recordRequests(shopperPage, (request) => request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/orders');
    await checkoutPage.goto();
    await checkoutPage.fillAddress({ ...addresses.poland, street: '   ', zipCode: '12abc' });

    // when
    await checkoutPage.submitButton.click();

    // then
    await expect(shopperPage.getByTestId('checkout-street-error')).toHaveText('Street address is required');
    await expect(shopperPage.getByTestId('checkout-zip-error')).toHaveText('Invalid postal/zip code format');
    expect(orderPosts).toEqual([]);
  });

  test("the backend's field errors are shown under their fields, never in a native dialog (X-30)", async ({ shopper, checkoutPage, shopperPage }) => {
    // given: the order request reaches the real backend with a blank street and a bad ZIP code
    await shopper.fillCart();
    const nativeDialogs: string[] = [];
    shopperPage.on('dialog', (dialog) => {
      nativeDialogs.push(dialog.message());
      void dialog.dismiss();
    });
    await shopperPage.route('**/api/v1/orders', (route) => route.continue({
      postData: JSON.stringify({ ...route.request().postDataJSON(), street: ' ', zipCode: '12abc' }),
    }));
    await checkoutPage.goto();
    await checkoutPage.fillAddress(addresses.poland);

    // when
    const response = shopperPage.waitForResponse((candidate) => new URL(candidate.url()).pathname === '/api/v1/orders');
    await checkoutPage.submitButton.click();

    // then
    await expect(await response, 'Order with a blank street and a malformed ZIP code').toHaveStatus(400);
    await expect(shopperPage.getByTestId('checkout-street-error')).toHaveText('Street is required');
    await expect(shopperPage.getByTestId('checkout-zip-error')).toHaveText('Invalid postal/zip code format');
    await expect(shopperPage).toHaveURL(/\/checkout$/);
    expect(nativeDialogs).toEqual([]);
  });

  test('cancelling an order asks in an in-app dialog that Escape dismisses (X-30)', async ({ shopper, orderDetailsPage, shopperPage }) => {
    // given
    const { order } = await shopper.placeOrder();
    const nativeDialogs: string[] = [];
    shopperPage.on('dialog', (dialog) => {
      nativeDialogs.push(dialog.message());
      void dialog.dismiss();
    });
    await orderDetailsPage.goto(order.id);
    const confirmation = shopperPage.getByRole('dialog', { name: `Cancel order #${order.id}?` });

    // when
    await shopperPage.getByTestId('order-details-cancel-button').click();
    await expect(confirmation).toBeVisible();
    await shopperPage.keyboard.press('Escape');

    // then
    await expect(confirmation).toHaveCount(0);
    await expect(orderDetailsPage.status).toHaveText('PENDING');

    // when
    await shopperPage.getByTestId('order-details-cancel-button').click();
    await shopperPage.getByTestId('order-cancel-dialog-confirm').click();

    // then
    await expect(orderDetailsPage.status).toHaveText('CANCELLED');
    expect(nativeDialogs).toEqual([]);
  });
});
