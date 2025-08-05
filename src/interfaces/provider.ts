export interface TextGenerationOptions {
  model: string;
  prompt: string;
  maxTokens?: number;
  stream?: boolean;
  systemPrompt?: string;
}

export interface TextGenerationResponse {
  text: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

// Chat completion interfaces
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;      // For tool response messages
  toolCalls?: ToolCall[];   // For assistant messages requesting tool use
}

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ChatCompletionOptions extends Omit<TextGenerationOptions, 'prompt'> {
  prompt?: string;         // Optional - use either prompt or messages
  messages?: Message[];    // Use messages for chat mode (overrides prompt)
  tools?: Tool[];         // Available tools for the model to use
}

export interface ChatCompletionResponse extends TextGenerationResponse {
  toolCalls?: ToolCall[];   // Tool calls requested by the model
}

export interface LLMProvider {
  generateText(options: TextGenerationOptions): Promise<TextGenerationResponse>;
  generateChatCompletion?(options: ChatCompletionOptions): Promise<ChatCompletionResponse>;
}