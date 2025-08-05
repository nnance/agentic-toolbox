import { Ollama } from 'ollama';
import type { LLMProvider, TextGenerationOptions, TextGenerationResponse } from '../interfaces/provider';

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

  /**
   * Get the underlying Ollama client instance for advanced usage
   * such as tool calling or other Ollama-specific features
   */
  getClient(): Ollama {
    return this.client;
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
}