import { test, expect } from '@fixtures';
import { ExplorationFunctionalClient } from '@api/exploration-functional.client';

// X-21: validation errors are 400 JSON whatever Accept says; only a successful PNG depends on Accept.
test.describe('POST /api/v1/qr/create - Accept header', { tag: ['@qr'] }, () => {
  test('reports blank text as a 400 field error when the client accepts only JSON', async ({ api, shopper }) => {
    // given
    const client = new ExplorationFunctionalClient(api.request, shopper.token);

    // when
    const response = await client.createQr('', 'application/json');

    // then
    await expect(response).toHaveStatus(400);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(await response.json()).toEqual({ text: 'Text is required' });
  });

  test('refuses a valid text with 406 when the client accepts only JSON', async ({ api, shopper }) => {
    // given
    const client = new ExplorationFunctionalClient(api.request, shopper.token);

    // when
    const response = await client.createQr('https://awesome-testing.com', 'application/json');

    // then
    await expect(response).toHaveStatus(406);
    expect(await response.json()).toEqual({ message: 'The requested response media type is not available' });
  });

  test('returns the PNG when Accept allows it through a wildcard - 200', async ({ api, shopper }) => {
    // given
    const client = new ExplorationFunctionalClient(api.request, shopper.token);

    // when
    const response = await client.createQr('https://awesome-testing.com', 'application/json, */*;q=0.5');

    // then
    await expect(response).toHaveStatus(200);
    expect(response.headers()['content-type']).toBe('image/png');
  });
});
