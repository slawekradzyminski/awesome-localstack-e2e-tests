import { test, expect } from '@fixtures';
import { TrackingClient } from '@api/warehouse.client';
import { expectedRoute, scans } from '@support/tracking';
import type { PublicTrackingDto } from '@models/shipment';

test.describe('GET /api/v1/tracking/{trackingNumber}', { tag: ['@tracking'] }, () => {
  test('tracks a parcel anonymously without revealing the order or customer - 200', async ({ shopper, parcels, request }) => {
    // given
    const parcel = await parcels.shipSimulated(shopper, 'DPD');
    await parcels.advance(parcel.shipment.id);

    // when
    const response = await new TrackingClient(request).publicTracking(parcel.trackingNumber);

    // then
    await expect(response).toHaveStatus(200);
    const tracking: PublicTrackingDto = await response.json();
    expect(tracking).toEqual({
      shipmentId: parcel.shipment.id,
      carrier: 'DPD',
      trackingNumber: parcel.trackingNumber,
      simulated: true,
      currentStatus: 'IN_TRANSIT',
      estimatedDelivery: expect.any(String),
      events: expectedRoute('DPD', parcel.trackingNumber).slice(0, 2).map(scan => ({ ...scan, occurredAt: expect.any(String) })),
    });
    const body = await response.text();
    expect(body).not.toContain(shopper.username);
    expect(body).not.toContain('orderId');
  });

  test('ignores surrounding spaces and letter case of the tracking number - 200', async ({ shopper, parcels, request }) => {
    // given
    const parcel = await parcels.shipSimulated(shopper, 'UPS');

    // when
    const response = await new TrackingClient(request).publicTracking(` ${parcel.trackingNumber.toLowerCase()} `);

    // then
    await expect(response).toHaveStatus(200);
    const tracking: PublicTrackingDto = await response.json();
    expect(tracking).toMatchObject({ trackingNumber: parcel.trackingNumber, carrier: 'UPS' });
    expect(scans(tracking)).toEqual(expectedRoute('UPS', parcel.trackingNumber).slice(0, 1));
  });

  test('shows a delivered parcel with its delivery time as the estimate - 200', async ({ shopper, parcels, warehouse, request }) => {
    // given
    const parcel = await parcels.shipSimulated(shopper);
    await parcels.advanceTo(parcel, 'DELIVERED');
    const shipment = await (await warehouse.client.getShipment(parcel.shipment.id)).json();

    // when
    const response = await new TrackingClient(request).publicTracking(parcel.trackingNumber);

    // then
    await expect(response).toHaveStatus(200);
    const tracking: PublicTrackingDto = await response.json();
    expect(tracking).toMatchObject({ currentStatus: 'DELIVERED', estimatedDelivery: shipment.deliveredAt });
    expect(scans(tracking)).toEqual(expectedRoute('DHL', parcel.trackingNumber));
  });

  test('returns not found for an unknown tracking number - 404', async ({ request }) => {
    // when
    const response = await new TrackingClient(request).publicTracking('0000000000');

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual({ message: 'Tracking number not found' });
  });
});
