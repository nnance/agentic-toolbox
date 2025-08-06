import type { Message as OllamaMessage } from "ollama";
import { Ollama } from "ollama";
import type {
	LLMProvider,
	TextGenerationOptions,
	TextGenerationResponse,
} from "../interfaces/provider";
import type {
	ChatCompletionOptions,
	ChatCompletionResponse,
	Message,
} from "../interfaces/context";
import type { ToolCall } from "../interfaces/tools";

export interface OllamaConfig {
	host?: string;
}

export class OllamaProvider implements LLMProvider {
	private client: Ollama;

	constructor(config: OllamaConfig = {}) {
		this.client = new Ollama({
			host: config.host || "http://127.0.0.1:11434",
		});
	}

	async generateText(
		options: TextGenerationOptions,
	): Promise<TextGenerationResponse> {
		const { model, prompt, systemPrompt } = options;

		const response = await this.client.generate({
			model,
			prompt,
			system: systemPrompt,
			stream: false,
		});

		return {
			text: response.response,
			usage: {
				promptTokens: response.prompt_eval_count,
				completionTokens: response.eval_count,
				totalTokens:
					(response.prompt_eval_count || 0) + (response.eval_count || 0),
			},
		};
	}

	async generateChatCompletion(
		options: ChatCompletionOptions,
	): Promise<ChatCompletionResponse> {
		const { model, messages, tools, maxTokens, maxToolCalls } = options;

		// If messages are provided, use them; otherwise convert prompt to messages
		let chatMessages: Message[];
		if (messages && messages.length > 0) {
			chatMessages = messages;
		} else if (options.prompt) {
			chatMessages = [];
			if (options.systemPrompt) {
				chatMessages.push({ role: "system", content: options.systemPrompt });
			}
			chatMessages.push({ role: "user", content: options.prompt });
		} else {
			throw new Error("Either messages or prompt must be provided");
		}

		// Convert our Message format to Ollama's format
		const ollamaMessages = chatMessages.map((msg) => {
			const ollamaMsg: OllamaMessage = {
				role: msg.role,
				content: msg.content,
			};

			// Handle assistant messages with tool calls
			if (msg.role === "assistant" && msg.toolCalls) {
				ollamaMsg.tool_calls = msg.toolCalls.map((tc) => ({
					id: tc.id,
					type: "function",
					function: {
						name: tc.name,
						arguments: tc.arguments,
					},
				}));
			}

			return ollamaMsg;
		});

		// Convert our Tool format to Ollama's OpenAI-compatible format
		const ollamaTools = tools?.map((tool) => ({
			type: "function" as const,
			function: {
				name: tool.name,
				description: tool.description,
				parameters: {
					...tool.parameters,
					properties: tool.parameters.properties
						? Object.fromEntries(
								Object.entries(tool.parameters.properties).map(
									([key, value]) => [
										key,
										typeof value === "object" && value !== null
											? value
											: { type: "string" },
									],
								),
							)
						: {},
				},
			},
		}));

		// Make the chat completion request
		const response = await this.client.chat({
			model,
			messages: ollamaMessages,
			tools: ollamaTools,
			stream: false,
			options: maxTokens ? { num_predict: maxTokens } : undefined,
		});

		// Extract tool calls if present
		let toolCalls: ToolCall[] | undefined;
		if (response.message.tool_calls && response.message.tool_calls.length > 0) {
			toolCalls = response.message.tool_calls.map((tc) => ({
				id: `tool_${Math.random().toString(36).substring(2, 11)}`,
				name: tc.function.name,
				arguments: tc.function.arguments,
			}));
		}

		// Calculate usage statistics
		const usage =
			response.prompt_eval_count || response.eval_count
				? {
						promptTokens: response.prompt_eval_count,
						completionTokens: response.eval_count,
						totalTokens:
							(response.prompt_eval_count || 0) + (response.eval_count || 0),
					}
				: undefined;

		// Add tool call limiting info if applicable
		const result: ChatCompletionResponse = {
			text: response.message.content || "",
			usage,
		};

		if (toolCalls) {
			result.toolCalls = toolCalls;
		}

		// If maxToolCalls was specified and we have tool calls, check the limit
		if (maxToolCalls !== undefined && toolCalls && toolCalls.length > 0) {
			// Note: This is a simple implementation. In a real scenario,
			// you might want to track calls across multiple rounds
			result.toolCallCount = toolCalls.length;
			result.maxToolCallsReached = toolCalls.length >= maxToolCalls;
		}

		return result;
	}
}
