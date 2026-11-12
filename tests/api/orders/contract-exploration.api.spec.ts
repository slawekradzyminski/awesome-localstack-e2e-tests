import { test, expect } from '@fixtures';
import { ExplorationFunctionalClient } from '@api/exploration-functional.client';

interface OpenApiProperty {
  pattern?: string;
}

// X-18: unknown paths and unsupported methods answer in the {message} shape, not Spring's default body.
test.describe('Backend routing errors', { tag: ['@orders'] }, () => {
  test('an unknown /api/v1 path is a 404 with a message', async ({ api, shopper }) => {
    // given
    const client = new ExplorationFunctionalClient(api.request, shopper.token);

    // when
    const response = await client.getPath('/api/v1/exploration-unknown-path');

    // then
    await expect(response).toHaveStatus(404);
    expect(await response.json()).toEqual({ message: 'Resource not found' });
  });

  test('an unsupported method is a 405 with a message and the allowed methods', async ({ api, shopper }) => {
    // given
    const client = new ExplorationFunctionalClient(api.request, shopper.token);

    // when
    const response = await client.patchPath('/api/v1/orders');

    // then
    await expect(response).toHaveStatus(405);
    expect(response.headers()['allow']).toContain('GET');
    expect(await response.json()).toEqual({ message: 'Method PATCH is not supported for this endpoint' });
  });
});

// X-24: the zipCode pattern groups its alternation, so a client-side regex cannot match part of a value.
test.describe('GET /v3/api-docs - address zip code', { tag: ['@orders'] }, () => {
  test('the documented zipCode pattern rejects partial matches - 200', async ({ api }) => {
    // given
    const docs = await new ExplorationFunctionalClient(api.request).apiDocs();
    await expect(docs, 'Read the OpenAPI document').toHaveStatus(200);
    const schemas = ((await docs.json()) as { components: { schemas: Record<string, { properties: Record<string, OpenApiProperty> }> } })
      .components.schemas;

    // when
    const zipCode = new RegExp(schemas.AddressDto.properties.zipCode.pattern ?? '');

    // then
    expect(['00-001', '12345', '12345-6789'].filter((value) => zipCode.test(value))).toHaveLength(3);
    expect(['12abc', 'x12345', '12-34'].filter((value) => zipCode.test(value))).toEqual([]);
  });
});
