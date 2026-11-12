import { test, expect } from '@fixtures';
import { LlmChatPage } from '@pages/llm/llm-chat.page';

// X-34: the chat and tool-chat message fields had only a placeholder, no accessible name.
test.describe('LLM chat message field', { tag: ['@llm'] }, () => {
  for (const mode of ['chat', 'tools'] as const) {
    test(`the ${mode} message field is named 'Message' (X-34)`, async ({ shopperPage }) => {
      // given
      const chat = new LlmChatPage(shopperPage, mode);

      // when
      await chat.goto();

      // then
      await expect(shopperPage.getByRole('textbox', { name: 'Message' })).toBeVisible();
      await expect(chat.input).toHaveAccessibleName('Message');
    });
  }
});
