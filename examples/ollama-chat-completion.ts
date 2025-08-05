import { OllamaProvider } from "../src/providers/ollama";
import type { Tool, Message } from "../src/interfaces/provider";

// Define a calculator tool
const calculatorTool: Tool = {
	name: "calculate",
	description: "Perform mathematical calculations",
	parameters: {
		type: "object",
		properties: {
			expression: {
				type: "string",
				description: "Mathematical expression to evaluate",
			},
			operation: {
				type: "string",
				enum: ["add", "subtract", "multiply", "divide"],
				description: "Type of operation",
			},
			numbers: {
				type: "array",
				items: { type: "number" },
				description: "Numbers to perform the operation on",
			},
		},
		required: ["operation", "numbers"],
	},
};

// Mock calculator function
function calculate(args: { operation: string; numbers: number[] }): number {
	const { operation, numbers } = args;

	if (!numbers || numbers.length < 2) {
		throw new Error("At least two numbers required");
	}

	switch (operation) {
		case "add":
			return numbers.reduce((a: number, b: number) => a + b, 0);
		case "subtract":
			return numbers.reduce((a: number, b: number) => a - b);
		case "multiply":
			return numbers.reduce((a: number, b: number) => a * b, 1);
		case "divide":
			if (numbers.includes(0) && numbers.indexOf(0) > 0) {
				throw new Error("Division by zero");
			}
			return numbers.reduce((a: number, b: number) => a / b);
		default:
			throw new Error(`Unknown operation: ${operation}`);
	}
}

async function demonstrateChatCompletion() {
	console.log("🤖 Ollama Chat Completion API Demo\n");

	const ollama = new OllamaProvider();

	// Example 1: Simple chat completion
	console.log("📝 Example 1: Simple Chat Completion");
	console.log("=====================================\n");

	try {
		const response1 = await ollama.generateChatCompletion({
			model: "qwen3:30b",
			messages: [
				{ role: "system", content: "You are a helpful math tutor." },
				{
					role: "user",
					content: "Explain what prime numbers are in simple terms.",
				},
			],
		});

		console.log("Assistant:", response1.text);
		console.log(`\nTokens used: ${response1.usage?.totalTokens || "N/A"}\n`);
	} catch (error) {
		console.error("Error:", error);
	}

	// Example 2: Multi-turn conversation
	console.log("\n📝 Example 2: Multi-turn Conversation");
	console.log("=====================================\n");

	try {
		const messages: Message[] = [
			{ role: "system", content: "You are a helpful assistant." },
			{ role: "user", content: "What is the capital of France?" },
		];

		const response2a = await ollama.generateChatCompletion({
			model: "qwen3:30b",
			messages,
		});

		console.log("User: What is the capital of France?");
		console.log("Assistant:", response2a.text);

		// Continue the conversation
		messages.push({ role: "assistant", content: response2a.text });
		messages.push({ role: "user", content: "What is its population?" });

		const response2b = await ollama.generateChatCompletion({
			model: "qwen3:30b",
			messages,
		});

		console.log("\nUser: What is its population?");
		console.log("Assistant:", response2b.text);
	} catch (error) {
		console.error("Error:", error);
	}

	// Example 3: Tool calling
	console.log("\n\n📝 Example 3: Tool Calling");
	console.log("=====================================\n");

	try {
		const prompt = "What is 25 multiplied by 4, and then add 15 to the result?";
		console.log("User:", prompt);

		// First request with tools
		const response3a = await ollama.generateChatCompletion({
			model: "qwen3:30b",
			messages: [{ role: "user", content: prompt }],
			tools: [calculatorTool],
		});

		console.log("\nAssistant is thinking...");

		if (response3a.toolCalls && response3a.toolCalls.length > 0) {
			const messages: Message[] = [
				{ role: "user", content: prompt },
				{
					role: "assistant",
					content: response3a.text,
					toolCalls: response3a.toolCalls,
				},
			];

			// Process each tool call
			for (const toolCall of response3a.toolCalls) {
				console.log(`\n🔧 Calling tool: ${toolCall.name}`);
				console.log(`   Arguments:`, toolCall.arguments);

				try {
					const result = calculate(
						toolCall.arguments as { operation: string; numbers: number[] },
					);
					console.log(`   Result: ${result}`);

					// Add tool response to messages
					messages.push({
						role: "tool",
						content: JSON.stringify({ result }),
						toolCallId: toolCall.id,
					});
				} catch (error) {
					console.error(`   Error: ${error}`);
					messages.push({
						role: "tool",
						content: JSON.stringify({ error: String(error) }),
						toolCallId: toolCall.id,
					});
				}
			}

			// Get final response
			const response3b = await ollama.generateChatCompletion({
				model: "qwen3:30b",
				messages,
			});

			console.log("\nAssistant:", response3b.text);
		} else {
			console.log("Assistant:", response3a.text);
		}
	} catch (error) {
		console.error("Error:", error);
	}

	// Example 4: Using the prompt shorthand
	console.log("\n\n📝 Example 4: Prompt Shorthand (Backward Compatible)");
	console.log("====================================================\n");

	try {
		const response4 = await ollama.generateChatCompletion({
			model: "qwen3:30b",
			prompt: "Write a haiku about programming",
			systemPrompt: "You are a creative poet who loves technology.",
		});

		console.log("Haiku:", response4.text);
	} catch (error) {
		console.error("Error:", error);
	}

	console.log("\n\n✅ Demo completed!");
	console.log(
		"\n📌 Note: Make sure you have a model that supports tool calling installed",
	);
	console.log(
		"   (e.g., qwen3:30b, llama3.1). You can install it with: ollama pull qwen3:30b",
	);
}

// Run the demonstration
demonstrateChatCompletion().catch(console.error);
