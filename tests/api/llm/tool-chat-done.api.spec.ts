import { test, expect } from '@fixtures';
import { LlmClient, sseEvents } from '@api/llm.client';
import type { ChatResponseDto } from '@models/commerce-fixes';

// T-041: the tool chat stream sends done=true only on the terminal event of the whole orchestration.
test.describe('POST /api/v1/ollama/chat/tools - done marker', { tag: ['@llm'] }, () => {
  test('marks only the last event as done although tools were called - 200', async ({ api, shopper }) => {
    // given
    const llm = new LlmClient(api.request, shopper.token);
    const definitions = await llm.toolDefinitions();
    await expect(definitions, 'Tool definitions').toHaveStatus(200);
    const tools: unknown[] = await definitions.json();

    // when
    const response = await llm.chatWithTools([{ role: 'user', content: 'What Beauty products do we have available?' }], tools);

    // then
    await expect(response).toHaveStatus(200);
    const events = sseEvents<ChatResponseDto>(await response.text());
    expect(events.some(event => event.message?.role === 'tool'), 'the orchestration called a tool').toBe(true);
    expect(events.map(event => event.done)).toEqual([...Array(events.length - 1).fill(false), true]);
  });
});
