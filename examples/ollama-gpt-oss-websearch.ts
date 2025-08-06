import { OllamaProvider } from "../src/sdk";

async function testGPTOSSBuiltInTool() {
	console.log("Testing GPT-OSS Built-in Tool with Chat Completion API...\n");

	const ollama = new OllamaProvider();

	// Test prompts
	const prompts = [
		"What is the weather in Toronto?",
		"How hot is it in New York in Fahrenheit?",
	];

	for (const prompt of prompts) {
		console.log(`\n📝 User: ${prompt}`);

		try {
			console.log("🤖 Analyzing request...");

			const result = await ollama.generateChatCompletion({
				model: "gpt-oss",
				messages: [{ role: "user", content: prompt }],
			});

			console.log("\n💬 Assistant:", result.text);
		} catch (error) {
			console.error("\n❌ Error:", error);
		}
	}

	console.log(
		"\n\n📌 Note: Make sure you have a model that supports tool calling installed (e.g., qwen3:30b, llama3.1)",
	);
	console.log("   You can install it with: ollama pull qwen3:30b");
}

// Run the test
testGPTOSSBuiltInTool().catch(console.error);
