import { OllamaProvider } from "../src/sdk";
import { z } from "zod";
import type { Message, Tool } from "../src/sdk";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config({ quiet: true });

// Define Zod schemas for weather tool
const WeatherFormatSchema = z.enum(["celsius", "fahrenheit"]);

const WeatherToolParametersSchema = z.object({
	location: z.string().describe("The location to get the weather for"),
	format: WeatherFormatSchema.describe("Temperature format").default("celsius"),
});

const WeatherDataSchema = z.object({
	location: z.string(),
	temperature: z.number(),
	format: z.string(),
	condition: z.string(),
	humidity: z.number(),
	windSpeed: z.number(),
});

// Type inference from schemas
type WeatherToolParameters = z.infer<typeof WeatherToolParametersSchema>;
type WeatherData = z.infer<typeof WeatherDataSchema>;

// Define the response schema for the weather API
const WeatherAPIResponseSchema = z.object({
	data: z
		.object({
			values: z.object({
				temperature: z.number(),
				weatherCode: z.string(),
				humidity: z.number(),
				windSpeed: z.number(),
			}),
		})
		.optional(),
});

type WeatherAPIResponse = z.infer<typeof WeatherAPIResponseSchema>;

async function weatherAPIHandler(
	params: WeatherToolParameters,
): Promise<WeatherData> {
	const url = `https://api.tomorrow.io/v4/weather/realtime?location=${encodeURIComponent(params.location)}&apikey=${process.env.TOMORROW_API_KEY}`;
	const options = {
		method: "GET",
		headers: {
			accept: "application/json",
			"accept-encoding": "deflate, gzip, br",
		},
	};

	let json: WeatherAPIResponse | undefined;

	// Fetch weather data from the API
	try {
		const response = await fetch(url, options);
		if (!response.ok) {
			throw new Error("Failed to fetch weather data");
		}
		json = (await response.json()) as WeatherAPIResponse;
	} catch (error) {
		console.error("Error fetching weather data:", error);
	}

	if (!json || !json.data || !json.data.values) {
		throw new Error("Invalid weather data");
	}

	return {
		location: params.location,
		temperature: json.data.values.temperature,
		format: params.format,
		condition: json.data.values.weatherCode,
		humidity: json.data.values.humidity,
		windSpeed: json.data.values.windSpeed,
	};
}

// Define the weather tool using the new interface
const weatherTool: Tool = {
	name: "get_current_weather",
	description: "Get the current weather for a location",
	parameters: {
		type: "object",
		properties: {
			location: {
				type: "string",
				description: "The location to get the weather for",
			},
			format: {
				type: "string",
				description: "Temperature format",
				enum: ["celsius", "fahrenheit"],
			},
		},
		required: ["location"],
	},
};

async function testWeatherTool() {
	console.log("Testing Ollama Weather Tool with Chat Completion API...\n");

	const ollama = new OllamaProvider();

	// Test prompts
	const prompts = [
		"What is the weather in Toronto?",
		"How hot is it in New York in Fahrenheit?",
		"Tell me about the weather conditions in London and Tokyo",
	];

	for (const prompt of prompts) {
		console.log(`\n📝 User: ${prompt}`);

		try {
			// First call: Get tool calls from the model using chat completion API
			console.log("🤖 Analyzing request...");

			const initialResponse = await ollama.generateChatCompletion({
				model: "qwen3:30b",
				messages: [{ role: "user", content: prompt }],
				tools: [weatherTool],
			});

			if (initialResponse.toolCalls && initialResponse.toolCalls.length > 0) {
				console.log(
					"🔧 Tool calls detected:",
					initialResponse.toolCalls.length,
				);

				// Build conversation history
				const messages: Message[] = [
					{ role: "user", content: prompt },
					{
						role: "assistant",
						content: initialResponse.text,
						toolCalls: initialResponse.toolCalls,
					},
				];

				// Process each tool call
				for (const toolCall of initialResponse.toolCalls) {
					console.log(`\n  Calling: ${toolCall.name}`);
					console.log(`  Arguments:`, toolCall.arguments);

					// Validate and parse the arguments using Zod
					try {
						const params = WeatherToolParametersSchema.parse(
							toolCall.arguments,
						);
						const weatherData = await weatherAPIHandler(params);

						console.log(`  ✅ Weather data retrieved:`, weatherData);

						// Add tool result to conversation
						messages.push({
							role: "tool",
							content: JSON.stringify(weatherData),
							toolCallId: toolCall.id,
						});
					} catch (error) {
						console.error(`  ❌ Validation error:`, error);

						// Add error to conversation
						messages.push({
							role: "tool",
							content: JSON.stringify({ error: "Invalid parameters" }),
							toolCallId: toolCall.id,
						});
					}
				}

				// Get final response with tool results
				console.log("\n🤖 Generating final response...");

				const finalResponse = await ollama.generateChatCompletion({
					model: "qwen3:30b",
					messages: messages,
				});

				console.log("\n💬 Assistant:", finalResponse.text);

				if (finalResponse.usage) {
					console.log(
						`\n📊 Total tokens used: ${finalResponse.usage.totalTokens}`,
					);
				}
			} else {
				// No tool calls, just a regular response
				console.log("💬 Assistant:", initialResponse.text);
			}
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
testWeatherTool().catch(console.error);
