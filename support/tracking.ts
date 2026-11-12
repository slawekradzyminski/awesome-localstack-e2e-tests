import { expect } from './expect';
import { step } from './step';
import type { Carrier, ShipmentDto, TrackingDto, TrackingStatus } from '@models/shipment';
import type { Shopper } from './shopper';
import type { Warehouse } from './staff';

// White-box knowledge of warehouse-service's simulated carrier (service/tracking/*.java, origin/master).

// Tracking number formats of entity/fulfilment/Carrier.java.
export const CARRIER_FORMATS: Record<Carrier, RegExp> = {
  INPOST: /^\d{24}$/,
  DPD: /^\d{14}$/,
  DHL: /^\d{10}$/,
  UPS: /^1Z[A-Z0-9]{16}$/,
};

export const CARRIERS = Object.keys(CARRIER_FORMATS) as Carrier[];

// Valid manual tracking numbers, one per carrier, made unique per call.
export function manualTrackingNumber(carrier: Carrier): string {
  const digits = (length: number) => Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
  return carrier === 'UPS' ? `1Z${digits(16)}` : digits({ INPOST: 24, DPD: 14, DHL: 10 }[carrier]);
}

const CARRIER_NAMES: Record<Carrier, string> = { INPOST: 'InPost', DPD: 'DPD', DHL: 'DHL', UPS: 'UPS' };
const CARRIER_HUBS: Record<Carrier, string> = {
  INPOST: 'InPost Sorting Centre, Pruszkow',
  DPD: 'DPD Hub, Strykow',
  DHL: 'DHL Hub, Leipzig',
  UPS: 'UPS Air Hub, Cologne',
};
const CITIES = ['Warsaw', 'Krakow', 'Gdansk', 'Wroclaw', 'Poznan', 'Lodz'];
export const WAREHOUSE_LOCATION = 'Awesome Testing Warehouse, Krakow';
export const NOT_ADVANCEABLE = { message: 'Only simulated SHIPPED shipments can be advanced' };

// java.lang.String#hashCode: s[0]*31^(n-1) + ... + s[n-1] in 32-bit two's complement arithmetic.
export function javaHashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(hash, 31) + value.charCodeAt(i)) | 0;
  }
  return hash;
}

// CarrierRoute.failsFirstAttempt: Math.abs(trackingNumber.hashCode()) % 5 == 0.
// Java's Math.abs(Integer.MIN_VALUE) stays negative; its remainder is -3 either way, never 0.
export function failsFirstAttempt(trackingNumber: string): boolean {
  const hash = javaHashCode(trackingNumber);
  const abs = hash === -2147483648 ? hash : Math.abs(hash);
  return abs % 5 === 0;
}

// CarrierNetwork.city: CITIES[Math.floorMod(hashCode, 6)].
export function deliveryCity(trackingNumber: string): string {
  const mod = javaHashCode(trackingNumber) % CITIES.length;
  return CITIES[(mod + CITIES.length) % CITIES.length];
}

export interface ExpectedScan {
  status: TrackingStatus;
  location: string;
  description: string;
}

// The complete scan history CarrierRoute + CarrierNetwork produce for a simulated parcel, oldest first.
export function expectedRoute(carrier: Carrier, trackingNumber: string): ExpectedScan[] {
  const city = deliveryCity(trackingNumber);
  const depot = `${CARRIER_NAMES[carrier]} depot, ${city}`;
  const route: ExpectedScan[] = [
    { status: 'LABEL_CREATED', location: WAREHOUSE_LOCATION, description: `Shipping label created; the parcel is waiting for ${CARRIER_NAMES[carrier]} pickup` },
    { status: 'IN_TRANSIT', location: CARRIER_HUBS[carrier], description: 'Collected from the sender and sorted at the hub' },
    { status: 'IN_TRANSIT', location: depot, description: 'Arrived at the delivery depot' },
    { status: 'OUT_FOR_DELIVERY', location: depot, description: 'Out for delivery with the courier' },
  ];
  if (failsFirstAttempt(trackingNumber)) {
    route.push(
      { status: 'DELIVERY_FAILED', location: city, description: 'Delivery attempt failed: the recipient was not available. The courier will try again' },
      { status: 'OUT_FOR_DELIVERY', location: depot, description: 'Out for delivery again (second attempt)' },
    );
  }
  route.push({ status: 'DELIVERED', location: city, description: carrier === 'INPOST' ? 'Delivered to the parcel locker' : 'Delivered to the recipient' });
  return route;
}

// Scans of a tracking response without their timestamps, for exact comparison with expectedRoute.
export function scans(tracking: Pick<TrackingDto, 'events'>): ExpectedScan[] {
  return tracking.events.map(({ status, location, description }) => ({ status, location, description }));
}

export type RoutePreference = 'any' | 'direct' | 'failsFirstAttempt';

export interface Parcel {
  shopper: Shopper;
  orderId: number;
  shipment: ShipmentDto;
  carrier: Carrier;
  trackingNumber: string;
}

// Places paid orders and hands them to the warehouse. Every simulated parcel a test ships is driven
// to DELIVERED afterwards, so the scheduled carrier never tries to deliver an order whose user was deleted.
export class Parcels {
  private readonly simulated = new Map<number, ShipmentDto>();

  constructor(private readonly warehouse: Warehouse) {}

  // A paid order of `shopper`, released to the warehouse and packed, but not shipped yet.
  @step('pay and pack a new order')
  async packed(shopper: Shopper, price = 25): Promise<{ orderId: number; shipment: ShipmentDto }> {
    const { order } = await shopper.placeOrder(price);
    await shopper.payAndWaitForPaid(order.id);
    const shipment = await this.warehouse.createShipment(order.id);
    await expect(await this.warehouse.client.pick(shipment.id), 'Pick').toHaveStatus(200);
    await expect(await this.warehouse.client.pack(shipment.id), 'Pack').toHaveStatus(200);
    return { orderId: order.id, shipment };
  }

  // A parcel handed to the simulated carrier. The carrier generates a random tracking number, and that
  // number alone decides whether the first delivery attempt fails (1 in 5); `route` keeps shipping new
  // orders until the number takes the requested route (bounded).
  @step('ship a paid order with the simulated carrier')
  async shipSimulated(shopper: Shopper, carrier: Carrier = 'DHL', route: RoutePreference = 'any', maxAttempts = 30): Promise<Parcel> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { orderId, shipment: packed } = await this.packed(shopper);
      const shipment = await this.warehouse.client.ship(packed.id, carrier);
      await expect(shipment, `Ship order ${orderId} with the simulated carrier`).toHaveStatus(200);
      const shipped = this.register(await shipment.json());
      const fails = failsFirstAttempt(shipped.trackingNumber!);
      if (route === 'any' || (route === 'failsFirstAttempt') === fails) {
        return { shopper, orderId, shipment: shipped, carrier, trackingNumber: shipped.trackingNumber! };
      }
    }
    throw new Error(`No ${carrier} tracking number took the ${route} route within ${maxAttempts} shipments`);
  }

  // Registers a parcel shipped outside this helper for delivery after the test.
  register(shipment: ShipmentDto): ShipmentDto {
    this.simulated.set(shipment.id, shipment);
    return shipment;
  }

  @step('advance shipment {0}')
  async advance(shipmentId: number): Promise<TrackingDto> {
    const response = await this.warehouse.client.advanceCarrier(shipmentId);
    await expect(response, `Advance carrier of shipment ${shipmentId}`).toHaveStatus(200);
    return response.json();
  }

  // Advances until the parcel shows `status` (or is delivered), bounded by the longest route.
  @step('advance the parcel until {1}')
  async advanceTo(parcel: Parcel, status: TrackingStatus): Promise<TrackingDto> {
    return this.warehouse.advanceUntil(parcel.shipment, status);
  }

  @step('deliver every leftover parcel')
  async deliverAll(): Promise<void> {
    for (const shipment of this.simulated.values()) {
      for (let step = 0; step < 8; step++) {
        const response = await this.warehouse.client.advanceCarrier(shipment.id);
        if (response.status() === 409) break;
        await expect(response, `Deliver leftover shipment ${shipment.id}`).toHaveStatus(200);
        if ((await response.json()).currentStatus === 'DELIVERED') break;
      }
    }
    this.simulated.clear();
  }
}
