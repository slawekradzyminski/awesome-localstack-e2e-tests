import { test, expect } from '@fixtures';
import { randomUUID } from 'node:crypto';
import { ADMIN_PASSWORD, ADMIN_USERNAME, APP_BASE_URL } from '@config';
import { AdminCouponsClient, CartCouponClient } from '@api/coupons.client';
import { AdminCouponsPage } from '@pages/admin/admin-coupons.page';
import { signInBrowser } from '@support/browser-session';
import type { CouponDto } from '@models/coupon';

// A datetime-local value in the given zone, the format the coupon form takes.
const localInput = (instant: Date, timeZone: string) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};

const uniqueCode = () => `UTC-${randomUUID().slice(0, 8)}`.toUpperCase();

test.describe('coupon validity window', { tag: ['@coupons'] }, () => {
  const createdCoupons: number[] = [];

  // Both tests apply their coupon to the shopper's cart; it leaves the cart before the coupon is deleted.
  test.afterEach(async ({ api, shopper }) => {
    await expect(await new CartCouponClient(api.request, shopper.token).remove(), 'Remove the coupon from the cart').toHaveStatus([200, 204]);
    const coupons = new AdminCouponsClient(api.request, await api.getAdminToken());
    for (const couponId of createdCoupons.splice(0)) {
      await expect(await coupons.remove(couponId), `Delete test coupon ${couponId}`).toHaveStatus(204);
    }
  });

  test('the API reads a validity window sent as UTC instants (T-068)', async ({ api, shopper }) => {
    // given
    const coupons = new AdminCouponsClient(api.request, await api.getAdminToken());
    const code = uniqueCode();
    const validFrom = new Date(Date.now() - 60_000);
    const validUntil = new Date(Date.now() + 24 * 3600_000);

    // when
    const created = await coupons.create({ code, type: 'PERCENTAGE', value: 10, validFrom: validFrom.toISOString(), validUntil: validUntil.toISOString() });

    // then
    await expect(created, 'Create a coupon with Z timestamps').toHaveStatus(201);
    const coupon: CouponDto = await created.json();
    createdCoupons.push(coupon.id);
    expect(coupon.validFrom?.slice(0, 16)).toBe(validFrom.toISOString().slice(0, 16));
    expect(coupon.status).toBe('ACTIVE');
    await shopper.fillCart({ price: 50 });
    await expect(await new CartCouponClient(api.request, shopper.token).apply(code), 'Apply the coupon at once').toHaveStatus(200);
  });

  test('a coupon an admin east of UTC makes valid from now applies at once (T-068)', async ({ browser, baseURL, request, api, shopper }) => {
    // given: an administrator in Warsaw (UTC+1) creates a coupon valid from the current minute
    const zone = 'Europe/Warsaw';
    const context = await browser.newContext({ baseURL: baseURL ?? APP_BASE_URL, timezoneId: zone });
    const code = uniqueCode();
    const now = new Date();
    try {
      await signInBrowser(context, request, { username: ADMIN_USERNAME, password: ADMIN_PASSWORD });
      const page = await context.newPage();
      const adminCoupons = new AdminCouponsPage(page);
      await adminCoupons.goto();
      const saved = page.waitForResponse((response) => response.url().endsWith('/api/v1/admin/coupons') && response.request().method() === 'POST');

      // when
      await adminCoupons.create({ code, percent: 10, validFrom: localInput(now, zone), validUntil: localInput(new Date(now.getTime() + 2 * 3600_000), zone) });

      // then
      const response = await saved;
      await expect(response, 'Create the coupon from the form').toHaveStatus(201);
      const coupon: CouponDto = await response.json();
      createdCoupons.push(coupon.id);
      expect(coupon.status).toBe('ACTIVE');
      expect(coupon.validFrom?.slice(0, 16)).toBe(now.toISOString().slice(0, 16));
      await shopper.fillCart({ price: 50 });
      await expect(await new CartCouponClient(api.request, shopper.token).apply(code), 'Apply the new coupon').toHaveStatus(200);

      // when
      await adminCoupons.edit(coupon.id);

      // then: the form shows the window in the admin's local time again
      await expect(adminCoupons.validFrom).toHaveValue(localInput(now, zone));
    } finally {
      await context.close();
    }
  });
});
