import { test, expect } from '@fixtures';
import { CARRIER_FORMATS, CARRIERS, NOT_ADVANCEABLE, WAREHOUSE_LOCATION, manualTrackingNumber } from '@support/tracking';
import type { ShipmentDto, TrackingDto } from '@models/shipment';

const NOMINAL_TRANSIT_DAYS = { INPOST: 1, DPD: 2, DHL: 2, UPS: 3 } as const;

test.describe('POST /api/v1/warehouse/shipments/{id}/ship - simulated carrier', { tag: ['@tracking'] }, () => {
  for (const carrier of CARRIERS) {
    test(`ships without a tracking number to the simulated ${carrier} carrier with a generated number - 200`, async ({ shopper, warehouse, parcels }) => {
      // given
      const { orderId, shipment } = await parcels.packed(shopper);

      // when
      const response = await warehouse.client.ship(shipment.id, carrier);

      // then
      await expect(response).toHaveStatus(200);
      const shipped: ShipmentDto = await response.json();
      expect(shipped).toMatchObject({ id: shipment.id, orderId, status: 'SHIPPED', carrier, lastActor: 'warehouse' });
      expect(shipped.trackingNumber).toMatch(CARRIER_FORMATS[carrier]);
      parcels.register(shipped);

      const tracking: TrackingDto = await (await shopper.tracking.orderTracking(orderId)).json();
      expect(tracking).toMatchObject({
        shipmentId: shipment.id,
        orderId,
        carrier,
        trackingNumber: shipped.trackingNumber,
        simulated: true,
        currentStatus: 'LABEL_CREATED',
        estimatedDelivery: expect.any(String),
      });
      expect(tracking.events).toEqual([{
        status: 'LABEL_CREATED',
        location: WAREHOUSE_LOCATION,
        description: expect.stringMatching(/^Shipping label created; the parcel is waiting for \w+ pickup$/),
        occurredAt: expect.any(String),
      }]);
    });
  }
});

test.describe('POST /api/v1/warehouse/shipments/{id}/ship - manual tracking number', { tag: ['@tracking'] }, () => {
  test('keeps a supplied tracking number and does not simulate the carrier - 200', async ({ shopper, warehouse, parcels }) => {
    // given
    const { orderId, shipment } = await parcels.packed(shopper);
    const trackingNumber = manualTrackingNumber('DPD');

    // when
    const response = await warehouse.client.ship(shipment.id, 'DPD', trackingNumber);

    // then
    await expect(response).toHaveStatus(200);
    const shipped: ShipmentDto = await response.json();
    expect(shipped).toMatchObject({ status: 'SHIPPED', carrier: 'DPD', trackingNumber });

    const tracking: TrackingDto = await (await shopper.tracking.orderTracking(orderId)).json();
    expect(tracking).toMatchObject({ orderId, carrier: 'DPD', trackingNumber, simulated: false, currentStatus: 'LABEL_CREATED' });
    expect(tracking.events.map(event => event.status)).toEqual(['LABEL_CREATED']);
    // A manually tracked parcel is estimated from the hand-over plus the carrier's nominal transit days.
    const days = (Date.parse(tracking.estimatedDelivery!) - Date.parse(shipped.shippedAt!)) / 86_400_000;
    expect(days).toBeCloseTo(NOMINAL_TRANSIT_DAYS.DPD, 3);
  });

  test('a manually tracked parcel cannot be advanced by the carrier simulator - 409', async ({ shopper, warehouse, parcels }) => {
    // given
    const { orderId, shipment } = await parcels.packed(shopper);
    await expect(await warehouse.client.ship(shipment.id, 'DHL', manualTrackingNumber('DHL'))).toHaveStatus(200);

    // when
    const response = await warehouse.client.advanceCarrier(shipment.id);

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual(NOT_ADVANCEABLE);
    const tracking: TrackingDto = await (await shopper.tracking.orderTracking(orderId)).json();
    expect(tracking.events.map(event => event.status)).toEqual(['LABEL_CREATED']);
  });

  test('confirming delivery by hand records a DELIVERED scan and delivers the order - 200', async ({ shopper, warehouse, parcels }) => {
    // given
    const { orderId, shipment } = await parcels.packed(shopper);
    await expect(await warehouse.client.ship(shipment.id, 'UPS', manualTrackingNumber('UPS'))).toHaveStatus(200);

    // when
    const response = await warehouse.client.deliver(shipment.id);

    // then
    await expect(response).toHaveStatus(200);
    const delivered: ShipmentDto = await response.json();
    expect(delivered).toMatchObject({ status: 'DELIVERED', deliveredAt: expect.any(String) });
    const tracking: TrackingDto = await (await shopper.tracking.orderTracking(orderId)).json();
    expect(tracking).toMatchObject({ simulated: false, currentStatus: 'DELIVERED', estimatedDelivery: delivered.deliveredAt });
    expect(tracking.events.map(({ status, description }) => ({ status, description }))).toEqual([
      { status: 'LABEL_CREATED', description: 'Shipping label created; the parcel is waiting for UPS pickup' },
      { status: 'DELIVERED', description: 'Delivery confirmed by the warehouse' },
    ]);
    await shopper.waitForOrderStatus(orderId, 'DELIVERED');
  });
});
