import { test, expect } from '@fixtures';
import { LlmChatPage } from '@pages/llm/llm-chat.page';
import { PHONE } from '@support/layout';

const STATUS_QUESTION = 'Give me a quick status update on the Ollama mock';

interface ChatRequest {
  messages: { role: string; content?: string; thinking?: string; tool_calls?: unknown[] }[];
}

test.describe('chat', { tag: ['@llm'] }, () => {
  test('a retry after a failed request is answered (T-042)', async ({ shopperPage }) => {
    // given: the first chat request fails
    await shopperPage.route('**/api/v1/ollama/chat', (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Service unavailable' }) }), { times: 1 });
    const chat = new LlmChatPage(shopperPage, 'chat');
    await chat.goto();
    await chat.ask(STATUS_QUESTION);
    await expect(chat.input).toBeEnabled();
    const retry = shopperPage.waitForRequest((request) => request.url().endsWith('/api/v1/ollama/chat') && request.method() === 'POST');

    // when
    await chat.ask(STATUS_QUESTION);

    // then
    const sent = (await retry).postDataJSON() as ChatRequest;
    expect(sent.messages.filter((message) => message.role === 'assistant' && !message.content && !message.thinking && !message.tool_calls?.length)).toEqual([]);
    await expect(chat.assistantAnswers.last()).not.toBeEmpty({ timeout: 30_000 });
    await expect(chat.input).toBeEnabled({ timeout: 30_000 });
  });

  test('role icons are decorative and the visible label names the speaker (T-043)', async ({ shopperPage }) => {
    // given
    const chat = new LlmChatPage(shopperPage, 'chat');
    await chat.goto();

    // when
    await chat.ask(STATUS_QUESTION);

    // then
    await expect(chat.assistantAnswers.last()).not.toBeEmpty({ timeout: 30_000 });
    await expect(chat.rolePill('user').last()).toHaveAttribute('aria-hidden', 'true');
    await expect(chat.rolePill('assistant').last()).toHaveAttribute('aria-hidden', 'true');
    await expect(chat.rolePill('user').last()).not.toHaveAttribute('aria-label');
    await expect(chat.roleLabel('user').last()).toHaveText('User');
    await expect(chat.roleLabel('assistant').last()).toHaveText('Assistant');
  });

  test('collapsed settings are out of the tab order (T-044)', async ({ shopperPage }) => {
    // given
    const chat = new LlmChatPage(shopperPage, 'chat');
    await chat.goto();
    await expect(chat.settings).toHaveAttribute('aria-hidden', 'true');

    // when
    await chat.settingsToggle.focus();
    await shopperPage.keyboard.press('Tab');

    // then
    await expect(chat.settings).toHaveAttribute('inert', '');
    expect(await chat.settings.evaluate((settings) => settings.contains(document.activeElement))).toBe(false);
  });

  test('the message input spans a phone screen (T-046)', async ({ shopperPage }) => {
    // given
    await shopperPage.setViewportSize(PHONE);
    const chat = new LlmChatPage(shopperPage, 'chat');

    // when
    await chat.goto();

    // then
    const input = (await chat.input.boundingBox())!;
    const send = (await chat.send.boundingBox())!;
    expect(input.width, 'input width at 360 px').toBeGreaterThanOrEqual(240);
    expect(send.y, 'Send sits below the input').toBeGreaterThanOrEqual(input.y + input.height);
  });
});
