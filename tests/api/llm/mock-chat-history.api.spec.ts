import { test, expect } from '@fixtures';
import { ApiClient } from '@api/api-client';
import type { APIResponse } from '@playwright/test';

// The backend proxies chat to ollama-mock and streams its chunks as server-sent events.
// The mock answers deterministic prompts; the LATEST user message of the history selects the answer.

const STATUS_PROMPT = 'Give me a quick status update on the Ollama mock';
const STATUS_ANSWER_START = 'The Ollama mock is up on port 11434';
const LIMITATIONS_PROMPT = 'What limitations should I expect from the mock?';
const LIMITATIONS_ANSWER_START = 'It only understands a curated set of prompts';
const IPHONES_PROMPT = 'What iphones do we have available? Tell me the details about them';
const BEAUTY_PROMPT = 'What Beauty products do we have available?';
const BEAUTY_ANSWER_START = 'The beauty shelf currently offers';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_name?: string;
  tool_calls?: { function: { name: string; arguments: Record<string, unknown> } }[];
}

interface ChatChunk {
  model: string;
  message?: ChatMessage;
  done: boolean;
}

const STREAM = { Accept: 'text/event-stream' };

class LlmChatClient extends ApiClient {
  chat(messages: ChatMessage[]) {
    return this.post('/api/v1/ollama/chat', { model: 'qwen3.5:2b', messages, think: false }, STREAM);
  }

  toolDefinitions() {
    return this.get('/api/v1/ollama/chat/tools/definitions');
  }

  chatWithTools(messages: ChatMessage[], tools: unknown[]) {
    return this.post('/api/v1/ollama/chat/tools', { model: 'qwen3.5:2b', messages, tools }, STREAM);
  }
}

// One event per blank-line separated block; a block's data lines join with newlines (SSE spec).
async function chunks(response: APIResponse): Promise<ChatChunk[]> {
  return (await response.text())
    .split(/\r?\n\r?\n/)
    .map((block) =>
      block
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice('data:'.length))
        .join('\n'),
    )
    .filter((data) => data.trim().length > 0)
    .map((data) => JSON.parse(data) as ChatChunk);
}

const assistantText = (events: ChatChunk[]) =>
  events.map((event) => (event.message?.role === 'assistant' ? (event.message.content ?? '') : '')).join('');

const toolCallNames = (events: ChatChunk[]) =>
  events.flatMap((event) => event.message?.tool_calls ?? []).map((call) => call.function.name);

test.describe('POST /api/v1/ollama/chat - message history', { tag: ['@llm'] }, () => {
  test('answers the latest user prompt of a multi-turn history - 200', async ({ api, shopper }) => {
    // given
    const llm = new LlmChatClient(api.request, shopper.token);
    const history: ChatMessage[] = [
      { role: 'user', content: STATUS_PROMPT },
      { role: 'assistant', content: 'ok' },
      { role: 'user', content: LIMITATIONS_PROMPT },
    ];

    // when
    const response = await llm.chat(history);

    // then
    await expect(response, 'chat with a two-question history').toHaveStatus(200);
    const answer = assistantText(await chunks(response));
    expect(answer).toMatch(new RegExp(`^${LIMITATIONS_ANSWER_START}`));
    expect(answer).not.toContain(STATUS_ANSWER_START);
  });

  test('falls back to the latest known prompt when the newest one is unknown - 200', async ({ api, shopper }) => {
    // given
    const llm = new LlmChatClient(api.request, shopper.token);
    const history: ChatMessage[] = [
      { role: 'user', content: LIMITATIONS_PROMPT },
      { role: 'assistant', content: 'ok' },
      { role: 'user', content: STATUS_PROMPT },
      { role: 'assistant', content: 'ok' },
      { role: 'user', content: 'Thanks!' },
    ];

    // when
    const response = await llm.chat(history);

    // then
    await expect(response, 'chat ending with an unknown prompt').toHaveStatus(200);
    expect(assistantText(await chunks(response))).toMatch(new RegExp(`^${STATUS_ANSWER_START}`));
  });
});

test.describe('POST /api/v1/ollama/chat/tools - message history', { tag: ['@llm'] }, () => {
  test('runs the tool loop of the follow-up question, not the first one - 200', async ({ api, shopper }) => {
    // given
    const llm = new LlmChatClient(api.request, shopper.token);
    const definitions = await llm.toolDefinitions();
    await expect(definitions, 'tool definitions').toHaveStatus(200);
    const history: ChatMessage[] = [
      { role: 'user', content: IPHONES_PROMPT },
      { role: 'assistant', content: 'We have the iPhone 13 Pro in stock.' },
      { role: 'user', content: BEAUTY_PROMPT },
    ];

    // when
    const response = await llm.chatWithTools(history, (await definitions.json()) as unknown[]);

    // then
    await expect(response, 'tool chat with a two-question history').toHaveStatus(200);
    const events = await chunks(response);
    expect(toolCallNames(events)).toEqual(['list_products']);
    expect(events.flatMap((event) => event.message?.tool_calls ?? [])[0]?.function.arguments).toEqual(
      expect.objectContaining({ category: 'beauty' }),
    );
    expect(assistantText(events)).toMatch(new RegExp(`^${BEAUTY_ANSWER_START}`));
  });
});
