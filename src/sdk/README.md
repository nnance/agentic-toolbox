# Agentic Toolbox SDK

A minimalist TypeScript SDK that provides a unified interface for text generation across multiple LLM providers (Ollama, Anthropic, OpenAI) with built-in support for tool calling and chat completions.

## Features

- 🔌 **Unified Interface** - Single API for multiple LLM providers
- 🛠️ **Tool Calling Support** - Built-in support for function/tool calling across all providers
- 💬 **Chat Completions** - Full conversation context with message history
- 🔄 **Streaming Support** - Real-time response streaming (coming soon)
- 🎯 **Type Safety** - Full TypeScript support with comprehensive type definitions
- ⚡ **Lightweight** - Minimal dependencies, focused on core functionality
- 🔧 **Tool Call Limiting** - Prevent infinite loops with configurable limits

## Installation

```bash
npm install @agentic-toolbox/sdk
```

### Peer Dependencies

Install only the providers you need:

```bash
# For Ollama support
npm install ollama

# For Anthropic support  
npm install @anthropic-ai/sdk

# For OpenAI support
npm install openai
```

## Quick Start

### Simple Text Generation

```typescript
import { ProviderFactory } from '@agentic-toolbox/sdk';

// Initialize provider
const llm = ProviderFactory.create({
  type: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Generate text
const response = await llm.generateText({
  model: 'claude-3-sonnet-20240229',
  prompt: 'Explain quantum computing in simple terms',
  maxTokens: 200,
  systemPrompt: 'You are a helpful science teacher'
});

console.log(response.text);
console.log(`Tokens used: ${response.usage?.totalTokens}`);
```

### Chat Completions

```typescript
const response = await llm.generateChatCompletion({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: 'You are a helpful assistant' },
    { role: 'user', content: 'What is the capital of France?' }
  ]
});

console.log(response.text); // "The capital of France is Paris."
```

### Tool Calling

```typescript
import { Tool } from '@agentic-toolbox/sdk';

// Define a tool
const weatherTool: Tool = {
  name: 'get_weather',
  description: 'Get current weather for a location',
  parameters: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'City name' },
      unit: { type: 'string', enum: ['celsius', 'fahrenheit'] }
    },
    required: ['location']
  }
};

// Make request with tools
const response = await llm.generateChatCompletion({
  model: 'claude-3-sonnet-20240229',
  messages: [
    { role: 'user', content: "What's the weather in Paris?" }
  ],
  tools: [weatherTool],
  maxToolCalls: 5  // Limit tool calls to prevent loops
});

// Handle tool calls
if (response.toolCalls) {
  for (const toolCall of response.toolCalls) {
    console.log(`Tool: ${toolCall.name}`);
    console.log(`Args: ${JSON.stringify(toolCall.arguments)}`);
    
    // Execute your tool logic here
    const weatherData = await getWeather(toolCall.arguments);
    
    // Continue conversation with tool results
    const finalResponse = await llm.generateChatCompletion({
      model: 'claude-3-sonnet-20240229',
      messages: [
        { role: 'user', content: "What's the weather in Paris?" },
        { role: 'assistant', content: response.text, toolCalls: response.toolCalls },
        { role: 'tool', content: JSON.stringify(weatherData), toolCallId: toolCall.id }
      ]
    });
    
    console.log(finalResponse.text);
  }
}
```

## Provider Configuration

### Ollama

```typescript
const ollama = ProviderFactory.create({
  type: 'ollama',
  baseUrl: 'http://127.0.0.1:11434',  // Optional, defaults to localhost
  defaultModel: 'llama2'
});
```

### Anthropic

```typescript
const anthropic = ProviderFactory.create({
  type: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultModel: 'claude-3-sonnet-20240229'
});
```

### OpenAI

```typescript
const openai = ProviderFactory.create({
  type: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  defaultModel: 'gpt-4'
});
```

## Advanced Features

### Tool Execution Helper

The SDK includes a helper function for automatic tool execution loops:

```typescript
import { executeToolLoop } from '@agentic-toolbox/sdk/helpers';

const result = await executeToolLoop(llm, {
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'Calculate 25 * 4, then add 15' }
  ],
  tools: [calculatorTool],
  maxToolCalls: 10,
  onToolCall: async (toolCall) => {
    // Execute the requested tool
    switch (toolCall.name) {
      case 'calculate':
        return calculateExpression(toolCall.arguments);
      default:
        throw new Error(`Unknown tool: ${toolCall.name}`);
    }
  }
});

console.log(`Result: ${result.finalResponse}`);
console.log(`Tool calls made: ${result.toolCallCount}`);
```

### Tool Call Limiting

Prevent infinite loops and control resource usage:

```typescript
// Strict limit - only one tool call allowed
const response = await llm.generateChatCompletion({
  model: 'gpt-4',
  messages: [...],
  tools: [...],
  maxToolCalls: 1
});

// Check if limit was reached
if (response.maxToolCallsReached) {
  console.log(`Limit reached after ${response.toolCallCount} calls`);
}

// No limit (be careful!)
const unlimitedResponse = await llm.generateChatCompletion({
  model: 'gpt-4',
  messages: [...],
  tools: [...],
  maxToolCalls: undefined  // No limit
});
```

## API Reference

### Core Interfaces

#### TextGenerationOptions
```typescript
interface TextGenerationOptions {
  model: string;
  prompt: string;
  maxTokens?: number;
  stream?: boolean;
  systemPrompt?: string;
}
```

#### ChatCompletionOptions
```typescript
interface ChatCompletionOptions extends TextGenerationOptions {
  messages?: Message[];
  tools?: Tool[];
  maxToolCalls?: number;
}
```

#### Message
```typescript
interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}
```

#### Tool
```typescript
interface Tool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}
```

#### Responses
```typescript
interface TextGenerationResponse {
  text: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

interface ChatCompletionResponse extends TextGenerationResponse {
  toolCalls?: ToolCall[];
  toolCallCount?: number;
  maxToolCallsReached?: boolean;
}
```

## Error Handling

The SDK provides consistent error handling across all providers:

```typescript
import { FrameworkError } from '@agentic-toolbox/sdk/errors';

try {
  const response = await llm.generateText({
    model: 'invalid-model',
    prompt: 'Hello'
  });
} catch (error) {
  if (error instanceof FrameworkError) {
    console.error(`Framework error: ${error.message}`);
    // Handle authentication, rate limiting, validation errors
  }
}
```

## Provider-Specific Features

### Ollama
- Uses OpenAI-compatible chat completions endpoint
- Supports local model deployment
- No API key required for local instances

### Anthropic
- Full Claude model family support
- Native tool use format
- Advanced reasoning capabilities

### OpenAI
- GPT-3.5 and GPT-4 model families
- Native function calling
- Parallel tool execution support

## Development

### Project Structure
```
src/sdk/
├── interfaces/       # Core type definitions
│   ├── provider.ts   # Provider interfaces
│   ├── tools.ts      # Tool-related types
│   └── context.ts    # Execution context types
├── providers/        # Provider implementations
│   ├── ollama.ts
│   ├── anthropic.ts
│   └── openai.ts
├── helpers/          # Utility functions
│   └── tool-execution.ts
├── utils/           # Internal utilities
│   └── tool-loop.ts
└── errors/          # Error handling
    └── framework-errors.ts
```

### Testing

Run tests with:
```bash
npm test
```

The SDK includes comprehensive unit and integration tests for all providers.

## Examples

See the `/examples` directory for complete working examples:
- Basic text generation
- Multi-turn conversations
- Tool calling patterns
- Error handling
- Provider switching

## Contributing

Contributions are welcome! Please see our [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

MIT © Nick Nance

## Support

For issues, questions, or suggestions, please open an issue on [GitHub](https://github.com/nicknance/agentic-toolbox).