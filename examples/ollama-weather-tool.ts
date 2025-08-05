import { OllamaProvider } from '../src/providers/ollama';
import { z } from 'zod';

// Define Zod schemas for weather tool
const WeatherFormatSchema = z.enum(['celsius', 'fahrenheit']);

const WeatherToolParametersSchema = z.object({
  location: z.string().describe('The location to get the weather for'),
  format: WeatherFormatSchema.describe('Temperature format').default('celsius')
});

const WeatherDataSchema = z.object({
  location: z.string(),
  temperature: z.number(),
  format: z.string(),
  condition: z.string(),
  humidity: z.number(),
  windSpeed: z.number()
});

// Type inference from schemas
type WeatherToolParameters = z.infer<typeof WeatherToolParametersSchema>;
type WeatherData = z.infer<typeof WeatherDataSchema>;

// Type for tool results
interface ToolResult {
  tool_call_id: string;
  result?: WeatherData;
  error?: string;
}

// Mock weather data function
function getWeatherData(params: WeatherToolParameters): WeatherData {
  const mockData: Record<string, Omit<WeatherData, 'location' | 'format'>> = {
    'toronto': { temperature: 22, condition: 'partly cloudy', humidity: 65, windSpeed: 15 },
    'new york': { temperature: 75, condition: 'sunny', humidity: 45, windSpeed: 10 },
    'london': { temperature: 18, condition: 'rainy', humidity: 80, windSpeed: 20 },
    'tokyo': { temperature: 28, condition: 'clear', humidity: 70, windSpeed: 12 },
    'sydney': { temperature: 25, condition: 'sunny', humidity: 55, windSpeed: 18 }
  };

  const location = params.location.toLowerCase();
  const baseData = mockData[location] || { 
    temperature: 20, 
    condition: 'unknown', 
    humidity: 50, 
    windSpeed: 10 
  };

  // Convert temperature if needed
  let temperature = baseData.temperature;
  if (params.format === 'fahrenheit' && location !== 'new york') {
    temperature = (temperature * 9/5) + 32;
  }

  return {
    location: params.location,
    temperature,
    format: params.format,
    condition: baseData.condition,
    humidity: baseData.humidity,
    windSpeed: baseData.windSpeed
  };
}

// Define the weather tool for Ollama
const weatherTool = {
  type: 'function' as const,
  function: {
    name: 'get_current_weather',
    description: 'Get the current weather for a location',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'The location to get the weather for'
        },
        format: {
          type: 'string',
          description: 'Temperature format',
          enum: ['celsius', 'fahrenheit']
        }
      },
      required: ['location']
    }
  }
};

async function testWeatherTool() {
  console.log('Testing Ollama Weather Tool Example...\n');

  const ollama = new OllamaProvider({
    host: 'http://127.0.0.1:11434'
  });

  // Test prompts
  const prompts = [
    'What is the weather in Toronto?',
    'How hot is it in New York in Fahrenheit?',
    'Tell me about the weather conditions in London and Tokyo'
  ];

  for (const prompt of prompts) {
    console.log(`\n📝 User: ${prompt}`);
    
    try {
      // First call: Get tool calls from the model
      console.log('🤖 Analyzing request...');
      
      // Using the Ollama client directly for tool calling
      const client = ollama.getClient();
      const toolResponse = await client.chat({
        model: 'qwen3:30b',
        messages: [{ role: 'user', content: prompt }],
        tools: [weatherTool],
        stream: false
      });

      if (toolResponse.message.tool_calls && toolResponse.message.tool_calls.length > 0) {
        console.log('🔧 Tool calls detected:', toolResponse.message.tool_calls.length);
        
        // Process each tool call
        const toolResults: ToolResult[] = [];
        for (const toolCall of toolResponse.message.tool_calls) {
          console.log(`\n  Calling: ${toolCall.function.name}`);
          console.log(`  Arguments:`, toolCall.function.arguments);
          
          // Validate and parse the arguments
          try {
            const params = WeatherToolParametersSchema.parse(toolCall.function.arguments);
            const weatherData = getWeatherData(params);
            
            console.log(`  ✅ Weather data retrieved:`, weatherData);
            
            toolResults.push({
              tool_call_id: (toolCall as any).id || `tool_call_${Math.random().toString(36).substring(2, 11)}`,
              result: weatherData
            });
          } catch (error) {
            console.error(`  ❌ Validation error:`, error);
            toolResults.push({
              tool_call_id: (toolCall as any).id || `tool_call_${Math.random().toString(36).substring(2, 11)}`,
              error: 'Invalid parameters'
            });
          }
        }

        // Second call: Get final response with tool results
        console.log('\n🤖 Generating final response...');
        
        const messages = [
          { role: 'user', content: prompt },
          toolResponse.message,
          { 
            role: 'tool', 
            content: JSON.stringify(toolResults),
            tool_call_id: toolResults[0].tool_call_id
          }
        ];

        const finalResponse = await client.chat({
          model: 'qwen3:30b',
          messages: messages,
          stream: false
        });

        console.log('\n💬 Assistant:', finalResponse.message.content);
      } else {
        // No tool calls, just a regular response
        console.log('💬 Assistant:', toolResponse.message.content);
      }

    } catch (error) {
      console.error('\n❌ Error:', error);
    }
  }

  console.log('\n\n📌 Note: Make sure you have a model that supports tool calling installed (e.g., qwen3:30b, llama3.1)');
  console.log('   You can install it with: ollama pull qwen3:30b');
}

// Run the test
testWeatherTool().catch(console.error);