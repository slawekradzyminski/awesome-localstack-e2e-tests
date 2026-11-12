import { test, expect } from '@fixtures';
import { LlmChatPage } from '@pages/llm/llm-chat.page';
import { watchChatInputUnlocks } from '@support/chat-input-watch';
import { expectContainedIn, expectNoHorizontalPageOverflow, PHONE } from '@support/layout';

const BEAUTY_QUESTION = 'What Beauty products do we have available?';

test.describe('tool chat', { tag: ['@llm'] }, () => {
  test('the input stays locked until the whole tool conversation has finished (T-041)', async ({ shopperPage }) => {
    // given
    const unlocks = await watchChatInputUnlocks(shopperPage);
    const tools = new LlmChatPage(shopperPage, 'tools');
    await tools.goto();

    // when
    await tools.ask(BEAUTY_QUESTION);

    // then
    await expect(tools.input).toBeDisabled();
    await expect(tools.toolCallNotices.first()).toBeVisible();
    await expect(tools.input).toBeEnabled({ timeout: 30_000 });
    const finalToolMessages = await shopperPage.getByTestId('tool-message').count();
    const finalAnswers = await tools.assistantAnswers.count();
    expect(finalAnswers).toBeGreaterThan(0);
    expect(await unlocks()).toEqual([{ toolMessages: finalToolMessages, assistantAnswers: finalAnswers }]);
  });

  test('tool-call arguments wrap inside their bubble on a phone (T-045)', async ({ shopperPage }) => {
    // given
    await shopperPage.setViewportSize(PHONE);
    const tools = new LlmChatPage(shopperPage, 'tools');
    await tools.goto();

    // when
    await tools.ask(BEAUTY_QUESTION);

    // then
    await expect(tools.input).toBeEnabled({ timeout: 30_000 });
    const notice = tools.toolCallNotices.first();
    await expectContainedIn(notice.locator('code').first(), notice);
    await expectNoHorizontalPageOverflow(notice);
  });
});
