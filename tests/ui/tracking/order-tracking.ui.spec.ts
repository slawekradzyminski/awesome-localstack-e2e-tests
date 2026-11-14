import { test, expect } from '@fixtures';
import { PublicTrackingPage } from '@pages/shop/public-tracking.page';
import { TRACKING_LABELS } from '@pages/components/tracking-timeline.component';
import { deliveryCity, expectedRoute } from '@support/tracking';

test.describe('order details - carrier tracking', { tag: ['@tracking'] }, () => {
  test('shows the timeline of a parcel handed to the simulated carrier', async ({ shopper, parcels, orderDetailsPage }) => {
    // given
    const parcel = await parcels.shipSimulated(shopper, 'UPS');

    // when
    await orderDetailsPage.goto(parcel.orderId);

    // then
    await expect(orderDetailsPage.shipment.parcel(1).status).toHaveText('SHIPPED');
    await expect(orderDetailsPage.shipment.parcel(1).carrierAndNumber).toHaveText(`UPS · ${parcel.trackingNumber}`);
    const { timeline } = orderDetailsPage.shipment.parcel(1);
    await expect(timeline.currentStatus).toHaveText('Label created');
    await expect(timeline.carrier).toHaveText('UPS');
    await expect(timeline.trackingNumber).toHaveText(parcel.trackingNumber);
    await expect(timeline.estimatedDelivery).toHaveText(/^Estimated delivery: .+/);
    await timeline.expectScans(['LABEL_CREATED']);
    const [labelCreated] = expectedRoute('UPS', parcel.trackingNumber);
    await expect(timeline.event(0).description).toHaveText(labelCreated.description);
    await expect(timeline.event(0).location).toHaveText(`${labelCreated.location} · `);
    await expect(orderDetailsPage.shipment.parcel(1).publicTrackingLink).toHaveAttribute('href', `/track/${parcel.trackingNumber}`);
  });

  test('picks up new carrier scans on its 30-second refresh', async ({ shopperPage, shopper, parcels, orderDetailsPage }) => {
    // given
    await shopperPage.clock.install();
    const parcel = await parcels.shipSimulated(shopper, 'DHL', 'direct');
    await orderDetailsPage.goto(parcel.orderId);
    await expect(orderDetailsPage.shipment.parcel(1).timeline.currentStatus).toHaveText('Label created');

    // when
    await parcels.advance(parcel.shipment.id);
    await parcels.advance(parcel.shipment.id);
    await shopperPage.clock.runFor(30_000);

    // then
    await expect(orderDetailsPage.shipment.parcel(1).timeline.currentStatus).toHaveText('In transit');
    await orderDetailsPage.shipment.parcel(1).timeline.expectScans(['LABEL_CREATED', 'IN_TRANSIT', 'IN_TRANSIT']);
    await expect(orderDetailsPage.shipment.parcel(1).timeline.event(2).location).toHaveText(`DHL depot, ${deliveryCity(parcel.trackingNumber)} · `);
  });

  test('shows a delivered parcel with every scan and the delivery time', async ({ shopper, parcels, orderDetailsPage }) => {
    // given
    const parcel = await parcels.shipSimulated(shopper, 'INPOST', 'direct');
    await parcels.advanceTo(parcel, 'DELIVERED');
    await shopper.waitForOrderStatus(parcel.orderId, 'DELIVERED');

    // when
    await orderDetailsPage.goto(parcel.orderId);

    // then
    await expect(orderDetailsPage.shipment.parcel(1).status).toHaveText('DELIVERED');
    await expect(orderDetailsPage.shipment.parcel(1).timeline.currentStatus).toHaveText('Delivered');
    await expect(orderDetailsPage.shipment.parcel(1).timeline.estimatedDelivery).toHaveText(/^Delivered: .+/);
    await orderDetailsPage.shipment.parcel(1).timeline.expectScans(['LABEL_CREATED', 'IN_TRANSIT', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED']);
    await expect(orderDetailsPage.shipment.parcel(1).timeline.event(4).description).toHaveText('Delivered to the parcel locker');
  });

  test('highlights a failed delivery attempt', async ({ shopper, parcels, orderDetailsPage }) => {
    // given
    const parcel = await parcels.shipSimulated(shopper, 'DPD', 'failsFirstAttempt');
    await parcels.advanceTo(parcel, 'DELIVERY_FAILED');

    // when
    await orderDetailsPage.goto(parcel.orderId);

    // then
    await expect(orderDetailsPage.shipment.parcel(1).timeline.currentStatus).toHaveText(TRACKING_LABELS.DELIVERY_FAILED);
    await orderDetailsPage.shipment.parcel(1).timeline.expectScans(['LABEL_CREATED', 'IN_TRANSIT', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERY_FAILED']);
    await expect(orderDetailsPage.shipment.parcel(1).timeline.event(4).root).toHaveAttribute('data-status', 'DELIVERY_FAILED');
    await expect(orderDetailsPage.shipment.parcel(1).timeline.event(4).description)
      .toHaveText('Delivery attempt failed: the recipient was not available. The courier will try again');
  });

  test('copies the tracking number to the clipboard', async ({ shopperPage, context, shopper, parcels, orderDetailsPage }) => {
    // given
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const parcel = await parcels.shipSimulated(shopper);
    await orderDetailsPage.goto(parcel.orderId);

    // when
    await orderDetailsPage.shipment.parcel(1).timeline.copyNumber();

    // then
    await expect(orderDetailsPage.shipment.parcel(1).timeline.copyStatus).toHaveText('Copied');
    expect(await shopperPage.evaluate(() => navigator.clipboard.readText())).toBe(parcel.trackingNumber);
  });

  test('opens the shareable public tracking page from the order', async ({ shopperPage, shopper, parcels, orderDetailsPage }) => {
    // given
    const parcel = await parcels.shipSimulated(shopper);
    await orderDetailsPage.goto(parcel.orderId);

    // when
    await orderDetailsPage.shipment.parcel(1).openPublicTracking();

    // then
    await expect(shopperPage).toHaveURL(`/track/${parcel.trackingNumber}`);
    await expect(new PublicTrackingPage(shopperPage).timeline.trackingNumber).toHaveText(parcel.trackingNumber);
  });

  test('shows no carrier timeline before the parcel is handed to the carrier', async ({ shopper, parcels, orderDetailsPage }) => {
    // given
    const { orderId } = await parcels.packed(shopper);

    // when
    await orderDetailsPage.goto(orderId);

    // then
    await expect(orderDetailsPage.shipment.parcel(1).status).toHaveText('PACKED');
    await expect(orderDetailsPage.shipment.parcel(1).carrierAndNumber).toBeHidden();
    await expect(orderDetailsPage.shipment.parcel(1).tracking).toBeHidden();
  });

  test('explains that an unpaid order is not with the warehouse yet', async ({ shopper, orderDetailsPage }) => {
    // given
    const { order } = await shopper.placeOrder();

    // when
    await orderDetailsPage.goto(order.id);

    // then
    await expect(orderDetailsPage.shipment.none).toHaveText('Not handed to the warehouse yet. Orders are packed once payment is confirmed.');
    await expect(orderDetailsPage.shipment.parcel(1).tracking).toBeHidden();
  });
});
