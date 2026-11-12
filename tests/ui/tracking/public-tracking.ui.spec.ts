import { test, expect } from '@fixtures';
import { recordRequests } from '@support/network';
import { expectedRoute } from '@support/tracking';

// Anonymous visitor: the default `page` fixture has no session.
test.describe('public parcel tracking /track', { tag: ['@tracking'] }, () => {
  test('finds a parcel by its number without signing in', async ({ page, shopper, parcels, publicTrackingPage }) => {
    // given
    const parcel = await parcels.shipSimulated(shopper, 'DPD');
    await parcels.advance(parcel.shipment.id);
    await publicTrackingPage.goto();
    await expect(publicTrackingPage.title).toHaveText('Track a parcel');

    // when
    await publicTrackingPage.track(parcel.trackingNumber);

    // then
    await expect(page).toHaveURL(`/track/${parcel.trackingNumber}`);
    await expect(publicTrackingPage.timeline.currentStatus).toHaveText('In transit');
    await expect(publicTrackingPage.timeline.carrier).toHaveText('DPD');
    await expect(publicTrackingPage.timeline.trackingNumber).toHaveText(parcel.trackingNumber);
    await publicTrackingPage.timeline.expectScans(['LABEL_CREATED', 'IN_TRANSIT']);
    await expect(publicTrackingPage.timeline.event(1).location).toHaveText(`${expectedRoute('DPD', parcel.trackingNumber)[1].location} · `);
    await expect(publicTrackingPage.root).not.toContainText(shopper.username);
  });

  test('normalises a pasted number with spaces and lower-case letters', async ({ page, shopper, parcels, publicTrackingPage }) => {
    // given
    const parcel = await parcels.shipSimulated(shopper, 'UPS');
    await publicTrackingPage.goto();
    const pasted = `${parcel.trackingNumber.slice(0, 6)} ${parcel.trackingNumber.slice(6)}`.toLowerCase();

    // when
    await publicTrackingPage.track(pasted);

    // then
    await expect(page).toHaveURL(`/track/${parcel.trackingNumber}`);
    await expect(publicTrackingPage.timeline.trackingNumber).toHaveText(parcel.trackingNumber);
  });

  test('opens a deep link with the number filled in', async ({ shopper, parcels, publicTrackingPage }) => {
    // given
    const parcel = await parcels.shipSimulated(shopper, 'UPS');

    // when
    await publicTrackingPage.goto(parcel.trackingNumber.toLowerCase());

    // then
    await expect(publicTrackingPage.input).toHaveValue(parcel.trackingNumber);
    await expect(publicTrackingPage.timeline.currentStatus).toHaveText('Label created');
  });

  test('tells the visitor when no parcel has the number', async ({ publicTrackingPage }) => {
    // given
    await publicTrackingPage.goto();

    // when
    await publicTrackingPage.track('0000000000');

    // then
    await expect(publicTrackingPage.notFound).toHaveText('No parcel with tracking number 0000000000 was found. Check the number and try again.');
    await expect(publicTrackingPage.timeline.currentStatus).toBeHidden();
  });

  const invalidNumbers: [string, string, string][] = [
    ['an empty number', '   ', 'Enter a tracking number'],
    ['characters other than letters and digits', '1Z-999/AA', 'Use letters and digits only'],
    ['more than 40 characters', '1'.repeat(41), 'Tracking numbers are at most 40 characters'],
  ];
  for (const [name, input, message] of invalidNumbers) {
    test(`rejects ${name} before looking it up`, async ({ page, publicTrackingPage }) => {
      // given
      await publicTrackingPage.goto();
      const lookups = recordRequests(page, (request) => request.url().includes('/api/v1/tracking/'));

      // when
      await publicTrackingPage.track(input);

      // then
      await expect(publicTrackingPage.inputError).toHaveText(message);
      await expect(publicTrackingPage.input).toHaveAttribute('aria-invalid', 'true');
      await expect(page).toHaveURL('/track');
      expect(lookups).toEqual([]);
    });
  }

  test('shows a loading state while the carrier is asked', async ({ page, publicTrackingPage }) => {
    // given
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/v1/tracking/**', async route => { await held; await route.continue(); });

    // when
    await publicTrackingPage.goto('0000000000');

    // then
    await expect(publicTrackingPage.loading).toHaveText('Looking up 0000000000…');
    release();
    await expect(publicTrackingPage.notFound).toBeVisible();
  });

  test('shows a temporary error when tracking is unavailable', async ({ page, publicTrackingPage }) => {
    // given
    await page.route('**/api/v1/tracking/**', route => route.fulfill({ status: 503, json: { message: 'Backend unavailable' } }));

    // when
    await publicTrackingPage.goto('1234567890');

    // then
    await expect(publicTrackingPage.error).toHaveText('Tracking is unavailable right now. Please try again in a moment.');
  });
});
