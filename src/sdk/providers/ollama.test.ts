import {
  chatMessagesToOllama,
  toolsToOllama,
  extractToolCallsFromOllama,
  calculateUsage,
} from "./ollama";
import type { Message } from "../interfaces/context";
import type { Tool } from "../interfaces/tools";
import type { ChatResponse } from "ollama";

describe("chatMessagesToOllama", () => {
  it("should convert basic messages without tool calls", () => {
    const messages: Message[] = [
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
    ];

    const result = chatMessagesToOllama(messages);

    expect(result).toEqual([
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
    ]);
  });

  it("should convert assistant messages with tool calls", () => {
    const messages: Message[] = [
      { role: "user", content: "What's the weather?" },
      {
        role: "assistant",
        content: "Let me check the weather for you.",
        toolCalls: [
          {
            id: "call_123",
            name: "get_weather",
            arguments: { location: "New York" },
          },
        ],
      },
    ];

    const result = chatMessagesToOllama(messages);

    expect(result).toEqual([
      { role: "user", content: "What's the weather?" },
      {
        role: "assistant",
        content: "Let me check the weather for you.",
        tool_calls: [
          {
            id: "call_123",
            type: "function",
            function: {
              name: "get_weather",
              arguments: { location: "New York" },
            },
          },
        ],
      },
    ]);
  });

  it("should handle multiple tool calls in a single message", () => {
    const messages: Message[] = [
      {
        role: "assistant",
        content: "I'll check both locations.",
        toolCalls: [
          {
            id: "call_1",
            name: "get_weather",
            arguments: { location: "New York" },
          },
          {
            id: "call_2",
            name: "get_weather",
            arguments: { location: "Los Angeles" },
          },
        ],
      },
    ];

    const result = chatMessagesToOllama(messages);

    expect(result[0]).toHaveProperty("tool_calls");
    expect(result[0].tool_calls).toHaveLength(2);
    expect(result[0].tool_calls?.[0]).toEqual({
      id: "call_1",
      type: "function",
      function: {
        name: "get_weather",
        arguments: { location: "New York" },
      },
    });
    expect(result[0].tool_calls?.[1]).toEqual({
      id: "call_2",
      type: "function",
      function: {
        name: "get_weather",
        arguments: { location: "Los Angeles" },
      },
    });
  });

  it("should handle empty messages array", () => {
    const messages: Message[] = [];
    const result = chatMessagesToOllama(messages);
    expect(result).toEqual([]);
  });

  it("should handle messages without toolCalls property", () => {
    const messages: Message[] = [
      { role: "assistant", content: "Regular response" },
    ];

    const result = chatMessagesToOllama(messages);

    expect(result).toEqual([
      { role: "assistant", content: "Regular response" },
    ]);
    expect(result[0]).not.toHaveProperty("tool_calls");
  });
});

describe("toolsToOllama", () => {
  it("should convert tools with complete parameters", () => {
    const tools: Tool[] = [
      {
        name: "get_weather",
        description: "Get the current weather",
        parameters: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "The city and state",
            },
            unit: {
              type: "string",
              enum: ["celsius", "fahrenheit"],
              description: "Temperature unit",
            },
          },
          required: ["location"],
        },
      },
    ];

    const result = toolsToOllama(tools);

    expect(result).toEqual([
      {
        type: "function",
        function: {
          name: "get_weather",
          description: "Get the current weather",
          parameters: {
            type: "object",
            properties: {
              location: {
                type: "string",
                description: "The city and state",
              },
              unit: {
                type: "string",
                enum: ["celsius", "fahrenheit"],
                description: "Temperature unit",
              },
            },
            required: ["location"],
          },
        },
      },
    ]);
  });

  it("should handle tools with minimal parameters", () => {
    const tools: Tool[] = [
      {
        name: "simple_tool",
        description: "A simple tool",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    ];

    const result = toolsToOllama(tools);

    expect(result).toEqual([
      {
        type: "function",
        function: {
          name: "simple_tool",
          description: "A simple tool",
          parameters: {
            type: "object",
            properties: {},
          },
        },
      },
    ]);
  });

  it("should handle tools without properties field", () => {
    const tools: Tool[] = [
      {
        name: "no_params_tool",
        description: "Tool without parameters",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    ];

    const result = toolsToOllama(tools);

    expect(result).toEqual([
      {
        type: "function",
        function: {
          name: "no_params_tool",
          description: "Tool without parameters",
          parameters: {
            type: "object",
            properties: {},
          },
        },
      },
    ]);
  });

  it("should handle properties with non-object values gracefully", () => {
    const tools: Tool[] = [
      {
        name: "mixed_tool",
        description: "Tool with mixed properties",
        parameters: {
          type: "object",
          properties: {
            valid: { type: "string" },
            invalid: "not an object",
            nullValue: null,
            nested: { type: "object", properties: { inner: { type: "number" } } },
          },
        },
      },
    ];

    const result = toolsToOllama(tools);

    expect(result[0]?.function?.parameters?.properties).toEqual({
      valid: { type: "string" },
      invalid: { type: "string" },
      nullValue: { type: "string" },
      nested: { type: "object", properties: { inner: { type: "number" } } },
    });
  });

  it("should handle multiple tools", () => {
    const tools: Tool[] = [
      {
        name: "tool1",
        description: "First tool",
        parameters: { type: "object", properties: { param1: { type: "string" } } },
      },
      {
        name: "tool2",
        description: "Second tool",
        parameters: { type: "object", properties: { param2: { type: "number" } } },
      },
    ];

    const result = toolsToOllama(tools);

    expect(result).toHaveLength(2);
    expect(result[0].function.name).toBe("tool1");
    expect(result[1].function.name).toBe("tool2");
  });

  it("should handle undefined tools array", () => {
    const result = toolsToOllama(undefined as unknown as Tool[]);
    expect(result).toBeUndefined();
  });

  it("should handle empty tools array", () => {
    const tools: Tool[] = [];
    const result = toolsToOllama(tools);
    expect(result).toEqual([]);
  });

  it("should preserve additional parameter fields", () => {
    const tools: Tool[] = [
      {
        name: "advanced_tool",
        description: "Tool with additional fields",
        parameters: {
          type: "object",
          properties: {
            field1: { type: "string" },
          },
          required: ["field1"],
        } as any,
      },
    ];

    const result = toolsToOllama(tools);

    expect(result[0].function.parameters).toEqual({
      type: "object",
      properties: {
        field1: { type: "string" },
      },
      required: ["field1"],
    });
  });
});

describe("extractToolCallsFromOllama", () => {
  it("should extract tool calls from response with tool_calls", () => {
    const response: ChatResponse = {
      message: {
        role: "assistant",
        content: "Let me check the weather for you.",
        tool_calls: [
          {
            function: {
              name: "get_weather",
              arguments: { location: "New York" },
            },
          },
        ],
      },
      model: "llama2",
      created_at: new Date(),
      done: true,
      done_reason: "stop",
      total_duration: 1000,
      load_duration: 100,
      prompt_eval_count: 50,
      prompt_eval_duration: 200,
      eval_count: 25,
      eval_duration: 300,
    };

    const result = extractToolCallsFromOllama(response);

    expect(result).toBeDefined();
    expect(result).toHaveLength(1);
    expect(result![0].name).toBe("get_weather");
    expect(result![0].arguments).toEqual({ location: "New York" });
    expect(result![0].id).toMatch(/^tool_[a-z0-9]{9}$/);
  });

  it("should extract multiple tool calls from response", () => {
    const response: ChatResponse = {
      message: {
        role: "assistant",
        content: "I'll check multiple locations.",
        tool_calls: [
          {
            function: {
              name: "get_weather",
              arguments: { location: "New York" },
            },
          },
          {
            function: {
              name: "get_weather",
              arguments: { location: "Los Angeles" },
            },
          },
          {
            function: {
              name: "get_time",
              arguments: { timezone: "UTC" },
            },
          },
        ],
      },
      model: "llama2",
      created_at: new Date(),
      done: true,
      done_reason: "stop",
      total_duration: 1000,
      load_duration: 100,
      prompt_eval_count: 50,
      prompt_eval_duration: 200,
      eval_count: 25,
      eval_duration: 300,
    };

    const result = extractToolCallsFromOllama(response);

    expect(result).toBeDefined();
    expect(result).toHaveLength(3);
    expect(result![0].name).toBe("get_weather");
    expect(result![0].arguments).toEqual({ location: "New York" });
    expect(result![1].name).toBe("get_weather");
    expect(result![1].arguments).toEqual({ location: "Los Angeles" });
    expect(result![2].name).toBe("get_time");
    expect(result![2].arguments).toEqual({ timezone: "UTC" });
    expect(result!.every(tc => tc.id.match(/^tool_[a-z0-9]{9}$/))).toBe(true);
  });

  it("should return undefined when no tool_calls in response", () => {
    const response: ChatResponse = {
      message: {
        role: "assistant",
        content: "Here's the answer without using any tools.",
      },
      model: "llama2",
      created_at: new Date(),
      done: true,
      done_reason: "stop",
      total_duration: 1000,
      load_duration: 100,
      prompt_eval_count: 50,
      prompt_eval_duration: 200,
      eval_count: 25,
      eval_duration: 300,
    };

    const result = extractToolCallsFromOllama(response);

    expect(result).toBeUndefined();
  });

  it("should return undefined when tool_calls is empty array", () => {
    const response: ChatResponse = {
      message: {
        role: "assistant",
        content: "No tools needed.",
        tool_calls: [],
      },
      model: "llama2",
      created_at: new Date(),
      done: true,
      done_reason: "stop",
      total_duration: 1000,
      load_duration: 100,
      prompt_eval_count: 50,
      prompt_eval_duration: 200,
      eval_count: 25,
      eval_duration: 300,
    };

    const result = extractToolCallsFromOllama(response);

    expect(result).toBeUndefined();
  });

  it("should generate unique IDs for each tool call", () => {
    const response: ChatResponse = {
      message: {
        role: "assistant",
        content: "Multiple calls.",
        tool_calls: [
          {
            function: {
              name: "tool1",
              arguments: {},
            },
          },
          {
            function: {
              name: "tool2",
              arguments: {},
            },
          },
          {
            function: {
              name: "tool3",
              arguments: {},
            },
          },
        ],
      },
      model: "llama2",
      created_at: new Date(),
      done: true,
      done_reason: "stop",
      total_duration: 1000,
      load_duration: 100,
      prompt_eval_count: 50,
      prompt_eval_duration: 200,
      eval_count: 25,
      eval_duration: 300,
    };

    const result = extractToolCallsFromOllama(response);

    expect(result).toBeDefined();
    expect(result).toHaveLength(3);
    const ids = result!.map(tc => tc.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);
  });

  it("should handle tool calls with complex arguments", () => {
    const response: ChatResponse = {
      message: {
        role: "assistant",
        content: "Processing complex request.",
        tool_calls: [
          {
            function: {
              name: "complex_tool",
              arguments: {
                nested: {
                  field1: "value1",
                  field2: 123,
                  field3: true,
                  field4: null,
                  field5: ["array", "of", "values"],
                  field6: { deeply: { nested: { object: "value" } } },
                },
                simple: "string",
              },
            },
          },
        ],
      },
      model: "llama2",
      created_at: new Date(),
      done: true,
      done_reason: "stop",
      total_duration: 1000,
      load_duration: 100,
      prompt_eval_count: 50,
      prompt_eval_duration: 200,
      eval_count: 25,
      eval_duration: 300,
    };

    const result = extractToolCallsFromOllama(response);

    expect(result).toBeDefined();
    expect(result).toHaveLength(1);
    expect(result![0].name).toBe("complex_tool");
    expect(result![0].arguments).toEqual({
      nested: {
        field1: "value1",
        field2: 123,
        field3: true,
        field4: null,
        field5: ["array", "of", "values"],
        field6: { deeply: { nested: { object: "value" } } },
      },
      simple: "string",
    });
  });
});

describe("calculateUsage", () => {
  it("should calculate usage with all values present", () => {
    const response: ChatResponse = {
      message: {
        role: "assistant",
        content: "Response text",
      },
      model: "llama2",
      created_at: new Date(),
      done: true,
      done_reason: "stop",
      total_duration: 1000,
      load_duration: 100,
      prompt_eval_count: 150,
      prompt_eval_duration: 200,
      eval_count: 75,
      eval_duration: 300,
    };

    const result = calculateUsage(response);

    expect(result).toEqual({
      promptTokens: 150,
      completionTokens: 75,
      totalTokens: 225,
    });
  });

  it("should handle missing prompt_eval_count", () => {
    const response = {
      message: {
        role: "assistant",
        content: "Response text",
      },
      model: "llama2",
      created_at: new Date(),
      done: true,
      done_reason: "stop",
      total_duration: 1000,
      load_duration: 100,
      prompt_eval_duration: 200,
      eval_count: 75,
      eval_duration: 300,
    } as ChatResponse;

    const result = calculateUsage(response);

    expect(result).toEqual({
      promptTokens: 0,
      completionTokens: 75,
      totalTokens: 75,
    });
  });

  it("should handle missing eval_count", () => {
    const response = {
      message: {
        role: "assistant",
        content: "Response text",
      },
      model: "llama2",
      created_at: new Date(),
      done: true,
      done_reason: "stop",
      total_duration: 1000,
      load_duration: 100,
      prompt_eval_count: 150,
      prompt_eval_duration: 200,
      eval_duration: 300,
    } as ChatResponse;

    const result = calculateUsage(response);

    expect(result).toEqual({
      promptTokens: 150,
      completionTokens: 0,
      totalTokens: 150,
    });
  });

  it("should handle both counts missing", () => {
    const response = {
      message: {
        role: "assistant",
        content: "Response text",
      },
      model: "llama2",
      created_at: new Date(),
      done: true,
      done_reason: "stop",
      total_duration: 1000,
      load_duration: 100,
      prompt_eval_duration: 200,
      eval_duration: 300,
    } as ChatResponse;

    const result = calculateUsage(response);

    expect(result).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });
  });

  it("should handle zero values", () => {
    const response: ChatResponse = {
      message: {
        role: "assistant",
        content: "Response text",
      },
      model: "llama2",
      created_at: new Date(),
      done: true,
      done_reason: "stop",
      total_duration: 1000,
      load_duration: 100,
      prompt_eval_count: 0,
      prompt_eval_duration: 200,
      eval_count: 0,
      eval_duration: 300,
    };

    const result = calculateUsage(response);

    expect(result).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });
  });

  it("should calculate correct total when both values present", () => {
    const response: ChatResponse = {
      message: {
        role: "assistant",
        content: "Response text",
      },
      model: "llama2",
      created_at: new Date(),
      done: true,
      done_reason: "stop",
      total_duration: 1000,
      load_duration: 100,
      prompt_eval_count: 1000,
      prompt_eval_duration: 200,
      eval_count: 500,
      eval_duration: 300,
    };

    const result = calculateUsage(response);

    expect(result).toEqual({
      promptTokens: 1000,
      completionTokens: 500,
      totalTokens: 1500,
    });
  });

  it("should handle undefined values as 0", () => {
    const response = {
      message: {
        role: "assistant",
        content: "Response text",
      },
      model: "llama2",
      created_at: new Date(),
      done: true,
      done_reason: "stop",
      total_duration: 1000,
      load_duration: 100,
      prompt_eval_count: undefined,
      prompt_eval_duration: 200,
      eval_count: undefined,
      eval_duration: 300,
    } as any as ChatResponse;

    const result = calculateUsage(response);

    expect(result).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });
  });
});