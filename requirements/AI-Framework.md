# AI Framework: Unified Text Generation Interface

## Overview
Create a simple abstraction layer that provides a common interface for text generation across Ollama, Anthropic, and OpenAI SDKs.

## Research Findings

### Ollama SDK
- **Initialization**: `new Ollama({ host: 'http://127.0.0.1:11434' })`
- **Generation**: `ollama.generate({ model, prompt, stream?, system?, format? })`
- **Key Parameters**: model, prompt, stream, system, format
- **Response**: Direct response object with generated text

### Anthropic SDK  
- **Initialization**: `new Anthropic({ apiKey })`
- **Generation**: `client.messages.create({ model, max_tokens, messages })`
- **Key Parameters**: model, max_tokens, messages array with role/content
- **Response**: `message.content` contains generated text, includes usage stats

### OpenAI SDK
- **Initialization**: `new OpenAI({ apiKey })`
- **Generation**: `client.chat.completions.create({ model, messages })`
- **Key Parameters**: model, messages array with role/content
- **Response**: `completion.choices[0].message.content` contains generated text

## Core Interface Design

### Common Interface
```typescript
interface TextGenerationOptions {
  model: string;
  prompt: string;
  maxTokens?: number;
  stream?: boolean;
  systemPrompt?: string;
}

interface TextGenerationResponse {
  text: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

interface LLMProvider {
  generateText(options: TextGenerationOptions): Promise<TextGenerationResponse>;
}
```

## Provider Implementation Strategy

### 1. Ollama Provider
- Maps `prompt` → `prompt`
- Maps `maxTokens` → internal parameter handling (Ollama doesn't have direct max_tokens)
- Maps `systemPrompt` → `system`
- Maps `stream` → `stream`
- Normalizes response to extract generated text
- Usage stats may not be available

### 2. Anthropic Provider  
- Maps `prompt` → `messages: [{ role: 'user', content: prompt }]`
- Maps `maxTokens` → `max_tokens`
- Maps `systemPrompt` → system message in messages array or separate system parameter
- Maps `stream` → `stream`
- Normalizes response from `message.content`
- Extracts usage statistics from response

### 3. OpenAI Provider
- Maps `prompt` → `messages: [{ role: 'user', content: prompt }]`
- Maps `maxTokens` → `max_tokens`
- Maps `systemPrompt` → system message in messages array
- Maps `stream` → `stream`
- Uses Chat Completions API for consistency
- Normalizes response from `completion.choices[0].message.content`
- Extracts usage statistics from response

## Framework Structure
```
src/
├── interfaces/
│   └── provider.ts          # Core interfaces (LLMProvider, Options, Response)
├── providers/
│   ├── ollama.ts           # Ollama implementation
│   ├── anthropic.ts        # Anthropic implementation
│   └── openai.ts           # OpenAI implementation
├── factory/
│   └── provider-factory.ts # Provider instantiation and configuration
├── errors/
│   └── framework-errors.ts # Custom error classes
└── index.ts                # Main export
```

## Key Design Decisions

1. **Unified Options Interface**: Single `TextGenerationOptions` interface that abstracts provider-specific parameters
2. **Normalized Response Format**: Consistent `TextGenerationResponse` structure across all providers
3. **Optional Parameters**: Support for common features like streaming, system prompts, and token limits
4. **Provider Factory Pattern**: Centralized provider instantiation with configuration management
5. **Consistent Error Handling**: Unified error handling and custom error types
6. **Usage Statistics**: Optional usage tracking where supported by providers
7. **Streaming Support**: Framework-level streaming abstraction (future enhancement)

## Configuration Strategy

### Provider Configuration
```typescript
interface ProviderConfig {
  type: 'ollama' | 'anthropic' | 'openai';
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}
```

### Factory Usage
```typescript
const provider = ProviderFactory.create({
  type: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultModel: 'claude-sonnet-4-20250514'
});

const response = await provider.generateText({
  model: 'claude-sonnet-4-20250514',
  prompt: 'Hello, world!',
  maxTokens: 100
});
```

## Error Handling Strategy

1. **Network Errors**: Standardized handling for connection issues
2. **Authentication Errors**: Unified API key validation
3. **Model Errors**: Consistent handling for invalid models
4. **Rate Limiting**: Standardized rate limit error responses
5. **Validation Errors**: Input parameter validation

## Dependencies

### Required Dependencies
```json
{
  "ollama": "^0.5.0",
  "@anthropic-ai/sdk": "^0.24.0", 
  "openai": "^4.0.0"
}
```

### Peer Dependencies
These will be marked as peer dependencies to allow users to install only the providers they need.

## Implementation Priority

1. **Phase 1**: Core interfaces and basic provider implementations
2. **Phase 2**: Provider factory and configuration management
3. **Phase 3**: Error handling and validation
4. **Phase 4**: Usage statistics normalization
5. **Phase 5**: Chat completions and tool calling support
6. **Phase 6**: Streaming support (future enhancement)

## Testing Strategy

1. **Unit Tests**: Test each provider implementation in isolation
2. **Integration Tests**: Test provider factory and configuration
3. **Mock Testing**: Use mocked SDK responses for consistent testing
4. **Live Testing**: Optional integration tests with real API endpoints

## Chat Completions and Tool Calling

### Overview
The framework supports both simple text generation and advanced chat completions with tool calling. The interface is designed to be simple for basic use cases while supporting complex agent workflows.

### Message Format
```typescript
interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;      // For tool response messages
  toolCalls?: ToolCall[];   // For assistant messages requesting tool use
}
```

### Tool Definition
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

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}
```

### Extended Interfaces
```typescript
// Extended options supporting both simple and chat modes
interface ChatCompletionOptions extends TextGenerationOptions {
  messages?: Message[];     // Use messages for chat mode (overrides prompt)
  tools?: Tool[];          // Available tools for the model to use
}

// Extended response with tool calling support
interface ChatCompletionResponse extends TextGenerationResponse {
  toolCalls?: ToolCall[];   // Tool calls requested by the model
}

// Updated provider interface
interface LLMProvider {
  // Simple text generation (backward compatible)
  generateText(options: TextGenerationOptions): Promise<TextGenerationResponse>;
  
  // Chat completions with tool support
  generateChatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse>;
}
```

### Provider Mapping Strategy

#### Ollama
- Uses OpenAI-compatible `/v1/chat/completions` endpoint
- Maps tools to OpenAI function format
- Supports streaming with tool calls

#### OpenAI
- Native function calling support
- Direct mapping of tool definitions
- Handles parallel tool calls

#### Anthropic
- Maps to Claude's tool use format
- Converts between function/tool terminology
- Supports complex tool chaining

### Implementation Notes

1. **Backward Compatibility**: The `generateText` method remains unchanged
2. **Simple by Default**: Tool calling is optional - omit `tools` for regular chat
3. **Unified Format**: Same tool definition works across all providers
4. **Type Safety**: Full TypeScript support for tool parameters

## Usage Examples

### Simple Text Generation (Unchanged)
```typescript
import { ProviderFactory } from 'agentic-toolbox';

// Initialize provider
const llm = ProviderFactory.create({
  type: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Generate text
const response = await llm.generateText({
  model: 'claude-sonnet-4-20250514',
  prompt: 'Explain quantum computing in simple terms',
  maxTokens: 200,
  systemPrompt: 'You are a helpful science teacher'
});

console.log(response.text);
console.log(`Used ${response.usage?.totalTokens} tokens`);
```

### Chat Completion
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

### Tool Calling Example
```typescript
// Define a weather tool
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
  model: 'claude-sonnet-4-20250514',
  messages: [
    { role: 'user', content: 'What\'s the weather in Paris?' }
  ],
  tools: [weatherTool]
});

// Handle tool calls
if (response.toolCalls) {
  for (const toolCall of response.toolCalls) {
    console.log(`Tool requested: ${toolCall.name}`);
    console.log(`Arguments: ${JSON.stringify(toolCall.arguments)}`);
    
    // Execute tool and continue conversation
    const weatherData = await getWeather(toolCall.arguments);
    
    const finalResponse = await llm.generateChatCompletion({
      model: 'claude-sonnet-4-20250514',
      messages: [
        { role: 'user', content: 'What\'s the weather in Paris?' },
        { role: 'assistant', content: response.text, toolCalls: response.toolCalls },
        { role: 'tool', content: JSON.stringify(weatherData), toolCallId: toolCall.id }
      ]
    });
    
    console.log(finalResponse.text); // Natural language response with weather info
  }
}
```