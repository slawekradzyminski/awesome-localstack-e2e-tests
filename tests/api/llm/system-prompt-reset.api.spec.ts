import { test, expect } from '@fixtures';
import { LlmClient } from '@api/llm.client';
import type { ChatSystemPromptDto, ToolSystemPromptDto } from '@models/commerce-fixes';

// T-026: resetting a system prompt answers with the effective default, the value the next GET returns.
test.describe('PUT /api/v1/users/{chat,tool}-system-prompt - reset', { tag: ['@llm'] }, () => {
  const resets: [string, string | null | undefined][] = [['null', null], ['an omitted field', undefined], ['an empty string', '']];

  for (const [name, reset] of resets) {
    test(`chat prompt reset with ${name} answers with the default prompt - 200`, async ({ api, shopper }) => {
      // given
      const llm = new LlmClient(api.request, shopper.token);
      await expect(await llm.putChatSystemPrompt('Custom chat prompt'), 'Store an override').toHaveStatus(200);

      // when
      const response = await llm.putChatSystemPrompt(reset);

      // then
      await expect(response).toHaveStatus(200);
      const body: ChatSystemPromptDto = await response.json();
      const current: ChatSystemPromptDto = await (await llm.getChatSystemPrompt()).json();
      expect(body.chatSystemPrompt).toEqual(expect.stringMatching(/\S/));
      expect(body.chatSystemPrompt).not.toBe('Custom chat prompt');
      expect(body).toEqual(current);
    });

    test(`tool prompt reset with ${name} answers with the default prompt - 200`, async ({ api, shopper }) => {
      // given
      const llm = new LlmClient(api.request, shopper.token);
      await expect(await llm.putToolSystemPrompt('Custom tool prompt'), 'Store an override').toHaveStatus(200);

      // when
      const response = await llm.putToolSystemPrompt(reset);

      // then
      await expect(response).toHaveStatus(200);
      const body: ToolSystemPromptDto = await response.json();
      const current: ToolSystemPromptDto = await (await llm.getToolSystemPrompt()).json();
      expect(body.toolSystemPrompt).toEqual(expect.stringMatching(/\S/));
      expect(body.toolSystemPrompt).not.toBe('Custom tool prompt');
      expect(body).toEqual(current);
    });
  }
});
