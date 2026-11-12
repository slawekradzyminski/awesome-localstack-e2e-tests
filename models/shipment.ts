export type ShipmentStatus = 'AWAITING_PICK' | 'PICKED' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type Carrier = 'INPOST' | 'DPD' | 'DHL' | 'UPS';
export type TrackingStatus = 'LABEL_CREATED' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERY_FAILED' | 'DELIVERED';

export interface ShipmentDto {
  id: number;
  orderId: number;
  username: string;
  status: ShipmentStatus;
  totalUnits: number;
  carrier: string | null;
  trackingNumber: string | null;
  weightKg: number | null;
  createdBy: string;
  lastActor: string;
  createdAt: string;
  updatedAt: string;
  pickedAt: string | null;
  packedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
}

export interface TrackingEventDto {
  status: TrackingStatus;
  location: string;
  description: string;
  occurredAt: string;
}

export interface TrackingDto {
  shipmentId: number;
  orderId?: number;
  carrier: string | null;
  trackingNumber: string | null;
  simulated: boolean;
  currentStatus: TrackingStatus | null;
  estimatedDelivery: string | null;
  events: TrackingEventDto[];
}

// GET /api/v1/tracking/{trackingNumber}: anonymous view without the order id or owner.
export type PublicTrackingDto = Omit<TrackingDto, 'orderId'>;
