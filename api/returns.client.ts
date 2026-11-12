import { ApiClient, segment } from './api-client';

export type ReturnReason = 'DAMAGED' | 'WRONG_ITEM' | 'NOT_AS_DESCRIBED' | 'NO_LONGER_NEEDED';
export type ItemCondition = 'RESELLABLE' | 'DAMAGED';
export type ReturnStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'RECEIVED' | 'REFUNDED';

export interface ReturnDto {
  id: number;
  orderId: number;
  username: string;
  status: ReturnStatus;
  reason: ReturnReason;
  comment: string | null;
  resolutionNote: string | null;
  estimatedRefund: number;
  refundAmount: number | null;
  items: { productId: number; productName: string; quantity: number; unitPrice: number; condition: ItemCondition | null }[];
}

// Customer side of warehouse-service returns (RMA).
export class ReturnsClient extends ApiClient {
  create(orderId: number, items: { productId: number; quantity: number }[], reason: ReturnReason = 'NO_LONGER_NEEDED') {
    return this.post(`/api/v1/orders/${segment(orderId)}/returns`, { reason, items });
  }

  mine() {
    return this.get('/api/v1/returns');
  }
}

// ROLE_ADMIN side: approve, receive the goods, refund.
export class ReturnsAdminClient extends ApiClient {
  approve(id: number) {
    return this.post(`/api/v1/admin/returns/${segment(id)}/approve`);
  }

  receive(id: number, items: { productId: number; condition: ItemCondition }[]) {
    return this.post(`/api/v1/admin/returns/${segment(id)}/receive`, { items });
  }

  refund(id: number) {
    return this.post(`/api/v1/admin/returns/${segment(id)}/refund`);
  }

  reject(id: number, note: string) {
    return this.post(`/api/v1/admin/returns/${segment(id)}/reject`, { note });
  }

  getById(id: number) {
    return this.get(`/api/v1/admin/returns/${segment(id)}`);
  }
}
