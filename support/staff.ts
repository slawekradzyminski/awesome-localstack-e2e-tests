import { randomUUID } from 'node:crypto';
import { expect } from './expect';
import { step } from './step';
import { ASYNC_TIMEOUT, POLL_INTERVALS } from '@config';
import { InventoryClient, PurchasingClient } from '@api/inventory.client';
import { ProductsClient } from '@api/products.client';
import { GiftCardsClient } from '@api/tenders.client';
import { TaxClient } from '@api/tax.client';
import { TrackingClient, WarehouseClient } from '@api/warehouse.client';
import { PaymentsClient } from '@api/payments.client';
import { WebhooksClient } from '@api/webhooks.client';
import { OrdersClient } from '@api/orders.client';
import type { ShipmentDto, TrackingDto, TrackingStatus } from '@models/shipment';
import type { GiftCardCreateDto, GiftCardDto } from '@models/tenders';
import type { InventoryMovementDto, PurchaseOrderDto, SupplierDto } from '@models/inventory';
import type { PageDto } from '@models/page';
import type { ProductDto } from '@models/product';
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
    readonly products: ProductsClient,
    readonly inventory: InventoryClient,
    readonly purchasing: PurchasingClient,
  ) {}

  static async create(api: ApiTestContext): Promise<Admin> {
    const token = await api.getAdminToken();
    const r = api.request;
    return new Admin(new GiftCardsClient(r, token), new TaxClient(r, token), new PaymentsClient(r, token),
      new WebhooksClient(r, token), new OrdersClient(r, token), new WarehouseClient(r, token),
      new ProductsClient(r, token), new InventoryClient(r, token), new PurchasingClient(r, token));
  }

  // The backend's stock copy. warehouse-service owns the ledger (1.6.0+) and pushes every level to this
  // projection asynchronously: after a cancel, an expiry, a receipt or a restock, use waitForStock.
  async stockOf(productId: number): Promise<number> {
    const response = await this.products.getById(productId);
    await expect(response, `Read product ${productId}`).toHaveStatus(200);
    return ((await response.json()) as ProductDto).stockQuantity;
  }

  // The product's ledger, newest first (one page of 100 is enough for a test-owned product).
  async movementsOf(productId: number): Promise<InventoryMovementDto[]> {
    const response = await this.inventory.movements(productId, { size: 100 });
    await expect(response, `Movements of product ${productId}`).toHaveStatus(200);
    return ((await response.json()) as PageDto<InventoryMovementDto>).content;
  }

  // Stock comes back through the event feed (cancel -> warehouse ledger -> level push), typically in 5-15 s.
  @step('wait until product {0} has {1} in stock')
  async waitForStock(productId: number, quantity: number): Promise<void> {
    await expect.poll(async () => this.stockOf(productId),
      { message: `product ${productId} has ${quantity} in stock`, timeout: ASYNC_TIMEOUT, intervals: POLL_INTERVALS })
      .toBe(quantity);
  }

  // Waits for the warehouse ledger to record that order's stock coming back, and returns that product's
  // ORDER_RESTORED movements of the order.
  @step('wait until product {0} has an ORDER_RESTORED movement of order {1}')
  async waitForRestoredMovements(productId: number, orderId: number): Promise<InventoryMovementDto[]> {
    const restoredOf = async () => (await this.movementsOf(productId))
      .filter(movement => movement.type === 'ORDER_RESTORED' && movement.orderId === orderId);
    await expect.poll(async () => (await restoredOf()).length,
      { message: `ORDER_RESTORED movement of order ${orderId} on product ${productId}`, timeout: ASYNC_TIMEOUT, intervals: POLL_INTERVALS })
      .toBeGreaterThan(0);
    return restoredOf();
  }

  @step('create a supplier')
  async createSupplier(): Promise<SupplierDto> {
    const name = `Playwright supplier ${randomUUID()}`;
    const response = await this.purchasing.createSupplier({ name, email: 'purchasing@supplier.example', leadTimeDays: 3 });
    await expect(response, 'Create a supplier').toHaveStatus(201);
    return response.json();
  }

  // A submitted purchase order of one line from a new supplier, ready for goods receipts.
  @step('order {1} units of product {0} from a supplier')
  async submittedPurchaseOrder(productId: number, quantity: number): Promise<PurchaseOrderDto> {
    const supplier = await this.createSupplier();
    const created = await this.purchasing.createPurchaseOrder({
      supplierId: supplier.id,
      note: 'Playwright receipt',
      lines: [{ productId, quantity, unitCost: 4.5 }],
    });
    await expect(created, 'Create a purchase order').toHaveStatus(201);
    const order: PurchaseOrderDto = await created.json();
    const submitted = await this.purchasing.submit(order.id);
    await expect(submitted, `Submit purchase order ${order.id}`).toHaveStatus(200);
    return submitted.json();
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
