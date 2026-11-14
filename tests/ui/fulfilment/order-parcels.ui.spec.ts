import { test, expect } from '@fixtures';
import { GDANSK_CATEGORY, KRAKOW_CATEGORY, parcelsOf } from '@support/locations';

test.describe('order details - parcels', { tag: ['@fulfilment', '@tracking'] }, () => {
  test('a split order shows one parcel per warehouse location with its lines', async ({ shopper, locations, orderDetailsPage }) => {
    // given
    const { orderId, products: [electronics, books] } = await locations.releasedOrder(shopper, [
      { category: KRAKOW_CATEGORY }, { category: GDANSK_CATEGORY, quantity: 2 },
    ]);

    // when
    await orderDetailsPage.goto(orderId);

    // then
    const { shipment } = orderDetailsPage;
    await expect(shipment.parcels).toHaveCount(2);
    await expect(shipment.parcelCount).toHaveText('This order ships in 2 parcels from different warehouses.');
    await expect(shipment.parcel(1).title).toHaveText('Parcel 1 of 2');
    await expect(shipment.parcel(1).location).toHaveText('Ships from Krakow Central (KRK)');
    await expect(shipment.parcel(1).lines).toHaveCount(1);
    await expect(shipment.parcel(1).line(electronics.id)).toContainText(electronics.name);
    await expect(shipment.parcel(2).title).toHaveText('Parcel 2 of 2');
    await expect(shipment.parcel(2).location).toHaveText('Ships from Gdansk North (GDN)');
    await expect(shipment.parcel(2).line(books.id)).toContainText('× 2');
    await expect(shipment.parcel(1).status).toHaveText('AWAITING PICK');
  });

  test('each shipped parcel has its own tracking', async ({ shopper, warehouse, parcels, locations, orderDetailsPage }) => {
    // given
    const { orderId } = await locations.releasedOrder(shopper, [{ category: KRAKOW_CATEGORY }, { category: GDANSK_CATEGORY }]);
    const [, gdansk] = await parcelsOf(shopper, orderId);
    await expect(await warehouse.client.pick(gdansk.id), 'Pick').toHaveStatus(200);
    await expect(await warehouse.client.pack(gdansk.id), 'Pack').toHaveStatus(200);
    const response = await warehouse.client.ship(gdansk.id, 'DPD');
    await expect(response, 'Ship the Gdansk parcel').toHaveStatus(200);
    const shipped = parcels.register(await response.json());

    // when
    await orderDetailsPage.goto(orderId);

    // then
    const { shipment } = orderDetailsPage;
    await expect(shipment.parcel(2).status).toHaveText('SHIPPED');
    await expect(shipment.parcel(2).carrierAndNumber).toHaveText(`DPD · ${shipped.trackingNumber}`);
    await expect(shipment.parcel(2).timeline.trackingNumber).toHaveText(shipped.trackingNumber!);
    await expect(shipment.parcel(1).status).toHaveText('AWAITING PICK');
    await expect(shipment.parcel(1).tracking).toBeHidden();
  });
});
