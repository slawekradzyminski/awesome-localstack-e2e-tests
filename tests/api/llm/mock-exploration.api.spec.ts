import { test, expect } from '@fixtures';
import { ApiClient } from '@api/api-client';
import { LlmClient, OLLAMA_ENDPOINT, sseEvents } from '@api/llm.client';
import type { ChatResponseDto } from '@models/commerce-fixes';

// X-26 (ollama-mock 1.0.13): tool-chat answers are built from the tool output the backend sent
// back, and an unknown model is answered with Ollama's 404 instead of a 200 stream.

const LAPTOPS_PROMPT = 'List the laptops under $1500.';
const UNKNOWN_MODEL = 'no-such-model:1b';

// list_products returns ids and names only.
interface ListedProduct {
  id: number;
  name: string;
}

class UnknownModelClient extends ApiClient {
  generate() {
    return this.post(`${OLLAMA_ENDPOINT}/generate`, { model: UNKNOWN_MODEL, prompt: 'Provide a motivational quote' },
      { Accept: 'text/event-stream' });
  }

  chat() {
    return this.post(`${OLLAMA_ENDPOINT}/chat`, { model: UNKNOWN_MODEL, messages: [{ role: 'user', content: 'Hi' }] },
      { Accept: 'text/event-stream' });
  }

  chatWithTools(tools: unknown[]) {
    return this.post(`${OLLAMA_ENDPOINT}/chat/tools`,
      { model: UNKNOWN_MODEL, messages: [{ role: 'user', content: LAPTOPS_PROMPT }], tools },
      { Accept: 'text/event-stream' });
  }
}

const assistantText = (events: ChatResponseDto[]) =>
  events.map(event => (event.message?.role === 'assistant' ? (event.message.content ?? '') : '')).join('');

const listProductsResult = (events: ChatResponseDto[]): ListedProduct[] => {
  const tool = events.find(event => event.message?.role === 'tool' && event.message.tool_name === 'list_products');
  return (JSON.parse(tool?.message?.content ?? '{}') as { products?: ListedProduct[] }).products ?? [];
};

/** The grounded answer for the laptops prompt: every listed computer by name, prices unconfirmed. */
const expectedLaptopsAnswer = (products: ListedProduct[]) => {
  const names = products.map(product => product.name);
  const joined = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names.join('');
  return `The catalog lists these laptops: ${joined}. `
    + 'The catalog list has no prices, so I cannot confirm which of them cost under $1500.';
};

test.describe('POST /api/v1/ollama/chat/tools - grounded answers', { tag: ['@llm'] }, () => {
  test('answers the laptops question only with products the catalog tool returned - 200', async ({ api, shopper }) => {
    // given
    const laptop = await api.createProduct({ category: 'Computers', price: 1234.5, stockQuantity: 3 });
    const llm = new LlmClient(api.request, shopper.token);
    const definitions = await llm.toolDefinitions();
    await expect(definitions, 'Tool definitions').toHaveStatus(200);

    // when
    const response = await llm.chatWithTools([{ role: 'user', content: LAPTOPS_PROMPT }], await definitions.json());

    // then
    await expect(response, 'Tool chat for laptops').toHaveStatus(200);
    const events = sseEvents<ChatResponseDto>(await response.text());
    const toolCall = events.flatMap(event => (event.message?.tool_calls ?? []) as { function: { name: string; arguments: object } }[])[0];
    expect(toolCall?.function).toEqual({ name: 'list_products', arguments: expect.objectContaining({ category: 'computers' }) });
    const listed = listProductsResult(events);
    expect(listed.map(product => product.name), 'the catalog tool returned the test laptop').toContain(laptop.name);
    const answer = assistantText(events);
    expect(answer).toBe(expectedLaptopsAnswer(listed));
    expect(answer).toContain(laptop.name);
    expect(answer).not.toMatch(/FalconBook|Apex Ultralight/);
  });
});

test.describe('POST /api/v1/ollama - unknown model', { tag: ['@llm'] }, () => {
  test('generate answers 404 with the missing model - 404', async ({ api, shopper }) => {
    // given
    const llm = new UnknownModelClient(api.request, shopper.token);

    // when
    const response = await llm.generate();

    // then
    await expect(response, 'Generate with an unknown model').toHaveStatus(404);
    expect(await response.json()).toEqual({ error: `model '${UNKNOWN_MODEL}' not found` });
  });

  test('chat answers 404 with the missing model - 404', async ({ api, shopper }) => {
    // given
    const llm = new UnknownModelClient(api.request, shopper.token);

    // when
    const response = await llm.chat();

    // then
    await expect(response, 'Chat with an unknown model').toHaveStatus(404);
    expect(await response.json()).toEqual({ error: `model '${UNKNOWN_MODEL}' not found` });
  });

  test('tool chat answers 404 with the missing model - 404', async ({ api, shopper }) => {
    // given
    const definitions = await new LlmClient(api.request, shopper.token).toolDefinitions();
    await expect(definitions, 'Tool definitions').toHaveStatus(200);
    const llm = new UnknownModelClient(api.request, shopper.token);

    // when
    const response = await llm.chatWithTools(await definitions.json());

    // then
    await expect(response, 'Tool chat with an unknown model').toHaveStatus(404);
    expect(await response.json()).toEqual({ error: `model '${UNKNOWN_MODEL}' not found` });
  });
});
