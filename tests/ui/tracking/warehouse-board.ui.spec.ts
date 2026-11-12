import { test, expect } from '@fixtures';
import { manualTrackingNumber } from '@support/tracking';

test.describe('warehouse board - simulated carrier', { tag: ['@tracking'] }, () => {
  test('advances a simulated parcel by one scan from the selected shipment', async ({ shopper, parcels, warehouse, warehouseBoardPage }) => {
    // given
    const parcel = await parcels.shipSimulated(shopper);
    await warehouseBoardPage.goto();
    await warehouseBoardPage.select(parcel.shipment.id);
    await expect(warehouseBoardPage.selectedTracking).toHaveText(`DHL · ${parcel.trackingNumber}`);
    await expect(warehouseBoardPage.carrierStatus(parcel.shipment.id)).toHaveText('Simulated carrier · Label created');

    // when
    await warehouseBoardPage.advanceCarrier(parcel.shipment.id);

    // then
    await expect(warehouseBoardPage.notice).toHaveText(`Shipment #${parcel.shipment.id} carrier status: In transit`);
    await expect(warehouseBoardPage.carrierStatus(parcel.shipment.id)).toHaveText('Simulated carrier · In transit');
    expect((await warehouse.tracking(parcel.trackingNumber)).currentStatus).toBe('IN_TRANSIT');
  });

  test('offers no carrier controls for a manually tracked parcel', async ({ shopper, parcels, warehouse, warehouseBoardPage }) => {
    // given
    const { shipment } = await parcels.packed(shopper);
    const trackingNumber = manualTrackingNumber('DHL');
    await expect(await warehouse.client.ship(shipment.id, 'DHL', trackingNumber)).toHaveStatus(200);
    await warehouseBoardPage.goto();

    // when
    await warehouseBoardPage.select(shipment.id);

    // then
    await expect(warehouseBoardPage.selectedTracking).toHaveText(`DHL · ${trackingNumber}`);
    await expect(warehouseBoardPage.deliverButton(shipment.id)).toBeVisible();
    await expect(warehouseBoardPage.advanceButton(shipment.id)).toBeHidden();
  });
});
