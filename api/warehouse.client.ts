import { ApiClient, segment } from './api-client';
import type { ShipmentStatus } from '@models/shipment';

export const SHIPMENTS_ENDPOINT = '/api/v1/warehouse/shipments';

// Needs a ROLE_WAREHOUSE or ROLE_ADMIN token.
export class WarehouseClient extends ApiClient {
  createShipment(orderId: number) {
    return this.post(SHIPMENTS_ENDPOINT, { orderId });
  }

  getShipment(id: number) {
    return this.get(`${SHIPMENTS_ENDPOINT}/${segment(id)}`);
  }

  listShipments(params: { status?: ShipmentStatus; page?: number; size?: number } = {}) {
    return this.get(SHIPMENTS_ENDPOINT, params);
  }

  pick(id: number) {
    return this.post(`${SHIPMENTS_ENDPOINT}/${segment(id)}/pick`);
  }

  pack(id: number, weightKg = 1.2) {
    return this.post(`${SHIPMENTS_ENDPOINT}/${segment(id)}/pack`, { weightKg });
  }

  // Omit trackingNumber to use the simulated carrier.
  ship(id: number, carrier = 'DHL', trackingNumber?: string) {
    return this.post(`${SHIPMENTS_ENDPOINT}/${segment(id)}/ship`, trackingNumber ? { carrier, trackingNumber } : { carrier });
  }

  deliver(id: number) {
    return this.post(`${SHIPMENTS_ENDPOINT}/${segment(id)}/deliver`);
  }

  cancel(id: number) {
    return this.post(`${SHIPMENTS_ENDPOINT}/${segment(id)}/cancel`);
  }

  advanceCarrier(id: number) {
    return this.post(`${SHIPMENTS_ENDPOINT}/${segment(id)}/carrier/advance`);
  }
}

export class TrackingClient extends ApiClient {
  // Owner or admin.
  orderShipment(orderId: number) {
    return this.get(`/api/v1/orders/${segment(orderId)}/shipment`);
  }

  orderTracking(orderId: number) {
    return this.get(`/api/v1/orders/${segment(orderId)}/shipment/tracking`);
  }

  // Public: works without a token.
  publicTracking(trackingNumber: string) {
    return this.get(`/api/v1/tracking/${segment(trackingNumber)}`);
  }
}
