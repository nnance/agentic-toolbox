import type {
	ChatResponse,
	Message as OllamaMessage,
	Tool as OllamaTool,
} from "ollama";
import { Ollama } from "ollama";
import type {
	TextGenerationOptions,
	TextGenerationResponse,
} from "../interfaces/provider";
import type {
	ChatCompletionOptions,
	ChatCompletionResponse,
	LLMProviderWithTools,
	Message,
} from "../interfaces/context";
import type { Tool, ToolCall } from "../interfaces/tools";

export interface OllamaConfig {
	host?: string;
}

export function normalizeChatMessages(
	options: ChatCompletionOptions,
	messages?: Message[],
): Message[] {
	if (messages && messages.length > 0) {
		return messages;
	} else if (options.prompt) {
		const chatMessages: Message[] = [];
		if (options.systemPrompt) {
			chatMessages.push({ role: "system", content: options.systemPrompt });
		}
		chatMessages.push({ role: "user", content: options.prompt });
		return chatMessages;
	} else {
		throw new Error("Either messages or prompt must be provided");
	}
}

export function chatMessagesToOllama(messages: Message[]): OllamaMessage[] {
	return messages.map((msg) => {
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
}

export function toolsToOllama(tools: Tool[]): OllamaTool[] {
	return tools?.map((tool) => ({
		type: "function" as const,
		function: {
			name: tool.name,
			description: tool.description,
			parameters: {
				...tool.parameters,
				properties: tool.parameters.properties
					? Object.fromEntries(
							Object.entries(tool.parameters.properties).map(([key, value]) => [
								key,
								typeof value === "object" && value !== null
									? value
									: { type: "string" },
							]),
						)
					: {},
			},
		},
	}));
}

export function extractToolCallsFromOllama(
	response: ChatResponse,
): ToolCall[] | undefined {
	if (response.message.tool_calls && response.message.tool_calls.length > 0) {
		return response.message.tool_calls.map((tc) => ({
			id: `tool_${Math.random().toString(36).substring(2, 11)}`,
			name: tc.function.name,
			arguments: tc.function.arguments,
		}));
	}
	return undefined;
}

export function calculateUsage(response: ChatResponse): {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
} {
	return {
		promptTokens: response.prompt_eval_count || 0,
		completionTokens: response.eval_count || 0,
		totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
	};
}

export class OllamaProvider implements LLMProviderWithTools {
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
		const chatMessages = normalizeChatMessages(options, messages);

		// Convert our Message format to Ollama's format
		const ollamaMessages = chatMessagesToOllama(chatMessages);

		// Convert our Tool format to Ollama's OpenAI-compatible format
		const ollamaTools = toolsToOllama(tools || []);

		// Make the chat completion request
		const response = await this.client.chat({
			model,
			messages: ollamaMessages,
			tools: ollamaTools,
			stream: false,
			options: maxTokens ? { num_predict: maxTokens } : undefined,
		});

		// Extract tool calls if present
		const toolCalls = extractToolCallsFromOllama(response);

		// Calculate usage statistics
		const usage = calculateUsage(response);

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
