# Agentic Toolbox

Modular AI agent components to rapidly assemble custom workflows — no heavy implementation required.

## Overview

The Agentic Toolbox provides a flexible framework for building and composing AI agent components. Each component can be registered with the toolbox and executed as part of larger workflows.

## Installation

```bash
npm install agentic-toolbox
```

## Development

This project is built with TypeScript. To get started:

1. Clone the repository
2. Install dependencies: `npm install`
3. Start development mode: `npm run dev`

## Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Run in development mode with hot reload
- `npm start` - Run the compiled JavaScript
- `npm run clean` - Remove build artifacts

## Examples

The `examples/` directory contains sample scripts demonstrating how to use the Agentic Toolbox components.

### Running Examples

To run any example script:

```bash
# Build the project first
npm run build

# Run an example using ts-node
npx ts-node examples/[example-name].ts
```

### Available Examples

- **`ollama-simple.ts`** - Basic usage of the Ollama provider for text generation

#### Ollama Example Prerequisites

Before running the Ollama example:

1. Install and start Ollama:
   ```bash
   # Install Ollama (see https://ollama.ai for installation instructions)
   ollama serve
   ```

2. Pull a model (the example uses `qwen3:30b`):
   ```bash
   ollama pull qwen3:30b
   ```

3. Run the example:
   ```bash
   npx ts-node examples/ollama-simple.ts
   ```

## License

MIT
