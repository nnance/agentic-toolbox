import { OllamaProvider, executeToolLoop } from "../src/sdk";
import { z } from "zod";
import type { Tool } from "../src/sdk";
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
			console.log("🤖 Analyzing request...");

			const result = await executeToolLoop(ollama, {
				model: "qwen3:30b",
				messages: [{ role: "user", content: prompt }],
				tools: [weatherTool],
				onToolCall: async (toolCall) => {
					console.log(`\n  Calling: ${toolCall.name}`);
					console.log(`  Arguments:`, toolCall.arguments);

					// Validate and parse the arguments using Zod
					try {
						const params = WeatherToolParametersSchema.parse(
							toolCall.arguments,
						);
						const weatherData = await weatherAPIHandler(params);

						console.log(`  ✅ Weather data retrieved:`, weatherData);
						return weatherData;
					} catch (error) {
						console.error(`  ❌ Validation error:`, error);
						return { error: "Invalid parameters" };
					}
				},
			});

			console.log("\n💬 Assistant:", result.finalResponse);
			
			if (result.toolCallCount > 0) {
				console.log(`🔧 Tool calls made: ${result.toolCallCount}`);
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
