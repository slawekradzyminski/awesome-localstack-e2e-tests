import type { Locator, Page } from '@playwright/test';
import { BasePage } from '@pages/base.page';

/** /llm/chat and /llm/tools: the conversation, its settings panel and the message input. */
export class LlmChatPage extends BasePage {
  readonly input: Locator;
  readonly send: Locator;
  readonly conversation: Locator;
  readonly assistantAnswers: Locator;
  readonly toolCallNotices: Locator;
  readonly settingsToggle: Locator;
  readonly settings: Locator;

  constructor(page: Page, private readonly mode: 'chat' | 'tools') {
    super(page);
    this.input = page.getByTestId('chat-input');
    this.send = page.getByTestId('chat-send-button');
    this.conversation = page.getByTestId('chat-conversation');
    this.assistantAnswers = page.getByTestId('chat-message-content-assistant');
    this.toolCallNotices = page.getByTestId('tool-call-notice');
    this.settingsToggle = page.getByTestId(mode === 'chat' ? 'chat-sidebar-toggle' : 'tool-sidebar-toggle');
    this.settings = page.getByTestId(mode === 'chat' ? 'chat-sidebar' : 'tool-sidebar');
  }

  async goto(): Promise<void> {
    await this.page.goto(`/llm/${this.mode}`);
    await this.input.waitFor();
  }

  async ask(question: string): Promise<void> {
    await this.input.fill(question);
    await this.send.click();
  }

  rolePill(role: 'user' | 'assistant'): Locator {
    return this.page.getByTestId(`chat-role-pill-${role}`);
  }

  roleLabel(role: 'user' | 'assistant'): Locator {
    return this.page.getByTestId(`chat-message-role-${role}`);
  }
}
