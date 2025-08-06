import { OllamaProvider } from "../src/providers/ollama";
import type { Tool } from "../src/interfaces/tools";
import { executeToolLoop } from "../src/helpers/tool-execution";

// Define multiple tools to demonstrate limit handling
const mathTool: Tool = {
	name: "math",
	description: "Perform basic math operations",
	parameters: {
		type: "object",
		properties: {
			operation: {
				type: "string",
				enum: ["add", "subtract", "multiply", "divide"],
			},
			a: { type: "number", description: "First number" },
			b: { type: "number", description: "Second number" },
		},
		required: ["operation", "a", "b"],
	},
};

const memoryTool: Tool = {
	name: "memory",
	description: "Store or retrieve values from memory",
	parameters: {
		type: "object",
		properties: {
			action: {
				type: "string",
				enum: ["store", "retrieve"],
			},
			key: { type: "string", description: "Memory key" },
			value: {
				type: "number",
				description: "Value to store (only for store action)",
			},
		},
		required: ["action", "key"],
	},
};

// Simple memory storage
const memory: Record<string, number> = {};

// Tool implementations
async function executeMath(args: {
	operation: string;
	a: number;
	b: number;
}): Promise<number> {
	const { operation, a, b } = args;
	switch (operation) {
		case "add":
			return a + b;
		case "subtract":
			return a - b;
		case "multiply":
			return a * b;
		case "divide":
			if (b === 0) throw new Error("Division by zero");
			return a / b;
		default:
			throw new Error(`Unknown operation: ${operation}`);
	}
}

async function executeMemory(args: {
	action: string;
	key: string;
	value?: number;
}): Promise<unknown> {
	const { action, key, value } = args;
	switch (action) {
		case "store":
			if (value === undefined)
				throw new Error("Value required for store action");
			memory[key] = value;
			return { stored: true, key, value };
		case "retrieve":
			if (key in memory) {
				return { found: true, key, value: memory[key] };
			}
			return { found: false, key };
		default:
			throw new Error(`Unknown action: ${action}`);
	}
}

async function demonstrateToolLimits() {
	console.log("🚀 Tool Loop with Limits Demonstration\n");

	const ollama = new OllamaProvider();

	// Example 1: Normal operation within limits
	console.log("📝 Example 1: Complex Calculation Within Limits");
	console.log("==============================================\n");

	try {
		const prompt1 =
			"Calculate (10 + 5) * 3 - 8 / 2 step by step, showing each operation";
		console.log("User:", prompt1);
		console.log("Max tool calls: 10 (default)\n");

		const result1 = await executeToolLoop(ollama, {
			model: "qwen3:30b",
			messages: [{ role: "user", content: prompt1 }],
			tools: [mathTool],
			onToolCall: async (toolCall) => {
				console.log(`🔧 Tool: ${toolCall.name}`);
				console.log(`   Args:`, toolCall.arguments);

				if (toolCall.name === "math") {
					const result = await executeMath(toolCall.arguments as any);
					console.log(`   Result: ${result}`);
					return { result };
				}
				throw new Error(`Unknown tool: ${toolCall.name}`);
			},
		});

		console.log("\nFinal Response:", result1.finalResponse);
		console.log(`Tool calls made: ${result1.toolCallCount}`);
		console.log(
			`Limit reached: ${result1.maxToolCallsReached ? "Yes" : "No"}\n`,
		);
	} catch (error) {
		console.error("Error:", error);
	}

	// Example 2: Hitting the tool call limit
	console.log("\n📝 Example 2: Reaching Tool Call Limit");
	console.log("======================================\n");

	try {
		const prompt2 =
			"Store the numbers 1 through 10 in memory with keys 'num1' through 'num10', then calculate their sum";
		console.log("User:", prompt2);
		console.log("Max tool calls: 3 (very restrictive)\n");

		const result2 = await executeToolLoop(ollama, {
			model: "qwen3:30b",
			messages: [{ role: "user", content: prompt2 }],
			tools: [mathTool, memoryTool],
			maxToolCalls: 3, // Very restrictive limit
			onToolCall: async (toolCall) => {
				console.log(`🔧 Tool: ${toolCall.name}`);
				console.log(`   Args:`, toolCall.arguments);

				switch (toolCall.name) {
					case "math": {
						const mathResult = await executeMath(toolCall.arguments as any);
						console.log(`   Result: ${mathResult}`);
						return { result: mathResult };
					}
					case "memory": {
						const memResult = await executeMemory(toolCall.arguments as any);
						console.log(`   Result:`, memResult);
						return memResult;
					}
					default:
						throw new Error(`Unknown tool: ${toolCall.name}`);
				}
			},
		});

		console.log("\nFinal Response:", result2.finalResponse);
		console.log(`Tool calls made: ${result2.toolCallCount}`);
		console.log(
			`⚠️  Limit reached: ${result2.maxToolCallsReached ? "Yes - Task incomplete!" : "No"}\n`,
		);
	} catch (error) {
		console.error("Error:", error);
	}

	// Example 3: Zero tool calls allowed
	console.log("\n📝 Example 3: Zero Tool Calls Allowed");
	console.log("=====================================\n");

	try {
		const prompt3 = "What is 5 + 3?";
		console.log("User:", prompt3);
		console.log(
			"Max tool calls: 0 (tools defined but not allowed to be used)\n",
		);

		const result3 = await executeToolLoop(ollama, {
			model: "qwen3:30b",
			messages: [{ role: "user", content: prompt3 }],
			tools: [mathTool],
			maxToolCalls: 0, // No tool calls allowed
			onToolCall: async (toolCall) => {
				// This should never be called
				console.log("❌ This should not be called!");
				return { error: "Tool calls not allowed" };
			},
		});

		console.log("Final Response:", result3.finalResponse);
		console.log(`Tool calls made: ${result3.toolCallCount}`);
		console.log(
			`Limit reached: ${result3.maxToolCallsReached ? "Yes" : "No"}\n`,
		);
	} catch (error) {
		console.error("Error:", error);
	}

	// Example 4: Different limits for different scenarios
	console.log("\n📝 Example 4: Adaptive Limit Based on Task Complexity");
	console.log("====================================================\n");

	const complexityPrompts = [
		{ prompt: "Add 2 + 2", expectedCalls: 1, limit: 2 },
		{ prompt: "Calculate (5 * 3) + (10 / 2)", expectedCalls: 3, limit: 5 },
		{
			prompt: "Store 'x' as 10, 'y' as 20, then calculate x + y",
			expectedCalls: 3,
			limit: 10,
		},
	];

	for (const scenario of complexityPrompts) {
		console.log(`\nTask: "${scenario.prompt}"`);
		console.log(`Limit: ${scenario.limit} calls`);

		try {
			const result = await executeToolLoop(ollama, {
				model: "qwen3:30b",
				messages: [{ role: "user", content: scenario.prompt }],
				tools: [mathTool, memoryTool],
				maxToolCalls: scenario.limit,
				onToolCall: async (toolCall) => {
					console.log(
						`  → ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`,
					);

					switch (toolCall.name) {
						case "math":
							return { result: await executeMath(toolCall.arguments as any) };
						case "memory":
							return await executeMemory(toolCall.arguments as any);
						default:
							throw new Error(`Unknown tool: ${toolCall.name}`);
					}
				},
			});

			console.log(
				`  Result: ${result.toolCallCount} calls made${result.maxToolCallsReached ? " (limit reached!)" : ""}`,
			);
		} catch (error) {
			console.error(`  Error: ${error}`);
		}
	}

	console.log("\n\n✅ Demonstration completed!");
	console.log("\n📌 Key Takeaways:");
	console.log("   - Tool call limits prevent infinite loops");
	console.log("   - Default limit is 10 calls");
	console.log("   - Limit can be customized per request");
	console.log("   - When limit is reached, partial results are returned");
	console.log("   - Setting limit to 0 prevents all tool usage");
}

// Run the demonstration
demonstrateToolLimits().catch(console.error);
