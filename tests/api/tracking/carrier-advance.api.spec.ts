import { test, expect } from '@fixtures';
import { WarehouseClient } from '@api/warehouse.client';
import { NOT_ADVANCEABLE, deliveryCity, expectedRoute, failsFirstAttempt, javaHashCode, scans } from '@support/tracking';
import type { ShipmentDto, TrackingDto } from '@models/shipment';

// LocalDateTime strings carry microseconds; Date keeps milliseconds, so compare differences within 1 ms.
const millis = (localDateTime: string) => Date.parse(localDateTime);

test.describe('Java String.hashCode port used to predict the carrier route', { tag: ['@tracking'] }, () => {
  test('matches values computed by the JVM', () => {
    // values computed with jshell: "x".hashCode() and Math.floorMod("x".hashCode(), 6)
    expect(javaHashCode('')).toBe(0);
    expect(javaHashCode('1234567890')).toBe(-2054162789);
    expect(javaHashCode('1Z999AA10123456784')).toBe(-487036767);
    expect(javaHashCode('00000000000000000000000x')).toBe(-1605547960);
    expect(failsFirstAttempt('1234567890')).toBe(false);
    expect(failsFirstAttempt('00000000000000000000000x')).toBe(true);
    expect(deliveryCity('1234567890')).toBe('Krakow');
  });
});

test.describe('POST /api/v1/warehouse/shipments/{id}/carrier/advance', { tag: ['@tracking'] }, () => {
  test('walks a parcel through transit to delivery with ordered scans and a shrinking estimate - 200', async ({ shopper, parcels }) => {
    // given
    const parcel = await parcels.shipSimulated(shopper, 'DHL', 'direct');
    const route = expectedRoute('DHL', parcel.trackingNumber);
    expect(route.map(scan => scan.status)).toEqual(['LABEL_CREATED', 'IN_TRANSIT', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED']);
    const stepIntervals: number[] = [];

    for (let step = 1; step < route.length - 1; step++) {
      // when
      const tracking = await parcels.advance(parcel.shipment.id);

      // then
      expect(tracking).toMatchObject({
        shipmentId: parcel.shipment.id,
        orderId: parcel.orderId,
        carrier: 'DHL',
        trackingNumber: parcel.trackingNumber,
        simulated: true,
        currentStatus: route[step].status,
      });
      expect(scans(tracking)).toEqual(route.slice(0, step + 1));
      const occurred = tracking.events.map(event => millis(event.occurredAt));
      expect(occurred).toEqual([...occurred].sort((a, b) => a - b));
      // Estimate = latest scan + one step interval per remaining scan.
      const remaining = route.length - 1 - step;
      const estimate = millis(tracking.estimatedDelivery!) - occurred.at(-1)!;
      expect(estimate).toBeGreaterThan(0);
      stepIntervals.push(estimate / remaining);
    }
    expect(Math.max(...stepIntervals) - Math.min(...stepIntervals)).toBeLessThanOrEqual(1);
  });

  test('delivers on the final scan and mirrors DELIVERED to the backend order - 200', async ({ shopper, warehouse, parcels }) => {
    // given
    const parcel = await parcels.shipSimulated(shopper, 'INPOST', 'direct');
    await parcels.advanceTo(parcel, 'OUT_FOR_DELIVERY');

    // when
    const response = await warehouse.client.advanceCarrier(parcel.shipment.id);

    // then
    await expect(response).toHaveStatus(200);
    const tracking: TrackingDto = await response.json();
    expect(tracking.currentStatus).toBe('DELIVERED');
    expect(scans(tracking)).toEqual(expectedRoute('INPOST', parcel.trackingNumber));
    expect(tracking.events.at(-1)!.description).toBe('Delivered to the parcel locker');

    const shipment: ShipmentDto = await (await warehouse.client.getShipment(parcel.shipment.id)).json();
    expect(shipment).toMatchObject({ status: 'DELIVERED', deliveredAt: expect.any(String) });
    expect(tracking.estimatedDelivery).toBe(shipment.deliveredAt);
    const order = await shopper.waitForOrderStatus(parcel.orderId, 'DELIVERED');
    expect(order.fulfilmentState).toBe('DELIVERED');
  });

  test('fails the first delivery attempt for a number whose hash is divisible by 5, then re-attempts - 200', async ({ shopper, parcels }) => {
    // given
    const parcel = await parcels.shipSimulated(shopper, 'DPD', 'failsFirstAttempt');
    expect(Math.abs(javaHashCode(parcel.trackingNumber)) % 5).toBe(0);
    await parcels.advanceTo(parcel, 'OUT_FOR_DELIVERY');

    // when
    const failed = await parcels.advance(parcel.shipment.id);

    // then
    expect(failed.currentStatus).toBe('DELIVERY_FAILED');
    expect(failed.events.at(-1)).toMatchObject({
      status: 'DELIVERY_FAILED',
      description: 'Delivery attempt failed: the recipient was not available. The courier will try again',
    });

    // when
    const retried = await parcels.advance(parcel.shipment.id);
    const delivered = await parcels.advance(parcel.shipment.id);

    // then
    expect(retried.currentStatus).toBe('OUT_FOR_DELIVERY');
    expect(retried.events.at(-1)!.description).toBe('Out for delivery again (second attempt)');
    expect(delivered.currentStatus).toBe('DELIVERED');
    expect(scans(delivered).map(scan => scan.status)).toEqual([
      'LABEL_CREATED', 'IN_TRANSIT', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERY_FAILED', 'OUT_FOR_DELIVERY', 'DELIVERED',
    ]);
    expect(scans(delivered)).toEqual(expectedRoute('DPD', parcel.trackingNumber));
    await shopper.waitForOrderStatus(parcel.orderId, 'DELIVERED');
  });

  test('rejects advancing a delivered parcel - 409', async ({ shopper, warehouse, parcels }) => {
    // given
    const parcel = await parcels.shipSimulated(shopper);
    const delivered = await parcels.advanceTo(parcel, 'DELIVERED');

    // when
    const response = await warehouse.client.advanceCarrier(parcel.shipment.id);

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual(NOT_ADVANCEABLE);
    expect((await warehouse.tracking(parcel.trackingNumber)).events).toHaveLength(delivered.events.length);
  });

  test('rejects advancing a shipment that is not handed to the carrier yet - 409', async ({ shopper, warehouse, parcels }) => {
    // given
    const { orderId, shipment } = await parcels.packed(shopper);

    // when
    const response = await warehouse.client.advanceCarrier(shipment.id);

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual(NOT_ADVANCEABLE);
    const tracking: TrackingDto = await (await shopper.tracking.orderTracking(orderId)).json();
    expect(tracking).toMatchObject({ currentStatus: null, events: [] });
  });

  test('returns not found for an unknown shipment - 404', async ({ warehouse }) => {
    // when
    const response = await warehouse.client.advanceCarrier(2_147_483_647);

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual({ message: 'Shipment not found' });
  });

  test('lets an administrator advance the carrier - 200', async ({ shopper, admin, parcels }) => {
    // given
    const parcel = await parcels.shipSimulated(shopper);

    // when
    const response = await admin.warehouse.advanceCarrier(parcel.shipment.id);

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toMatchObject({ shipmentId: parcel.shipment.id, currentStatus: 'IN_TRANSIT' });
  });

  test('forbids a customer, even for their own parcel - 403', async ({ shopper, parcels, request, warehouse }) => {
    // given
    const parcel = await parcels.shipSimulated(shopper);

    // when
    const response = await new WarehouseClient(request, shopper.token).advanceCarrier(parcel.shipment.id);

    // then
    await expect(response).toHaveStatus(403);
    expect(await response.json()).toEqual({ message: 'Access denied' });
    expect((await warehouse.tracking(parcel.trackingNumber)).currentStatus).toBe('LABEL_CREATED');
  });

  test('requires authentication - 401', async ({ request }) => {
    // when
    const response = await new WarehouseClient(request).advanceCarrier(1);

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});
