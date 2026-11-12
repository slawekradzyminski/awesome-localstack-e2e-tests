import { test, expect } from '@fixtures';
import { WarehouseClient } from '@api/warehouse.client';

type Call = (client: WarehouseClient, shipmentId: number) => ReturnType<WarehouseClient['getShipment']>;

// Every warehouse operation requires ROLE_WAREHOUSE or ROLE_ADMIN; a customer is refused before any state changes.
const operations: [string, Call][] = [
  ['GET /warehouse/shipments', client => client.listShipments()],
  ['GET /warehouse/shipments/{id}', (client, id) => client.getShipment(id)],
  ['POST /warehouse/shipments/{id}/pick', (client, id) => client.pick(id)],
  ['POST /warehouse/shipments/{id}/pack', (client, id) => client.pack(id)],
  ['POST /warehouse/shipments/{id}/ship', (client, id) => client.ship(id, 'DHL')],
  ['POST /warehouse/shipments/{id}/deliver', (client, id) => client.deliver(id)],
  ['POST /warehouse/shipments/{id}/carrier/advance', (client, id) => client.advanceCarrier(id)],
];

test.describe('warehouse endpoints - role check', { tag: ['@tracking'] }, () => {
  for (const [name, call] of operations) {
    test(`${name} forbids a customer - 403`, async ({ shopper, warehouse, parcels, request }) => {
      // given
      const { shipment } = await parcels.packed(shopper);

      // when
      const response = await call(new WarehouseClient(request, shopper.token), shipment.id);

      // then
      await expect(response).toHaveStatus(403);
      expect(await response.json()).toEqual({ message: 'Access denied' });
      expect(await (await warehouse.client.getShipment(shipment.id)).json()).toMatchObject({ status: 'PACKED', trackingNumber: null });
    });
  }

  test('POST /warehouse/shipments forbids a customer from releasing their own paid order - 403', async ({ shopper, request }) => {
    // given
    const { order } = await shopper.placeOrder();
    await shopper.payAndWaitForPaid(order.id);

    // when
    const response = await new WarehouseClient(request, shopper.token).createShipment(order.id);

    // then
    await expect(response).toHaveStatus(403);
    expect(await response.json()).toEqual({ message: 'Access denied' });
    await expect(await shopper.tracking.orderTracking(order.id)).toHaveStatus(404);
  });
});
