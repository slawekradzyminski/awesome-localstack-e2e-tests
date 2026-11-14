import { test, expect } from '@fixtures';
import { TrackingClient } from '@api/warehouse.client';
import { ASYNC_TIMEOUT, POLL_INTERVALS } from '@config';
import { GDANSK_CATEGORY, KRAKOW_CATEGORY, fulfilmentState, parcelsOf } from '@support/locations';
import type { ShipmentDto } from '@models/shipment';

const parcel = (overrides: { [K in keyof ShipmentDto]?: unknown }) => expect.objectContaining(overrides);
const line = (productId: number, category: string, quantity = 1) => expect.objectContaining({ productId, category, quantity });

test.describe('Split shipments: one parcel per warehouse location', { tag: ['@fulfilment', '@tracking'] }, () => {
  test('splits a mixed cart into a Krakow and a Gdansk parcel - 201', async ({ shopper, locations }) => {
    // when
    const { orderId, products: [electronics, books], first } = await locations.releasedOrder(shopper, [
      { category: KRAKOW_CATEGORY }, { category: GDANSK_CATEGORY },
    ]);

    // then
    expect(first).toMatchObject({ orderId, status: 'AWAITING_PICK', locationCode: 'KRK', parcelIndex: 1, parcelCount: 2 });
    expect(await parcelsOf(shopper, orderId)).toEqual([
      parcel({ locationCode: 'KRK', locationName: 'Krakow Central', parcelIndex: 1, parcelCount: 2, totalUnits: 1,
        lines: [line(electronics.id, KRAKOW_CATEGORY)] }),
      parcel({ locationCode: 'GDN', locationName: 'Gdansk North', parcelIndex: 2, parcelCount: 2, totalUnits: 1,
        lines: [line(books.id, GDANSK_CATEGORY)] }),
    ]);
  });

  test('ships a cart that one location stocks as one parcel from there - 201', async ({ shopper, locations }) => {
    // when
    const { orderId, products: [first, second] } = await locations.releasedOrder(shopper, [
      { category: GDANSK_CATEGORY, quantity: 2 }, { category: GDANSK_CATEGORY },
    ]);

    // then
    expect(await parcelsOf(shopper, orderId)).toEqual([
      parcel({ locationCode: 'GDN', parcelIndex: 1, parcelCount: 1, totalUnits: 3,
        lines: expect.arrayContaining([line(first.id, GDANSK_CATEGORY, 2), line(second.id, GDANSK_CATEGORY)]) }),
    ]);
  });

  test('keeps the single-shipment view as the first parcel with the parcel count - 200', async ({ shopper, locations }) => {
    // given
    const { orderId, first } = await locations.releasedOrder(shopper, [{ category: KRAKOW_CATEGORY }, { category: GDANSK_CATEGORY }]);

    // when
    const response = await shopper.tracking.orderShipment(orderId);

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toMatchObject({ id: first.id, orderId, locationCode: 'KRK', parcelCount: 2 });
  });

  test('mirrors one forward-only aggregate fulfilment state to the backend', async ({ shopper, warehouse, parcels, locations }) => {
    // given
    const { orderId } = await locations.releasedOrder(shopper, [{ category: KRAKOW_CATEGORY }, { category: GDANSK_CATEGORY }]);
    const [krakow, gdansk] = await parcelsOf(shopper, orderId);
    const backendState = (state: string) => expect.poll(() => fulfilmentState(shopper, orderId), {
      message: `order ${orderId} fulfilment state becomes ${state}`, timeout: ASYNC_TIMEOUT, intervals: POLL_INTERVALS,
    }).toBe(state);
    await backendState('AWAITING_PICK');

    // when / then: the slower parcel holds the aggregate back, and it never moves backwards
    await expect(await warehouse.client.pick(krakow.id), 'Pick the Krakow parcel').toHaveStatus(200);
    await backendState('PICKED');
    await expect(await warehouse.client.pack(krakow.id), 'Pack the Krakow parcel').toHaveStatus(200);
    const shipped = await warehouse.client.ship(krakow.id);
    await expect(shipped, 'Ship the Krakow parcel').toHaveStatus(200);
    parcels.register(await shipped.json());
    await backendState('PICKED');
    expect((await shopper.getOrder(orderId)).status).toBe('PAID');
    await expect(await warehouse.client.pick(gdansk.id), 'Pick the Gdansk parcel').toHaveStatus(200);
    await expect(await warehouse.client.pack(gdansk.id), 'Pack the Gdansk parcel').toHaveStatus(200);
    await backendState('PACKED');
    const last = await warehouse.client.ship(gdansk.id);
    await expect(last, 'Ship the Gdansk parcel').toHaveStatus(200);
    parcels.register(await last.json());
    await backendState('SHIPPED');
    expect((await shopper.getOrder(orderId)).status).toBe('SHIPPED');
  });

  test('lists the parcels of an order to an administrator, and hides them from other customers - 200/404', async ({ shopper, otherShopper, api, request, locations }) => {
    // given
    const { orderId } = await locations.releasedOrder(shopper, [{ category: KRAKOW_CATEGORY }, { category: GDANSK_CATEGORY }]);

    // when
    const asAdmin = await new TrackingClient(request, await api.getAdminToken()).orderShipments(orderId);
    const asOther = await otherShopper.tracking.orderShipments(orderId);

    // then
    await expect(asAdmin).toHaveStatus(200);
    expect(await asAdmin.json()).toHaveLength(2);
    await expect(asOther).toHaveStatus(404);
  });

  test('lists no parcels of an order that was not released yet - 200', async ({ shopper }) => {
    // given
    const { order } = await shopper.placeOrder();

    // when
    const response = await shopper.tracking.orderShipments(order.id);

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toEqual([]);
  });
});
