import { ApiClient, segment } from './api-client';
import type { WebhookCreateDto, WebhookUpdateDto } from '@models/webhook';

export const WEBHOOKS_ENDPOINT = '/api/v1/webhooks';

export class WebhooksClient extends ApiClient {
  eventTypes() {
    return this.get(`${WEBHOOKS_ENDPOINT}/event-types`);
  }

  create(webhook: WebhookCreateDto) {
    return this.post(WEBHOOKS_ENDPOINT, webhook);
  }

  list(params: { page?: number; size?: number } = {}) {
    return this.get(WEBHOOKS_ENDPOINT, params);
  }

  getById(id: number) {
    return this.get(`${WEBHOOKS_ENDPOINT}/${segment(id)}`);
  }

  update(id: number, webhook: WebhookUpdateDto) {
    return this.put(`${WEBHOOKS_ENDPOINT}/${segment(id)}`, webhook);
  }

  remove(id: number) {
    return this.delete(`${WEBHOOKS_ENDPOINT}/${segment(id)}`);
  }

  ping(id: number) {
    return this.post(`${WEBHOOKS_ENDPOINT}/${segment(id)}/test`);
  }

  rotateSecret(id: number) {
    return this.post(`${WEBHOOKS_ENDPOINT}/${segment(id)}/rotate-secret`);
  }

  deliveries(id: number, params: { status?: string; page?: number; size?: number } = {}) {
    return this.get(`${WEBHOOKS_ENDPOINT}/${segment(id)}/deliveries`, params);
  }

  delivery(id: number, deliveryId: string) {
    return this.get(`${WEBHOOKS_ENDPOINT}/${segment(id)}/deliveries/${segment(deliveryId)}`);
  }

  redeliver(id: number, deliveryId: string) {
    return this.post(`${WEBHOOKS_ENDPOINT}/${segment(id)}/deliveries/${segment(deliveryId)}/redeliver`);
  }

  // ROLE_ADMIN
  listAll(params: { username?: string; page?: number; size?: number } = {}) {
    return this.get('/api/v1/admin/webhooks', params);
  }

  // Built-in inbox: deliveries to its url are stored and readable without an external server.
  createInbox() {
    return this.post('/api/v1/webhook-inboxes');
  }

  inboxes() {
    return this.get('/api/v1/webhook-inboxes');
  }

  inboxRequests(token: string) {
    return this.get(`/api/v1/webhook-inboxes/${segment(token)}/requests`);
  }

  deleteInbox(token: string) {
    return this.delete(`/api/v1/webhook-inboxes/${segment(token)}`);
  }
}
