import { test, expect } from '@fixtures';
import { WarehouseClient } from '@api/warehouse.client';
import { ASYNC_TIMEOUT, POLL_INTERVALS } from '@config';
import { GDANSK_CATEGORY, KRAKOW_CATEGORY, LOCATIONS, parcelsOf } from '@support/locations';
import type { ReconciliationDto, ShipmentDto } from '@models/shipment';

const parcel = (overrides: { [K in keyof ShipmentDto]?: unknown }) => expect.objectContaining(overrides);
const line = (productId: number, quantity = 1) => expect.objectContaining({ productId, quantity });

test.describe('POST /api/v1/warehouse/shipments/{id}/reallocate', { tag: ['@fulfilment'] }, () => {
  test('moves a Gdansk parcel into the order\'s Krakow parcel - 200', async ({ shopper, warehouse, locations }) => {
    // given
    const { orderId, products: [electronics, books] } = await locations.releasedOrder(shopper, [
      { category: KRAKOW_CATEGORY }, { category: GDANSK_CATEGORY },
    ]);
    const [krakow, gdansk] = await parcelsOf(shopper, orderId);

    // when
    const response = await warehouse.client.reallocate(gdansk.id, {});

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toMatchObject({ id: krakow.id, locationCode: 'KRK', parcelCount: 1, totalUnits: 2 });
    expect(await parcelsOf(shopper, orderId)).toEqual([
      parcel({ id: krakow.id, locationCode: 'KRK', parcelIndex: 1, parcelCount: 1,
        lines: expect.arrayContaining([line(electronics.id), line(books.id)]) }),
    ]);
  });

  test('moves a single parcel to a named location - 200', async ({ shopper, warehouse, locations }) => {
    // given
    const { orderId, first, products: [electronics] } = await locations.releasedOrder(shopper, [{ category: KRAKOW_CATEGORY }]);

    // when
    const response = await warehouse.client.reallocate(first.id, { targetLocation: 'GDN' });

    // then
    await expect(response).toHaveStatus(200);
    expect(await parcelsOf(shopper, orderId)).toEqual([
      parcel({ locationCode: 'GDN', locationName: LOCATIONS.GDN.name, parcelCount: 1, lines: [line(electronics.id)] }),
    ]);
  });

  test('rejects the location the parcel is already at - 409', async ({ shopper, warehouse, locations }) => {
    // given
    const { first } = await locations.releasedOrder(shopper, [{ category: KRAKOW_CATEGORY }]);

    // when
    const response = await warehouse.client.reallocate(first.id, { targetLocation: 'KRK' });

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual({ message: 'Shipment is already at KRK' });
  });

  test('rejects a parcel that is already picked - 409', async ({ shopper, warehouse, locations }) => {
    // given
    const { first } = await locations.releasedOrder(shopper, [{ category: KRAKOW_CATEGORY }]);
    await expect(await warehouse.client.pick(first.id), 'Pick').toHaveStatus(200);

    // when
    const response = await warehouse.client.reallocate(first.id, { targetLocation: 'GDN' });

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual({ message: 'Cannot reallocate a shipment in status PICKED' });
  });

  test('rejects an unknown target location - 404', async ({ shopper, warehouse, locations }) => {
    // given
    const { first } = await locations.releasedOrder(shopper, [{ category: KRAKOW_CATEGORY }]);

    // when
    const response = await warehouse.client.reallocate(first.id, { targetLocation: 'WAW' });

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual({ message: 'Warehouse location not found' });
  });

  test('rejects a target that is not a location code - 400', async ({ warehouse }) => {
    // when
    const response = await warehouse.client.reallocate(1, { targetLocation: 'not a code!' });

    // then
    await expect(response).toHaveStatus(400);
  });

  test('is not available to customers - 403', async ({ shopper, request }) => {
    // when
    const response = await new WarehouseClient(request, shopper.token).reallocate(1, {});

    // then
    await expect(response).toHaveStatus(403);
  });
});

test.describe('POST /api/v1/warehouse/shipments/{id}/short-pick', { tag: ['@fulfilment'] }, () => {
  test('moves the missing units to a new parcel at another location - 200', async ({ shopper, warehouse, locations }) => {
    // given
    const { orderId, first, products: [electronics] } = await locations.releasedOrder(shopper, [{ category: KRAKOW_CATEGORY, quantity: 3 }]);

    // when
    const response = await warehouse.client.shortPick(first.id, { productId: electronics.id, missingQuantity: 1 });

    // then
    await expect(response).toHaveStatus(200);
    expect(await response.json()).toMatchObject({ locationCode: 'GDN', status: 'AWAITING_PICK', lines: [line(electronics.id, 1)] });
    expect(await parcelsOf(shopper, orderId)).toEqual([
      parcel({ id: first.id, locationCode: 'KRK', parcelIndex: 1, parcelCount: 2, totalUnits: 2, lines: [line(electronics.id, 2)] }),
      parcel({ locationCode: 'GDN', parcelIndex: 2, parcelCount: 2, totalUnits: 1, lines: [line(electronics.id, 1)] }),
    ]);
  });

  test('rejects more missing units than the line holds - 409', async ({ shopper, warehouse, locations }) => {
    // given
    const { first, products: [electronics] } = await locations.releasedOrder(shopper, [{ category: KRAKOW_CATEGORY, quantity: 2 }]);

    // when
    const response = await warehouse.client.shortPick(first.id, { productId: electronics.id, missingQuantity: 3 });

    // then
    await expect(response).toHaveStatus(409);
    expect((await response.json()).message).toContain('Missing quantity exceeds the 2');
  });

  test('rejects a product that is not in the parcel - 404', async ({ shopper, warehouse, locations }) => {
    // given
    const { first, products: [electronics] } = await locations.releasedOrder(shopper, [{ category: KRAKOW_CATEGORY }]);

    // when
    const response = await warehouse.client.shortPick(first.id, { productId: electronics.id + 1_000_000, missingQuantity: 1 });

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual({ message: 'Product is not in this shipment' });
  });

  test('rejects a missing quantity below one - 400', async ({ warehouse }) => {
    // when
    const response = await warehouse.client.shortPick(1, { productId: 1, missingQuantity: 0 });

    // then
    await expect(response).toHaveStatus(400);
  });
});

test.describe('Warehouse locations', { tag: ['@fulfilment'] }, () => {
  test('lists Krakow and Gdansk with the categories they stock - 200', async ({ locations }) => {
    // when
    const list = await locations.list();

    // then
    expect(list).toEqual([
      expect.objectContaining({ code: 'KRK', ...LOCATIONS.KRK, active: true, primaryCategories: expect.arrayContaining(['*']) }),
      expect.objectContaining({ code: 'GDN', ...LOCATIONS.GDN, active: true, primaryCategories: expect.arrayContaining([GDANSK_CATEGORY]),
        backupCategories: expect.arrayContaining(['*']) }),
    ]);
  });

  test('ships every line from Krakow while Gdansk is offline', async ({ shopper, locations }) => {
    // given
    await locations.switchOff('GDN');

    // when
    const { orderId, products: [electronics, books] } = await locations.releasedOrder(shopper, [
      { category: KRAKOW_CATEGORY }, { category: GDANSK_CATEGORY },
    ]);

    // then
    expect(await parcelsOf(shopper, orderId)).toEqual([
      parcel({ locationCode: 'KRK', parcelCount: 1, lines: expect.arrayContaining([line(electronics.id), line(books.id)]) }),
    ]);
  });

  test('refuses to reallocate to an offline location - 409', async ({ shopper, warehouse, locations }) => {
    // given
    const { first } = await locations.releasedOrder(shopper, [{ category: KRAKOW_CATEGORY }]);
    await locations.switchOff('GDN');

    // when
    const response = await warehouse.client.reallocate(first.id, { targetLocation: 'GDN' });

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual({ message: 'Warehouse location GDN is not active' });
  });

  test('refuses a short pick when no other location is active - 409', async ({ shopper, warehouse, locations }) => {
    // given
    const { first, products: [electronics] } = await locations.releasedOrder(shopper, [{ category: KRAKOW_CATEGORY, quantity: 2 }]);
    await locations.switchOff('GDN');

    // when
    const response = await warehouse.client.shortPick(first.id, { productId: electronics.id, missingQuantity: 1 });

    // then
    await expect(response).toHaveStatus(409);
    expect((await response.json()).message).toContain('No other active warehouse location stocks');
  });

  test('switches a location back on - 200', async ({ locations }) => {
    // given
    await locations.switchOff('GDN');

    // when
    const location = await locations.switchOn('GDN');

    // then
    expect(location).toMatchObject({ code: 'GDN', active: true });
  });

  test('rejects an unknown location - 404', async ({ warehouse }) => {
    // when
    const response = await warehouse.client.setLocationActive('WAW', false);

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual({ message: 'Warehouse location not found' });
  });

  test('is not available to customers - 403', async ({ shopper, request }) => {
    // when
    const responses = [await new WarehouseClient(request, shopper.token).locations(), await new WarehouseClient(request, shopper.token).setLocationActive('GDN', false)];

    // then
    await expect(responses[0]).toHaveStatus(403);
    await expect(responses[1]).toHaveStatus(403);
  });
});

test.describe('GET /api/v1/warehouse/reconciliation', { tag: ['@fulfilment'] }, () => {
  test('finds no disagreement for a split order that moved through every step - 200', async ({ shopper, warehouse, parcels, locations }) => {
    // given
    const { orderId } = await locations.releasedOrder(shopper, [{ category: KRAKOW_CATEGORY }, { category: GDANSK_CATEGORY }]);
    const [krakow, gdansk] = await parcelsOf(shopper, orderId);
    await expect(await warehouse.client.pick(krakow.id), 'Pick the Krakow parcel').toHaveStatus(200);
    await expect(await warehouse.client.pack(krakow.id), 'Pack the Krakow parcel').toHaveStatus(200);
    const shipped = await warehouse.client.ship(krakow.id);
    await expect(shipped, 'Ship the Krakow parcel').toHaveStatus(200);
    parcels.register(await shipped.json());
    await expect(await warehouse.client.pick(gdansk.id), 'Pick the Gdansk parcel').toHaveStatus(200);

    // when
    const entries = async () => {
      const response = await warehouse.client.reconciliation();
      await expect(response, 'Reconciliation').toHaveStatus(200);
      return ((await response.json()) as ReconciliationDto[]).filter(entry => entry.orderId === orderId);
    };

    // then
    await expect.poll(entries, { message: `order ${orderId} agrees with the backend`, timeout: ASYNC_TIMEOUT, intervals: POLL_INTERVALS })
      .toEqual([]);
  });

  test('is not available to customers - 403', async ({ shopper, request }) => {
    // when
    const response = await new WarehouseClient(request, shopper.token).reconciliation();

    // then
    await expect(response).toHaveStatus(403);
  });
});
