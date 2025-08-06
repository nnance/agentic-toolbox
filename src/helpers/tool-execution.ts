import type {
	ChatCompletionOptions,
	ChatCompletionResponse,
	LLMProviderWithTools,
	Message,
} from "../interfaces/context";
import type { Tool, ToolCall } from "../interfaces/tools";
import { ToolLoopHandler } from "../utils/tool-loop";

export interface ToolExecutionOptions extends ChatCompletionOptions {
	onToolCall: (toolCall: ToolCall) => Promise<unknown>;
}

export interface ToolExecutionResult {
	finalResponse: string;
	messages: Message[];
	toolCallCount: number;
	maxToolCallsReached: boolean;
	usage?: {
		promptTokens?: number;
		completionTokens?: number;
		totalTokens?: number;
	};
}

/**
 * Execute a complete tool loop, handling all tool calls automatically
 */
export async function executeToolLoop(
	provider: LLMProviderWithTools,
	options: ToolExecutionOptions,
): Promise<ToolExecutionResult> {
	const handler = new ToolLoopHandler(options.maxToolCalls);
	const result = await handler.executeWithTools(provider, options);

	return {
		finalResponse: result.finalResponse.text,
		messages: result.messages,
		toolCallCount: result.toolCallCount,
		maxToolCallsReached: result.maxToolCallsReached,
		usage: result.finalResponse.usage,
	};
}

/**
 * Create a properly formatted tool response message
 */
export function createToolResponse(
	toolCallId: string,
	result: unknown,
	isError: boolean = false,
): Message {
	const content = isError
		? JSON.stringify({ error: String(result) })
		: JSON.stringify(result);

	return {
		role: "tool",
		content,
		toolCallId,
	};
}

/**
 * Execute a single tool call and return a formatted response
 */
export async function executeSingleTool(
	toolCall: ToolCall,
	toolHandlers: Record<string, (args: any) => Promise<any>>,
): Promise<Message> {
	try {
		const handler = toolHandlers[toolCall.name];
		if (!handler) {
			throw new Error(`No handler found for tool: ${toolCall.name}`);
		}

		const result = await handler(toolCall.arguments);
		return createToolResponse(toolCall.id, result);
	} catch (error) {
		return createToolResponse(toolCall.id, error, true);
	}
}

/**
 * Process multiple tool calls in parallel
 */
export async function executeToolsInParallel(
	toolCalls: ToolCall[],
	toolHandlers: Record<string, (args: any) => Promise<any>>,
): Promise<Message[]> {
	const promises = toolCalls.map((toolCall) =>
		executeSingleTool(toolCall, toolHandlers),
	);

	return Promise.all(promises);
}

/**
 * Simple helper to check if a response contains tool calls
 */
export function hasToolCalls(response: ChatCompletionResponse): boolean {
	return !!(response.toolCalls && response.toolCalls.length > 0);
}

/**
 * Extract tool definitions from a tools array into a handler map
 */
export function createToolHandlerMap(
	tools: Tool[],
	implementations: Record<string, (args: any) => Promise<any>>,
): Record<string, (args: any) => Promise<any>> {
	const handlers: Record<string, (args: any) => Promise<any>> = {};

	for (const tool of tools) {
		if (implementations[tool.name]) {
			handlers[tool.name] = implementations[tool.name];
		}
	}

	return handlers;
}

/**
 * Create a message indicating that the tool call limit has been reached
 */
export function createLimitReachedMessage(
	toolCallCount: number,
	maxToolCalls: number,
): Message {
	return {
		role: "system",
		content: `Tool call limit reached. Made ${toolCallCount} out of ${maxToolCalls} allowed calls.`,
	};
}
