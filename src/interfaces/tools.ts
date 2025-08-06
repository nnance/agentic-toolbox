export interface Tool {
	name: string;
	description: string;
	parameters: {
		type: "object";
		properties: Record<string, unknown>;
		required?: string[];
	};
}

export interface ToolCall {
	id: string;
	name: string;
	arguments: Record<string, unknown>;
}
