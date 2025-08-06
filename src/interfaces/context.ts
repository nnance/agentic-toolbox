import type {
	LLMProvider,
	TextGenerationOptions,
	TextGenerationResponse,
} from "./provider";
import type { Tool, ToolCall } from "./tools";

// Chat completion interfaces
export interface Message {
	role: "system" | "user" | "assistant" | "tool";
	content: string;
	toolCallId?: string; // For tool response messages
	toolCalls?: ToolCall[]; // For assistant messages requesting tool use
}

export interface ChatCompletionOptions
	extends Omit<TextGenerationOptions, "prompt"> {
	prompt?: string; // Optional - use either prompt or messages
	messages?: Message[]; // Use messages for chat mode (overrides prompt)
	tools?: Tool[]; // Available tools for the model to use
	maxToolCalls?: number; // Maximum number of tool calls allowed (default: 10)
}

export interface ChatCompletionResponse extends TextGenerationResponse {
	toolCalls?: ToolCall[]; // Tool calls requested by the model
	toolCallCount?: number; // Number of tool calls made
	maxToolCallsReached?: boolean; // Indicates if limit was reached
}

export interface LLMProviderWithTools extends LLMProvider {
	generateText(options: ChatCompletionOptions): Promise<ChatCompletionResponse>;
}
