import { test, expect } from '@fixtures';
import { WebhooksClient } from '@api/webhooks.client';
import { COMMERCE_EVENTS, PUBLIC_URL, SECRET_FORMAT, createInbox, subscribe } from '@support/webhooks';
import type { WebhookCreateDto, WebhookSubscriptionDto } from '@models/webhook';

const rejected = (reason: string) => ({ message: `Webhook URL rejected: ${reason}` });
const publicOnly = (host: string, kind: string) => rejected(`Host ${host} resolves to ${kind}; webhooks can only call public addresses`);
const internalHost = (host: string) => rejected(`Host ${host} is internal; webhooks can only call public hosts`);

// SSRF guard (WebhookUrlPolicy): only public http(s) targets on port 80 or 443. IP literals avoid any DNS dependency.
const ssrfCases: [string, string, { message: string }][] = [
  ['cloud metadata (link-local)', 'http://169.254.169.254/latest/meta-data', publicOnly('169.254.169.254', 'a link-local address')],
  ['IPv4 loopback', 'http://127.0.0.1/hook', publicOnly('127.0.0.1', 'a loopback address')],
  ['IPv6 loopback', 'http://[::1]/hook', publicOnly('::1', 'a loopback address')],
  ['IPv4-mapped IPv6 loopback', 'http://[::ffff:127.0.0.1]/hook', publicOnly('::ffff:127.0.0.1', 'a loopback address')],
  ['unspecified address', 'http://0.0.0.0/hook', publicOnly('0.0.0.0', 'an unspecified address')],
  ['private 10/8', 'http://10.0.0.1/hook', publicOnly('10.0.0.1', 'a private address')],
  ['private 172.16/12', 'http://172.16.0.1/hook', publicOnly('172.16.0.1', 'a private address')],
  ['private 192.168/16', 'https://192.168.1.1/hook', publicOnly('192.168.1.1', 'a private address')],
  ['carrier-grade NAT', 'http://100.64.0.1/hook', publicOnly('100.64.0.1', 'a carrier-grade NAT address')],
  ['IPv6 link-local', 'http://[fe80::1]/hook', publicOnly('fe80::1', 'a link-local address')],
  ['IPv6 unique-local', 'http://[fc00::1]/hook', publicOnly('fc00::1', 'a unique-local address')],
  ['localhost', 'http://localhost/hook', internalHost('localhost')],
  ['localhost in capitals with a trailing dot', 'http://LOCALHOST./hook', internalHost('localhost')],
  ['*.localhost', 'http://api.localhost/hook', internalHost('api.localhost')],
  ['*.local', 'http://printer.local/hook', internalHost('printer.local')],
  ['*.internal', 'http://metadata.google.internal/hook', internalHost('metadata.google.internal')],
  ['Compose service name', 'http://backend/hook', rejected('Host backend is not a fully qualified domain name; webhooks can only call public hosts')],
  ['Compose service name with its port', 'http://warehouse-service:4002/hook', rejected('Host warehouse-service is not a fully qualified domain name; webhooks can only call public hosts')],
  ['port other than 80 or 443', 'https://93.184.215.14:8443/hook', rejected('URL port 8443 is not allowed; use 80 or 443')],
  ['ftp scheme', 'ftp://93.184.215.14/hook', rejected('URL must use http or https')],
  ['file scheme', 'file:///etc/passwd', rejected('URL must be absolute, for example https://example.com/hook')],
  ['javascript scheme', 'javascript:alert(1)', rejected('URL must be absolute, for example https://example.com/hook')],
  ['credentials in the URL', 'https://user:secret@93.184.215.14/hook', rejected('URL must not contain credentials')],
  ['not a URL', 'not a url', rejected('URL is not valid')],
  ['inbox that does not exist', 'inbox://does-not-exist', rejected('unknown inbox; create one with POST /api/v1/webhook-inboxes')],
];

const validationCases: [string, Partial<WebhookCreateDto>, Record<string, string>][] = [
  ['missing url and events', {}, { url: 'URL is required', events: 'At least one event type is required' }],
  ['blank url', { url: '   ', events: ['order.created'] }, { url: 'URL is required' }],
  ['url longer than 2048 characters', { url: `${PUBLIC_URL}/${'a'.repeat(2048)}`, events: ['order.created'] }, { url: 'URL must be at most 2048 characters' }],
  ['empty events', { url: PUBLIC_URL, events: [] }, { events: 'At least one event type is required' }],
  ['description longer than 255 characters', { url: PUBLIC_URL, events: ['order.created'], description: 'd'.repeat(256) }, { description: 'Description must be at most 255 characters' }],
];

test.describe('POST /api/v1/webhooks', { tag: ['@webhooks'] }, () => {
  test('creates a subscription and returns its signing secret only once - 201', async ({ shopper }) => {
    // given
    const inbox = await createInbox(shopper.webhooks);

    // when
    const response = await shopper.webhooks.create({ url: inbox.url, events: ['order.created', 'order.paid'], description: 'Order sync' });

    // then
    await expect(response).toHaveStatus(201);
    const created: WebhookSubscriptionDto = await response.json();
    expect(created).toEqual({
      id: expect.any(Number),
      username: shopper.username,
      url: inbox.url,
      description: 'Order sync',
      events: ['order.created', 'order.paid'],
      active: true,
      consecutiveFailures: 0,
      disabledReason: null,
      secret: expect.stringMatching(SECRET_FORMAT),
      createdAt: expect.any(String),
      updatedAt: created.createdAt,
    });
    const { secret, ...stored } = created;
    expect(secret).toBeDefined();
    expect(await (await shopper.webhooks.getById(created.id)).json()).toEqual(stored);
    expect(await (await shopper.webhooks.list()).json()).toEqual([stored]);
  });

  test('accepts a public https URL and every commerce event - 201', async ({ shopper }) => {
    // when
    const response = await shopper.webhooks.create({ url: PUBLIC_URL, events: COMMERCE_EVENTS });

    // then
    await expect(response).toHaveStatus(201);
    expect(await response.json()).toMatchObject({ url: PUBLIC_URL, events: COMMERCE_EVENTS, description: null, active: true });
  });

  test('accepts plain http on port 80 - 201', async ({ shopper }) => {
    // when
    const response = await shopper.webhooks.create({ url: 'http://93.184.215.14:80/hook', events: ['order.created'] });

    // then
    await expect(response).toHaveStatus(201);
    expect(await response.json()).toMatchObject({ url: 'http://93.184.215.14:80/hook' });
  });

  test('stores each event type once, in request order - 201', async ({ shopper }) => {
    // when
    const response = await shopper.webhooks.create({ url: PUBLIC_URL, events: ['order.paid', 'order.created', 'order.paid'] });

    // then
    await expect(response).toHaveStatus(201);
    const created: WebhookSubscriptionDto = await response.json();
    expect(created.events).toEqual(['order.paid', 'order.created']);
    expect((await (await shopper.webhooks.getById(created.id)).json()).events).toEqual(['order.paid', 'order.created']);
  });

  for (const [name, body, errors] of validationCases) {
    test(`rejects ${name} - 400`, async ({ shopper }) => {
      // when
      const response = await shopper.webhooks.create(body as WebhookCreateDto);

      // then
      await expect(response).toHaveStatus(400);
      expect(await response.json()).toEqual(errors);
      expect(await (await shopper.webhooks.list()).json()).toEqual([]);
    });
  }

  test('rejects an unknown event type and names the allowed ones - 400', async ({ shopper }) => {
    // when
    const response = await shopper.webhooks.create({ url: PUBLIC_URL, events: ['order.created', 'order.shipped' as never] });

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual({
      message: "Unknown event type 'order.shipped'. Allowed: order.created, order.paid, order.cancelled, shipment.shipped, "
        + 'shipment.delivered, refund.booked, payment.failed, webhook.ping',
    });
  });

  for (const [name, url, error] of ssrfCases) {
    test(`refuses a target that is a ${name} - 400`, async ({ shopper }) => {
      // when
      const response = await shopper.webhooks.create({ url, events: ['order.created'] });

      // then
      await expect(response).toHaveStatus(400);
      expect(await response.json()).toEqual(error);
      expect(await (await shopper.webhooks.list()).json()).toEqual([]);
    });
  }

  test('refuses another user\'s inbox - 400', async ({ shopper, otherShopper }) => {
    // given
    const othersInbox = await createInbox(otherShopper.webhooks);

    // when
    const response = await shopper.webhooks.create({ url: othersInbox.url, events: ['order.created'] });

    // then
    await expect(response).toHaveStatus(400);
    expect(await response.json()).toEqual(rejected('unknown inbox; create one with POST /api/v1/webhook-inboxes'));
  });

  test('allows at most five subscriptions per user - 409', async ({ shopper }) => {
    // given
    for (let i = 0; i < 5; i++) await subscribe(shopper.webhooks, `${PUBLIC_URL}/${i}`, ['order.created']);

    // when
    const response = await shopper.webhooks.create({ url: `${PUBLIC_URL}/6`, events: ['order.created'] });

    // then
    await expect(response).toHaveStatus(409);
    expect(await response.json()).toEqual({ message: 'You can have at most 5 webhook subscriptions' });
    expect(await (await shopper.webhooks.list()).json()).toHaveLength(5);
  });

  test('requires authentication - 401', async ({ request }) => {
    // when
    const response = await new WebhooksClient(request).create({ url: PUBLIC_URL, events: ['order.created'] });

    // then
    await expect(response).toHaveStatus(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
  });
});
