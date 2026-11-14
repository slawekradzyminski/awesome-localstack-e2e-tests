import { test, expect } from '@fixtures';
import type { APIRequestContext } from '@playwright/test';

// notification-service 1.0.0 owns user webhooks behind the gateway, with the same public API as the backend
// (which keeps its endpoints mapped). The behaviour is covered by tests/api/webhooks, which now run against the
// service; this spec checks that no operation of the backend's webhook API went missing in the move.
const WEBHOOK_PATH = /^\/api\/v1\/(webhooks|webhook-inboxes|admin\/webhooks)(\/|$)/;

async function webhookOperations(request: APIRequestContext, docsPath: string): Promise<string[]> {
  const response = await request.get(docsPath);
  await expect(response, `OpenAPI document ${docsPath}`).toHaveStatus(200);
  const paths: Record<string, Record<string, unknown>> = (await response.json()).paths;
  return Object.entries(paths)
    .filter(([path]) => WEBHOOK_PATH.test(path))
    .flatMap(([path, operations]) => Object.keys(operations).map(method => `${method.toUpperCase()} ${path}`))
    .sort();
}

test.describe('Webhook API parity between the backend and the notification-service', { tag: ['@webhooks', '@notifications'] }, () => {
  test('the notification-service offers every webhook operation of the backend - 200', async ({ request }) => {
    // given
    const backend = await webhookOperations(request, '/v3/api-docs');

    // when
    const service = await webhookOperations(request, '/notification/v3/api-docs');

    // then
    expect(backend.length).toBeGreaterThan(10);
    expect(service).toEqual(backend);
  });
});
