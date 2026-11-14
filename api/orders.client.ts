import type { APIRequestContext } from '@playwright/test';
import type { AddressDto, OrderStatus } from '@models/order';

export const ORDERS_ENDPOINT = '/api/v1/orders';

export class OrdersClient {
  constructor(private readonly request: APIRequestContext, private readonly token?: string) {}

  create(address: AddressDto) {
    return this.request.post(ORDERS_ENDPOINT, { data: address, headers: this.jsonHeaders() });
  }

  getMine(params: { page?: number; size?: number; status?: OrderStatus } = {}) {
    return this.request.get(ORDERS_ENDPOINT, { params, headers: this.authHeaders() });
  }

  getById(id: number | string) {
    return this.request.get(`${ORDERS_ENDPOINT}/${encodeURIComponent(id)}`, { headers: this.authHeaders() });
  }

  updateStatus(id: number | string, status: OrderStatus) {
    return this.request.put(`${ORDERS_ENDPOINT}/${encodeURIComponent(id)}/status`, {
      data: status,
      headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
    });
  }

  cancel(id: number | string, headers: Record<string, string> = {}) {
    return this.request.post(`${ORDERS_ENDPOINT}/${encodeURIComponent(id)}/cancel`, { headers: { ...this.authHeaders(), ...headers } });
  }

  getAll(params: { page?: number; size?: number; status?: OrderStatus } = {}) {
    return this.request.get(`${ORDERS_ENDPOINT}/admin`, { params, headers: this.authHeaders() });
  }

  // ROLE_ADMIN time control (backend 3.21.0): ends the stock reservation of a PENDING order now.
  expireReservation(id: number | string, headers: Record<string, string> = {}) {
    return this.request.post(`/api/v1/admin/orders/${encodeURIComponent(id)}/expire-reservation`, { headers: { ...this.authHeaders(), ...headers } });
  }

  private jsonHeaders(): Record<string, string> {
    return { 'Content-Type': 'application/json', ...this.authHeaders() };
  }

  private authHeaders(): Record<string, string> {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }
}
