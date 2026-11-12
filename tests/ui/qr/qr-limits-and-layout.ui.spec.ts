import { test, expect } from '@fixtures';
import { QrPage } from '@pages/shop/qr.page';
import { recordRequests } from '@support/network';
import { expectContainedIn, SMALL_PHONE } from '@support/layout';

test.describe('QR code page', { tag: ['@qr'] }, () => {
  test('the text field shows its size against the QR capacity (T-037)', async ({ shopperPage }) => {
    // given
    const qr = new QrPage(shopperPage);
    await qr.goto();

    // when
    await qr.text.fill('Zażółć');

    // then: letters such as ż take two bytes in UTF-8
    await expect(qr.byteCount).toHaveText('10 / 2,953 bytes');
    await expect(qr.text).toHaveAccessibleDescription(/10 \/ 2,953 bytes/);
  });

  test('a text longer than any QR code can hold is explained without a request (T-037)', async ({ shopperPage }) => {
    // given
    const qr = new QrPage(shopperPage);
    await qr.goto();
    const creates = recordRequests(shopperPage, (request) => request.url().includes('/api/v1/qr/create'));

    // when
    await qr.generateFor('a'.repeat(2954));

    // then
    await expect(qr.textError).toContainText('Text is too long for a QR code: 2,954 of 2,953 bytes');
    await expect(qr.text).toHaveAttribute('aria-invalid', 'true');
    await expect(qr.image).toHaveCount(0);
    expect(creates).toEqual([]);
  });

  test('the largest text a QR code holds is still generated (T-037)', async ({ shopperPage }) => {
    // given
    const qr = new QrPage(shopperPage);
    await qr.goto();

    // when
    await qr.generateFor('a'.repeat(2953));

    // then
    await expect(qr.image).toBeVisible();
    await expect(qr.textError).toHaveCount(0);
  });

  test('the generated code stays square on a 320 px screen (T-038)', async ({ shopperPage }) => {
    // given
    await shopperPage.setViewportSize(SMALL_PHONE);
    const qr = new QrPage(shopperPage);
    await qr.goto();

    // when
    await qr.generateFor('https://www.awesome-testing.com');

    // then
    await expect(qr.image).toBeVisible();
    const box = (await qr.image.boundingBox())!;
    expect(Math.abs(box.width - box.height), `QR image ${box.width}x${box.height}`).toBeLessThanOrEqual(1);
    await expectContainedIn(qr.image, qr.result);
    expect(box.x + box.width, 'QR image right edge').toBeLessThanOrEqual(SMALL_PHONE.width);
  });
});
