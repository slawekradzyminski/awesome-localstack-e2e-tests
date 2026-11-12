import { expect } from './expect';
import { step } from './step';
import { GiftCardsClient } from '@api/tenders.client';
import { TaxClient } from '@api/tax.client';
import { TrackingClient, WarehouseClient } from '@api/warehouse.client';
import { PaymentsClient } from '@api/payments.client';
import { WebhooksClient } from '@api/webhooks.client';
import { OrdersClient } from '@api/orders.client';
import type { ShipmentDto, TrackingDto, TrackingStatus } from '@models/shipment';
import type { GiftCardCreateDto, GiftCardDto } from '@models/tenders';
import type { ApiTestContext } from './api-test-context';

// Demo admin account of the local stack. Mutations here are test-owned data only (new gift cards, own orders).
export class Admin {
  private constructor(
    readonly giftCards: GiftCardsClient,
    readonly tax: TaxClient,
    readonly payments: PaymentsClient,
    readonly webhooks: WebhooksClient,
    readonly orders: OrdersClient,
    readonly warehouse: WarehouseClient,
  ) {}

  static async create(api: ApiTestContext): Promise<Admin> {
    const token = await api.getAdminToken();
    const r = api.request;
    return new Admin(new GiftCardsClient(r, token), new TaxClient(r, token), new PaymentsClient(r, token),
      new WebhooksClient(r, token), new OrdersClient(r, token), new WarehouseClient(r, token));
  }

  @step('issue a gift card')
  async issueGiftCard(giftCard: Partial<GiftCardCreateDto> = {}): Promise<GiftCardDto> {
    const response = await this.giftCards.issue({ amount: 20, note: 'Playwright test', ...giftCard });
    await expect(response, 'Issue a gift card').toHaveStatus(201);
    return response.json();
  }
}

// Demo warehouse account: fulfils paid orders.
export class Warehouse {
  private constructor(readonly client: WarehouseClient, private readonly publicTracking: TrackingClient) {}

  static async create(api: ApiTestContext): Promise<Warehouse> {
    return new Warehouse(new WarehouseClient(api.request, await api.getWarehouseToken()), new TrackingClient(api.request));
  }

  @step('create a shipment for order {0}')
  async createShipment(orderId: number): Promise<ShipmentDto> {
    const response = await this.client.createShipment(orderId);
    await expect(response, `Create shipment for order ${orderId}`).toHaveStatus(201);
    return response.json();
  }

  // Pick, pack and hand to the simulated carrier (no tracking number given).
  @step('pick, pack and ship order {0} with the simulated carrier')
  async shipSimulated(orderId: number, carrier = 'DHL'): Promise<ShipmentDto> {
    const shipment = await this.createShipment(orderId);
    await expect(await this.client.pick(shipment.id), 'Pick').toHaveStatus(200);
    await expect(await this.client.pack(shipment.id), 'Pack').toHaveStatus(200);
    const response = await this.client.ship(shipment.id, carrier);
    await expect(response, 'Ship with the simulated carrier').toHaveStatus(200);
    return response.json();
  }

  @step('advance the carrier of shipment {0}')
  async advanceCarrier(shipmentId: number): Promise<void> {
    const response = await this.client.advanceCarrier(shipmentId);
    await expect(response, `Advance carrier of shipment ${shipmentId}`).toHaveStatus(200);
  }

  // Fast-forwards the carrier until the public tracking page shows the status (bounded, never loops forever).
  @step('advance shipment {0} until {1}')
  async advanceUntil(shipment: ShipmentDto, status: TrackingStatus, maxSteps = 8): Promise<TrackingDto> {
    for (let step = 0; step <= maxSteps; step++) {
      const tracking = await this.tracking(shipment.trackingNumber!);
      if (tracking.currentStatus === status) return tracking;
      if (tracking.currentStatus === 'DELIVERED') break;
      await this.advanceCarrier(shipment.id);
    }
    throw new Error(`Shipment ${shipment.id} did not reach ${status} within ${maxSteps} carrier steps`);
  }

  async tracking(trackingNumber: string): Promise<TrackingDto> {
    const response = await this.publicTracking.publicTracking(trackingNumber);
    await expect(response, `Public tracking of ${trackingNumber}`).toHaveStatus(200);
    return response.json();
  }
}
