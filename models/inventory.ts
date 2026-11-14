export type InventoryMovementType =
  | 'INITIAL_STOCK'
  | 'ADMIN_ADJUSTMENT'
  | 'ORDER_DEDUCTED'
  | 'ORDER_RESTORED'
  | 'PURCHASE_RECEIVED'
  | 'RETURN_RESTOCKED';

// GET /api/v1/admin/inventory/{id}/movements, newest first. warehouse-service owns the ledger since 1.6.0;
// the backend checks the product exists and returns warehouse's page unchanged.
export interface InventoryMovementDto {
  id: number;
  productId: number;
  orderId: number | null;
  type: InventoryMovementType;
  delta: number;
  quantityAfter: number;
  actor: string;
  reason: string | null;
  requestId: string | null;
  createdAt: string;
}

export interface SupplierDto {
  id: number;
  name: string;
  email: string;
  leadTimeDays: number;
  createdAt: string;
}

export type PurchaseOrderStatus = 'DRAFT' | 'SUBMITTED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrderLineRequestDto {
  productId: number;
  quantity: number;
  unitCost: number;
}

export interface PurchaseOrderDto {
  id: number;
  supplierId: number;
  supplierName: string;
  status: PurchaseOrderStatus;
  note: string | null;
  createdBy: string;
  totalCost: number;
  lines: {
    productId: number;
    productName: string;
    orderedQuantity: number;
    receivedQuantity: number;
    outstandingQuantity: number;
    unitCost: number;
    lineTotal: number;
  }[];
  receivedAt: string | null;
}
