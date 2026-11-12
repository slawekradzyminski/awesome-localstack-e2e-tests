// Response shapes used by the order, QR, LLM, GraphQL and search regression tests.

/** A cart line as GET /api/v1/cart returns it; the price fields appear only after a price change. */
export interface CartLineDto {
  productId: number;
  quantity: number;
  priceChanged?: true;
  unitPrice?: number;
  currentPrice?: number;
}

export interface CartWithLinesDto {
  username: string;
  items: CartLineDto[];
  totalPrice: number;
  totalItems: number;
}

export interface ChatSystemPromptDto {
  chatSystemPrompt: string | null;
}

export interface ToolSystemPromptDto {
  toolSystemPrompt: string | null;
}

export interface ChatMessageDto {
  role: string;
  content?: string;
  thinking?: string;
  tool_calls?: unknown[];
  tool_name?: string;
}

/** One SSE data event of the Ollama chat endpoints. */
export interface ChatResponseDto {
  model: string | null;
  created_at: string | null;
  message: ChatMessageDto | null;
  done: boolean;
}

export interface GraphQlResponse<T> {
  data?: T;
  errors?: { message: string; extensions?: { code?: string } }[];
}

export interface UserResponseDto {
  id: number;
  username: string;
  email: string;
  roles: string[];
  firstName: string | null;
  lastName: string | null;
}
