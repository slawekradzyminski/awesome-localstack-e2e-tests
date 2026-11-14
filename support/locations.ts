import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { APP_BASE_URL } from '@config';
import type { ProductDto } from '@models/product';
import type { ShipmentDto, WarehouseLocationCode, WarehouseLocationDto } from '@models/shipment';
import { expect } from './expect';
import { step } from './step';
import type { Shopper } from './shopper';
import type { Warehouse } from './staff';

// White-box knowledge of warehouse-service 1.5.0 (DemoDataSeeder, V6 migration): Krakow (priority 1) ships
// every category, Gdansk (priority 2) is PRIMARY for these categories and backs up the rest.
export const GDANSK_CATEGORY = 'Books';
export const KRAKOW_CATEGORY = 'Electronics';
export const LOCATIONS: Record<WarehouseLocationCode, { name: string; city: string; priority: number }> = {
  KRK: { name: 'Krakow Central', city: 'Krakow', priority: 1 },
  GDN: { name: 'Gdansk North', city: 'Gdansk', priority: 2 },
};

const LOCK_DIR = join(tmpdir(), `e2e-warehouse-locations-${createHash('sha1').update(APP_BASE_URL).digest('hex').slice(0, 12)}`);
const LOCK_TIMEOUT_MS = 180_000;

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function acquire(): Promise<void> {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  for (;;) {
    try {
      await mkdir(LOCK_DIR);
      await writeFile(join(LOCK_DIR, 'pid'), String(process.pid));
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    const owner = Number(await readFile(join(LOCK_DIR, 'pid'), 'utf8').catch(() => 'NaN'));
    if (Number.isInteger(owner) && !processAlive(owner)) {
      await rm(LOCK_DIR, { recursive: true, force: true });
      continue;
    }
    if (Date.now() > deadline) throw new Error(`Warehouse locations lock ${LOCK_DIR} not released within ${LOCK_TIMEOUT_MS} ms`);
    await delay(250);
  }
}

/**
 * Warehouse locations are stack-wide state: switching one off changes where every other order is
 * allocated. A test that asserts an allocation or switches a location holds this lock (one test per
 * stack at a time, across workers), and every location is switched on again afterwards.
 * Other tests are unaffected: with any one location off, every category still has an active location.
 */
export class Locations {
  private constructor(private readonly warehouse: Warehouse) {}

  static async lock(warehouse: Warehouse): Promise<Locations> {
    await acquire();
    const locations = new Locations(warehouse);
    try {
      await locations.switchAllOn();
    } catch (error) {
      await rm(LOCK_DIR, { recursive: true, force: true });
      throw error;
    }
    return locations;
  }

  async list(): Promise<WarehouseLocationDto[]> {
    const response = await this.warehouse.client.locations();
    await expect(response, 'List warehouse locations').toHaveStatus(200);
    return response.json();
  }

  @step('switch warehouse location {0} off')
  async switchOff(code: WarehouseLocationCode): Promise<WarehouseLocationDto> {
    const response = await this.warehouse.client.setLocationActive(code, false);
    await expect(response, `Switch ${code} off`).toHaveStatus(200);
    return response.json();
  }

  @step('switch warehouse location {0} on')
  async switchOn(code: WarehouseLocationCode): Promise<WarehouseLocationDto> {
    const response = await this.warehouse.client.setLocationActive(code, true);
    await expect(response, `Switch ${code} on`).toHaveStatus(200);
    return response.json();
  }

  // Every location on: before a test (a crashed run may have left one off) and after it (also after a UI toggle).
  private async switchAllOn(): Promise<void> {
    const inactive = (await this.list()).filter(location => !location.active).map(location => location.code);
    for (const code of inactive) await this.switchOn(code);
  }

  /**
   * A paid order of one new product per category (in that order), released to the warehouse, which
   * allocates its lines to locations. Returns the first parcel (the response of the release).
   */
  @step('release a paid order to the warehouse')
  async releasedOrder(shopper: Shopper, lines: { category: string; quantity?: number }[]): Promise<ReleasedOrder> {
    const products: ProductDto[] = [];
    for (const line of lines) {
      products.push((await shopper.fillCart({ category: line.category, price: 10 }, line.quantity ?? 1)).product);
    }
    const order = await shopper.checkout();
    await shopper.payAndWaitForPaid(order.id);
    return { orderId: order.id, products, first: await this.warehouse.createShipment(order.id) };
  }

  async unlock(): Promise<void> {
    try {
      await this.switchAllOn();
    } finally {
      await rm(LOCK_DIR, { recursive: true, force: true });
    }
  }
}

export interface ReleasedOrder {
  orderId: number;
  products: ProductDto[];
  // The response of POST /api/v1/warehouse/shipments: the first parcel.
  first: ShipmentDto;
}

// GET /api/v1/orders/{id}/shipments as the owner.
export async function parcelsOf(shopper: Shopper, orderId: number): Promise<ShipmentDto[]> {
  const response = await shopper.tracking.orderShipments(orderId);
  await expect(response, `Parcels of order ${orderId}`).toHaveStatus(200);
  return response.json();
}

// The single-state view the backend keeps of the order (warehouse mirror, forward-only).
export async function fulfilmentState(shopper: Shopper, orderId: number): Promise<string | null | undefined> {
  return (await shopper.getOrder(orderId)).fulfilmentState;
}
