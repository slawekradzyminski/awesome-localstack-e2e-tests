import { test, expect } from '@fixtures';
import { TrackingClient } from '@api/warehouse.client';
import { expectedRoute, scans } from '@support/tracking';
import type { TrackingDto } from '@models/shipment';

test.describe('GET /api/v1/orders/{id}/shipment/tracking', { tag: ['@tracking'] }, () => {
  test('returns the carrier tracking of the caller\'s order - 200', async ({ shopper, parcels }) => {
    // given
    const parcel = await parcels.shipSimulated(shopper, 'UPS');
    await parcels.advance(parcel.shipment.id);

    // when
    const response = await shopper.tracking.orderTracking(parcel.orderId);

    // then
    await expect(response).toHaveStatus(200);
    const tracking: TrackingDto = await response.json();
    expect(tracking).toEqual({
      shipmentId: parcel.shipment.id,
      orderId: parcel.orderId,
      carrier: 'UPS',
      trackingNumber: parcel.trackingNumber,
      simulated: true,
      currentStatus: 'IN_TRANSIT',
      estimatedDelivery: expect.any(String),
      events: expectedRoute('UPS', parcel.trackingNumber).slice(0, 2).map(scan => ({ ...scan, occurredAt: expect.any(String) })),
    });
  });

  test('returns empty tracking before the parcel is handed to the carrier - 200', async ({ shopper, parcels }) => {
    // given
    const { orderId, shipment } = await parcels.packed(shopper);

    // when
    const response = await shopper.tracking.orderTracking(orderId);

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual({
      shipmentId: shipment.id,
      orderId,
      carrier: null,
      trackingNumber: null,
      simulated: false,
      currentStatus: null,
      estimatedDelivery: null,
      events: [],
    });
  });

  test('lets an administrator track any customer\'s order - 200', async ({ shopper, parcels, request, api }) => {
    // given
    const parcel = await parcels.shipSimulated(shopper);

    // when
    const response = await new TrackingClient(request, await api.getAdminToken()).orderTracking(parcel.orderId);

    // then
    await expect(response).toHaveStatus(200);
    const tracking: TrackingDto = await response.json();
    expect(tracking).toMatchObject({ orderId: parcel.orderId, trackingNumber: parcel.trackingNumber, currentStatus: 'LABEL_CREATED' });
    expect(scans(tracking)).toEqual(expectedRoute('DHL', parcel.trackingNumber).slice(0, 1));
  });

  test('hides another customer\'s order as not found - 404', async ({ shopper, otherShopper, parcels }) => {
    // given
    const parcel = await parcels.shipSimulated(shopper);

    // when
    const response = await otherShopper.tracking.orderTracking(parcel.orderId);

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual({ message: 'Order not found' });
  });

  test('hides another customer\'s order that has no shipment yet as not found - 404', async ({ shopper, otherShopper }) => {
    // given
    const { order } = await shopper.placeOrder();

    // when
    const response = await otherShopper.tracking.orderTracking(order.id);

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual({ message: 'Order not found' });
  });

  test('reports an order that was not released to the warehouse - 404', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder();

    // when
    const response = await shopper.tracking.orderTracking(order.id);

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual({ message: 'Shipment not found' });
  });

  test('reports a paid order without a shipment - 404', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder();
    await shopper.payAndWaitForPaid(order.id);

    // when
    const response = await shopper.tracking.orderTracking(order.id);

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual({ message: 'Shipment not found' });
  });

  test('returns not found for an unknown order - 404', async ({ shopper }) => {
    // when
    const response = await shopper.tracking.orderTracking(2_147_483_647);

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual({ message: 'Order not found' });
  });

  test('requires authentication - 401', async ({ request }) => {
    // when
    const response = await new TrackingClient(request).orderTracking(1);

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});
