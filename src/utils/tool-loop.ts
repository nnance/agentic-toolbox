import type {
	ChatCompletionOptions,
	ChatCompletionResponse,
	LLMProviderWithTools,
	Message,
} from "../interfaces/context";
import type { ToolCall } from "../interfaces/tools";

export interface ToolLoopOptions extends ChatCompletionOptions {
	onToolCall?: (toolCall: ToolCall) => Promise<unknown>;
}

export interface ToolLoopResult {
	finalResponse: ChatCompletionResponse;
	toolCallCount: number;
	maxToolCallsReached: boolean;
	messages: Message[];
}

export class ToolLoopHandler {
	private toolCallCount: number = 0;
	private maxToolCalls: number;
	private messages: Message[] = [];

	constructor(maxToolCalls: number = 10) {
		this.maxToolCalls = maxToolCalls;
	}

	/**
	 * Check if more tool calls are allowed
	 */
	shouldContinue(): boolean {
		return this.toolCallCount < this.maxToolCalls;
	}

	/**
	 * Increment the tool call counter
	 */
	incrementCount(count: number = 1): void {
		this.toolCallCount += count;
	}

	/**
	 * Get the current tool call count
	 */
	getCount(): number {
		return this.toolCallCount;
	}

	/**
	 * Check if the maximum number of tool calls has been reached
	 */
	isLimitReached(): boolean {
		return this.toolCallCount >= this.maxToolCalls;
	}

	/**
	 * Execute a chat completion with automatic tool loop handling
	 */
	async executeWithTools(
		provider: LLMProviderWithTools,
		options: ToolLoopOptions,
	): Promise<ToolLoopResult> {
		if (!provider.generateText) {
			throw new Error("Provider does not support chat completions");
		}

		// Initialize messages
		this.messages = options.messages ? [...options.messages] : [];

		// If using prompt instead of messages, convert to messages
		if (!this.messages.length && options.prompt) {
			if (options.systemPrompt) {
				this.messages.push({ role: "system", content: options.systemPrompt });
			}
			this.messages.push({ role: "user", content: options.prompt });
		}

		let currentResponse: ChatCompletionResponse;
		let continueLoop = true;

		while (continueLoop) {
			// Check if we've reached the limit before making a call
			if (!this.shouldContinue()) {
				// Return the last response with limit reached flag
				const lastResponse = currentResponse!;
				return {
					finalResponse: {
						...lastResponse,
						toolCallCount: this.toolCallCount,
						maxToolCallsReached: true,
					},
					toolCallCount: this.toolCallCount,
					maxToolCallsReached: true,
					messages: this.messages,
				};
			}

			// Make the chat completion request
			currentResponse = await provider.generateText({
				...options,
				messages: this.messages,
				maxToolCalls: this.maxToolCalls - this.toolCallCount, // Pass remaining calls
			});

			// Add assistant response to messages
			const assistantMessage: Message = {
				role: "assistant",
				content: currentResponse.text,
			};

			if (currentResponse.toolCalls && currentResponse.toolCalls.length > 0) {
				assistantMessage.toolCalls = currentResponse.toolCalls;
				this.messages.push(assistantMessage);

				// Process tool calls if handler provided
				if (options.onToolCall) {
					for (const toolCall of currentResponse.toolCalls) {
						// Check limit before each tool call
						if (!this.shouldContinue()) {
							return {
								finalResponse: {
									...currentResponse,
									toolCallCount: this.toolCallCount,
									maxToolCallsReached: true,
								},
								toolCallCount: this.toolCallCount,
								maxToolCallsReached: true,
								messages: this.messages,
							};
						}

						this.incrementCount();

						try {
							const result = await options.onToolCall(toolCall);
							this.messages.push({
								role: "tool",
								content: JSON.stringify(result),
								toolCallId: toolCall.id,
							});
						} catch (error) {
							this.messages.push({
								role: "tool",
								content: JSON.stringify({ error: String(error) }),
								toolCallId: toolCall.id,
							});
						}
					}
				} else {
					// No handler provided, just count the calls and stop
					this.incrementCount(currentResponse.toolCalls.length);
					continueLoop = false;
				}
			} else {
				// No tool calls in response, we're done
				this.messages.push(assistantMessage);
				continueLoop = false;
			}
		}

		return {
			finalResponse: {
				...currentResponse!,
				toolCallCount: this.toolCallCount,
				maxToolCallsReached: this.isLimitReached(),
			},
			toolCallCount: this.toolCallCount,
			maxToolCallsReached: this.isLimitReached(),
			messages: this.messages,
		};
	}
}

/**
 * Execute a tool loop with automatic handling
 */
export async function executeToolLoop(
	provider: LLMProviderWithTools,
	options: ToolLoopOptions,
): Promise<ToolLoopResult> {
	const handler = new ToolLoopHandler(options.maxToolCalls);
	return handler.executeWithTools(provider, options);
}
