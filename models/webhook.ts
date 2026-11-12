export type WebhookEventType =
  | 'order.created' | 'order.paid' | 'order.cancelled' | 'shipment.shipped' | 'shipment.delivered'
  | 'refund.booked' | 'payment.failed';

// What a subscription may list: the commerce events plus the test ping.
export type WebhookSubscribableEvent = WebhookEventType | 'webhook.ping';

export interface WebhookCreateDto {
  url: string;
  events: WebhookSubscribableEvent[];
  description?: string | null;
}

export interface WebhookUpdateDto extends WebhookCreateDto {
  active?: boolean | null;
}

export interface WebhookSubscriptionDto {
  id: number;
  username: string;
  url: string;
  description: string | null;
  events: WebhookEventType[];
  active: boolean;
  consecutiveFailures: number;
  disabledReason: string | null;
  secret?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDeliveryDto {
  id: string;
  subscriptionId: number;
  eventId: string;
  eventType: WebhookEventType | 'ping';
  status: string;
  attempts: number;
  nextAttemptAt: string | null;
  lastStatusCode: number | null;
  lastError: string | null;
  responseSnippet: string | null;
  durationMs: number | null;
  payload: string;
  createdAt: string;
  deliveredAt: string | null;
}

export interface WebhookInboxDto {
  token: string;
  url: string;
  createdAt: string;
}

export interface WebhookInboxRequestDto {
  id: number;
  receivedAt: string;
  headers: Record<string, string>;
  body: string;
}

export type WebhookDeliveryStatus = 'PENDING' | 'DELIVERED' | 'FAILED';

// Body of every delivery: {"id","type","createdAt","data"}; id is the event id and stays the same on redelivery.
export interface WebhookPayload {
  id: string;
  type: WebhookEventType | 'webhook.ping';
  createdAt: string;
  data: Record<string, unknown> & { orderId?: number };
}

