import { ApiClient } from './api-client';
import type { ChatMessageDto } from '@models/commerce-fixes';

export const OLLAMA_ENDPOINT = '/api/v1/ollama';
export const LLM_MODEL = 'qwen3.5:2b';

// Ollama chat with backend tool calling, and the per-user system prompts.
export class LlmClient extends ApiClient {
  toolDefinitions() {
    return this.get(`${OLLAMA_ENDPOINT}/chat/tools/definitions`);
  }

  chatWithTools(messages: ChatMessageDto[], tools: unknown[]) {
    return this.post(`${OLLAMA_ENDPOINT}/chat/tools`, { model: LLM_MODEL, messages, tools, stream: true },
      { Accept: 'text/event-stream' });
  }

  putChatSystemPrompt(chatSystemPrompt: string | null | undefined) {
    return this.put('/api/v1/users/chat-system-prompt', chatSystemPrompt === undefined ? {} : { chatSystemPrompt });
  }

  getChatSystemPrompt() {
    return this.get('/api/v1/users/chat-system-prompt');
  }

  putToolSystemPrompt(toolSystemPrompt: string | null | undefined) {
    return this.put('/api/v1/users/tool-system-prompt', toolSystemPrompt === undefined ? {} : { toolSystemPrompt });
  }

  getToolSystemPrompt() {
    return this.get('/api/v1/users/tool-system-prompt');
  }
}

/** Parses an SSE body into its JSON data events (an event's data may span several data: lines). */
export function sseEvents<T>(body: string): T[] {
  return body.split(/\r?\n\r?\n/)
    .map(event => event.split(/\r?\n/)
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice('data:'.length).replace(/^ /, ''))
      .join('\n'))
    .filter(data => data.trim().length > 0)
    .map(data => JSON.parse(data) as T);
}
