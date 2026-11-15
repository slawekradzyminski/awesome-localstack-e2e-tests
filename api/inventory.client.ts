import { ApiClient, segment } from './api-client';
import type { PurchaseOrderLineRequestDto } from '@models/inventory';

// ROLE_ADMIN. The stock ledger lives in warehouse-service (1.6.0+); the backend serves the movements page.
export class InventoryClient extends ApiClient {
  movements(productId: number, params: { page?: number; size?: number } = {}) {
    return this.get(`/api/v1/admin/inventory/${segment(productId)}/movements`, params);
  }
}

// ROLE_ADMIN side of warehouse-service purchasing: suppliers, purchase orders and goods receipts.
export class PurchasingClient extends ApiClient {
  createSupplier(supplier: { name: string; email: string; leadTimeDays: number }) {
    return this.post('/api/v1/admin/suppliers', supplier);
  }

  createPurchaseOrder(order: { supplierId: number; note?: string; lines: PurchaseOrderLineRequestDto[] }) {
    return this.post('/api/v1/admin/purchase-orders', order);
  }

  submit(id: number) {
    return this.post(`/api/v1/admin/purchase-orders/${segment(id)}/submit`);
  }

  receive(id: number, receipt: { requestId: string; lines: { productId: number; quantity: number }[] }) {
    return this.post(`/api/v1/admin/purchase-orders/${segment(id)}/receipts`, receipt);
  }
}
