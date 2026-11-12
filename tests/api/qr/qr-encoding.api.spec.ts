import { test, expect } from '@fixtures';
import { QrClient } from '@api/qr.client';

// T-036 / T-037: QR codes keep non-Latin-1 text, and text beyond QR capacity is a 400 field error.
test.describe('POST /api/v1/qr/create - encoding and capacity', { tag: ['@qr'] }, () => {
  test('encodes Polish letters and emoji instead of replacing them with "?" - 200', async ({ api, shopper }) => {
    // given
    const qr = new QrClient(api.request, shopper.token);

    // when
    const unicode = await qr.create('Zażółć gęślą jaźń 😀');
    const degraded = await qr.create('Za?ó?? g??l? ja?? ?');

    // then
    await expect(unicode).toHaveStatus(200);
    await expect(degraded).toHaveStatus(200);
    expect(unicode.headers()['content-type']).toBe('image/png');
    // Before the fix both texts were written as the same ISO-8859-1 bytes, so the images were identical.
    expect(Buffer.compare(await unicode.body(), await degraded.body())).not.toBe(0);
  });

  test('accepts the largest ASCII text a QR code holds - 200', async ({ api, shopper }) => {
    // given
    const qr = new QrClient(api.request, shopper.token);

    // when
    const response = await qr.create('a'.repeat(2953));

    // then
    await expect(response).toHaveStatus(200);
  });

  const tooLong: [string, string][] = [
    ['ASCII text one byte over the capacity', 'a'.repeat(2954)],
    ['fewer two-byte letters than the ASCII limit', 'ż'.repeat(1500)],
  ];
  for (const [name, text] of tooLong) {
    test(`rejects ${name} with a field error - 400`, async ({ api, shopper }) => {
      // given
      const qr = new QrClient(api.request, shopper.token);

      // when
      const response = await qr.create(text);

      // then
      await expect(response).toHaveStatus(400);
      expect(await response.json()).toEqual({ text: 'Text is too long for a QR code' });
    });
  }
});
