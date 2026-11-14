export type ShipmentStatus = 'AWAITING_PICK' | 'PICKED' | 'PACKED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type Carrier = 'INPOST' | 'DPD' | 'DHL' | 'UPS';
export type TrackingStatus = 'LABEL_CREATED' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERY_FAILED' | 'DELIVERED';

export type WarehouseLocationCode = 'KRK' | 'GDN';

export interface ShipmentLineDto {
  productId: number;
  productName: string;
  category: string;
  quantity: number;
}

export interface ShipmentDto {
  id: number;
  orderId: number;
  username: string;
  status: ShipmentStatus;
  totalUnits: number;
  // warehouse-service 1.5.0: one shipment per warehouse location (parcel) of the order.
  locationCode: WarehouseLocationCode;
  locationName: string;
  parcelIndex: number;
  parcelCount: number;
  lines: ShipmentLineDto[];
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

export interface WarehouseLocationDto {
  code: WarehouseLocationCode;
  name: string;
  city: string;
  active: boolean;
  priority: number;
  primaryCategories: string[];
  backupCategories: string[];
}

export type FulfilmentState = ShipmentStatus;

export interface ReconciliationDto {
  orderId: number;
  backendState: FulfilmentState | null;
  aggregateState: FulfilmentState;
  lastMirroredState: FulfilmentState | null;
  parcels: { shipmentId: number; locationCode: WarehouseLocationCode; status: ShipmentStatus }[];
}
