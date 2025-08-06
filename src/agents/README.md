# Agents

The central hub for all composable and higher-level AI agents in the Agentic Toolbox. This directory contains reusable agent components that can be combined to create sophisticated AI workflows and applications.

## Overview

Agents are autonomous or semi-autonomous components that leverage LLM providers to accomplish specific tasks. They can be composed together to create complex workflows, chain multiple operations, or build intelligent applications.

## Agent Types

### Composable Agents
Small, focused agents that perform specific tasks and can be combined with other agents:
- Single-responsibility agents
- Tool-specific agents
- Utility agents for common operations

### Higher-Level Agents
Complex agents built by composing multiple smaller agents:
- Multi-step workflow agents
- Task orchestration agents
- Domain-specific agents

## Architecture

Each agent follows a consistent structure:
- **Interface** - Clear input/output contracts
- **Configuration** - Customizable behavior and parameters
- **Execution** - Core logic implementation
- **Composition** - Ability to work with other agents

## Usage

```typescript
import { Agent } from "@agentic-toolbox/agents";

// Initialize an agent
const agent = new Agent({
  provider: llmProvider,
  config: { /* agent-specific config */ }
});

// Execute agent task
const result = await agent.execute({
  input: "Your task description",
  context: { /* optional context */ }
});
```

## Creating New Agents

When creating a new agent:
1. Define clear responsibilities and boundaries
2. Implement the standard agent interface
3. Support composition with other agents
4. Include comprehensive error handling
5. Document usage and examples

## Examples

See individual agent directories for specific examples and documentation.

## Contributing

When contributing new agents:
- Follow the established patterns and interfaces
- Include unit tests
- Provide clear documentation
- Consider composability with existing agents

## License

MIT