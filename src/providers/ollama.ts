import { Ollama } from 'ollama';
import type { 
  LLMProvider, 
  TextGenerationOptions, 
  TextGenerationResponse,
  ChatCompletionOptions,
  ChatCompletionResponse,
  Message,
  ToolCall
} from '../interfaces/provider';

export interface OllamaConfig {
  host?: string;
}

export class OllamaProvider implements LLMProvider {
  private client: Ollama;

  constructor(config: OllamaConfig = {}) {
    this.client = new Ollama({
      host: config.host || 'http://127.0.0.1:11434'
    });
  }


  async generateText(options: TextGenerationOptions): Promise<TextGenerationResponse> {
    const { model, prompt, systemPrompt } = options;

    const response = await this.client.generate({
      model,
      prompt,
      system: systemPrompt,
      stream: false
    });

    return {
      text: response.response,
      usage: {
        promptTokens: response.prompt_eval_count,
        completionTokens: response.eval_count,
        totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0)
      }
    };
  }

  async generateChatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    const { model, messages, tools, maxTokens } = options;

    // If messages are provided, use them; otherwise convert prompt to messages
    let chatMessages: Message[];
    if (messages && messages.length > 0) {
      chatMessages = messages;
    } else if (options.prompt) {
      chatMessages = [];
      if (options.systemPrompt) {
        chatMessages.push({ role: 'system', content: options.systemPrompt });
      }
      chatMessages.push({ role: 'user', content: options.prompt });
    } else {
      throw new Error('Either messages or prompt must be provided');
    }

    // Convert our Message format to Ollama's format
    const ollamaMessages = chatMessages.map(msg => {
      const ollamaMsg: any = {
        role: msg.role,
        content: msg.content
      };

      // Handle tool responses
      if (msg.role === 'tool' && msg.toolCallId) {
        ollamaMsg.tool_call_id = msg.toolCallId;
      }

      // Handle assistant messages with tool calls
      if (msg.role === 'assistant' && msg.toolCalls) {
        ollamaMsg.tool_calls = msg.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: tc.arguments
          }
        }));
      }

      return ollamaMsg;
    });

    // Convert our Tool format to Ollama's OpenAI-compatible format
    const ollamaTools = tools?.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }));

    // Make the chat completion request
    const response = await this.client.chat({
      model,
      messages: ollamaMessages,
      tools: ollamaTools,
      stream: false,
      options: maxTokens ? { num_predict: maxTokens } : undefined
    });

    // Extract tool calls if present
    let toolCalls: ToolCall[] | undefined;
    if (response.message.tool_calls && response.message.tool_calls.length > 0) {
      toolCalls = response.message.tool_calls.map((tc: any) => ({
        id: tc.id || `tool_${Math.random().toString(36).substring(2, 11)}`,
        name: tc.function.name,
        arguments: tc.function.arguments
      }));
    }

    // Calculate usage statistics
    const usage = response.prompt_eval_count || response.eval_count ? {
      promptTokens: response.prompt_eval_count,
      completionTokens: response.eval_count,
      totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0)
    } : undefined;

    return {
      text: response.message.content || '',
      toolCalls,
      usage
    };
  }
}