import { expect } from './expect';
import { step } from './step';
import { ASYNC_TIMEOUT, POLL_INTERVALS } from '@config';
import type { WebhooksClient } from '@api/webhooks.client';
import type {
  WebhookDeliveryDto, WebhookEventType, WebhookInboxDto, WebhookInboxRequestDto, WebhookPayload, WebhookSubscriptionDto,
} from '@models/webhook';
import type { ApiTestContext } from './api-test-context';
import type { Shopper } from './shopper';
import { header, signatureMatches } from './webhook-signature';

// Event types a subscription can name, in the order GET /api/v1/webhooks/event-types lists them.
export const COMMERCE_EVENTS: WebhookEventType[] = [
  'order.created', 'order.paid', 'order.cancelled', 'shipment.shipped', 'shipment.delivered', 'refund.booked', 'payment.failed',
];

export const SECRET_FORMAT = /^whsec_[A-Za-z0-9_-]{43}$/;
export const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const PUBLIC_URL = 'https://93.184.215.14/hooks/shop';

// A received inbox request with its body parsed.
export interface ReceivedWebhook {
  event: string | undefined;
  deliveryId: string | undefined;
  requestId: string | undefined;
  signature: string | undefined;
  payload: WebhookPayload;
  raw: WebhookInboxRequestDto;
}

// A subscription as GET and list return it: the secret is only ever in the create and rotate responses.
export function withoutSecret(subscription: WebhookSubscriptionDto): Omit<WebhookSubscriptionDto, 'secret'> {
  const stored: Partial<WebhookSubscriptionDto> = { ...subscription };
  delete stored.secret;
  return stored as Omit<WebhookSubscriptionDto, 'secret'>;
}

export function received(raw: WebhookInboxRequestDto): ReceivedWebhook {
  return {
    event: header(raw.headers, 'X-Webhook-Event'),
    deliveryId: header(raw.headers, 'X-Webhook-Id'),
    requestId: header(raw.headers, 'X-Request-Id'),
    signature: header(raw.headers, 'X-Webhook-Signature'),
    payload: JSON.parse(raw.body),
    raw,
  };
}

export function isSignedWith(secret: string, webhook: ReceivedWebhook): boolean {
  return signatureMatches(secret, webhook.signature!, webhook.raw.body);
}

export async function createInbox(webhooks: WebhooksClient): Promise<WebhookInboxDto> {
  const response = await webhooks.createInbox();
  await expect(response, 'Create a webhook inbox').toHaveStatus(201);
  return response.json();
}

export async function subscribe(webhooks: WebhooksClient, url: string, events: WebhookEventType[], description?: string): Promise<WebhookSubscriptionDto> {
  const response = await webhooks.create(description === undefined ? { url, events } : { url, events, description });
  await expect(response, `Subscribe ${url} to ${events.join(', ')}`).toHaveStatus(201);
  return response.json();
}

export async function inboxRequests(webhooks: WebhooksClient, token: string): Promise<ReceivedWebhook[]> {
  const response = await webhooks.inboxRequests(token);
  await expect(response, `Read inbox ${token}`).toHaveStatus(200);
  return ((await response.json()) as WebhookInboxRequestDto[]).map(received);
}

export async function deliveries(webhooks: WebhooksClient, subscriptionId: number): Promise<WebhookDeliveryDto[]> {
  const response = await webhooks.deliveries(subscriptionId, { size: 100 });
  await expect(response, `Read deliveries of webhook ${subscriptionId}`).toHaveStatus(200);
  return (await response.json()).content;
}

// One built-in inbox with a subscription pointed at it: the test's webhook receiver.
export class InboxReceiver {
  private constructor(
    private readonly webhooks: WebhooksClient,
    readonly inbox: WebhookInboxDto,
    readonly subscription: WebhookSubscriptionDto,
  ) {}

  @step('subscribe an inbox to {1}')
  static async subscribe(owner: Pick<Shopper, 'webhooks'>, events: WebhookEventType[]): Promise<InboxReceiver> {
    const inbox = await createInbox(owner.webhooks);
    const subscription = await subscribe(owner.webhooks, inbox.url, events, 'Playwright receiver');
    return new InboxReceiver(owner.webhooks, inbox, subscription);
  }

  get secret(): string {
    return this.subscription.secret!;
  }

  requests(): Promise<ReceivedWebhook[]> {
    return inboxRequests(this.webhooks, this.inbox.token);
  }

  deliveries(): Promise<WebhookDeliveryDto[]> {
    return deliveries(this.webhooks, this.subscription.id);
  }

  /**
   * Payloads of `type` about the order that the backend has published to this subscription.
   * Deliveries are recorded when the event is published, before they are sent.
   */
  async publishedEvents(type: WebhookEventType, orderId: number): Promise<WebhookPayload[]> {
    return (await this.deliveries())
      .filter((delivery) => delivery.eventType === type)
      .map((delivery) => JSON.parse(delivery.payload) as WebhookPayload)
      .filter((event) => event.data.orderId === orderId);
  }

  // Waits until a delivery of `event` (about `orderId`, when given) arrives; returns it.
  @step('wait for a {0} delivery')
  async waitFor(event: string, orderId?: number): Promise<ReceivedWebhook> {
    let match: ReceivedWebhook | undefined;
    await expect.poll(async () => {
      match = (await this.requests()).find(request => request.event === event
        && (orderId === undefined || request.payload.data.orderId === orderId));
      return match !== undefined;
    }, { message: `${event} webhook${orderId ? ` for order ${orderId}` : ''} reaches inbox ${this.inbox.token}`, timeout: ASYNC_TIMEOUT, intervals: POLL_INTERVALS })
      .toBe(true);
    return match!;
  }

  @step('wait for {0} deliveries')
  async waitForCount(count: number): Promise<ReceivedWebhook[]> {
    await expect.poll(async () => (await this.requests()).length, {
      message: `${count} webhooks reach inbox ${this.inbox.token}`, timeout: ASYNC_TIMEOUT, intervals: POLL_INTERVALS,
    }).toBe(count);
    return this.requests();
  }
}

// Books a refund for a delivered order through the warehouse returns flow (customer request, admin
// approve, receive, refund); the backend then publishes refund.booked.
export async function bookReturnRefund(api: ApiTestContext, shopper: Shopper, orderId: number, productId: number): Promise<number> {
  const customer = { Authorization: `Bearer ${shopper.token}` };
  const created = await api.request.post(`/api/v1/orders/${orderId}/returns`, {
    headers: customer, data: { reason: 'DAMAGED', items: [{ productId, quantity: 1 }] },
  });
  await expect(created, 'Request a return').toHaveStatus(201);
  const { id } = await created.json();
  const admin = { Authorization: `Bearer ${await api.getAdminToken()}` };
  await expect(await api.request.post(`/api/v1/admin/returns/${id}/approve`, { headers: admin }), 'Approve the return').toHaveStatus(200);
  await expect(await api.request.post(`/api/v1/admin/returns/${id}/receive`, {
    headers: admin, data: { items: [{ productId, condition: 'RESELLABLE' }] },
  }), 'Receive the returned goods').toHaveStatus(200);
  const refunded = await api.request.post(`/api/v1/admin/returns/${id}/refund`, { headers: admin });
  await expect(refunded, 'Refund the return').toHaveStatus(200);
  return (await refunded.json()).refundAmount;
}
