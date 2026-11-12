import type { Page } from '@playwright/test';

export interface ChatUnlock {
  /** Tool results in the transcript when the input became enabled again. */
  toolMessages: number;
  /** Assistant answers with text in the transcript at that moment. */
  assistantAnswers: number;
}

/**
 * Records, in the page, every moment the chat input turns from disabled to enabled together with
 * what the transcript held then. Reading it after the stream shows whether the input unlocked
 * before the conversation turn was complete. Call before the page loads.
 */
export async function watchChatInputUnlocks(page: Page): Promise<() => Promise<ChatUnlock[]>> {
  await page.addInitScript(() => {
    const unlocks: { toolMessages: number; assistantAnswers: number }[] = [];
    (window as unknown as { __chatUnlocks: typeof unlocks }).__chatUnlocks = unlocks;
    let wasDisabled = false;
    new MutationObserver(() => {
      const input = document.querySelector<HTMLTextAreaElement>('[data-testid="chat-input"]');
      if (!input) return;
      if (wasDisabled && !input.disabled) {
        unlocks.push({
          toolMessages: document.querySelectorAll('[data-testid="tool-message"]').length,
          assistantAnswers: document.querySelectorAll('[data-testid="chat-message-content-assistant"]').length,
        });
      }
      wasDisabled = input.disabled;
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['disabled'] });
  });
  return () => page.evaluate(() => (window as unknown as { __chatUnlocks: ChatUnlock[] }).__chatUnlocks);
}
