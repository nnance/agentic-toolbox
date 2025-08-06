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

export interface LLMProvider {
	generateText(options: TextGenerationOptions): Promise<TextGenerationResponse>;
}
