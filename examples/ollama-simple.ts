import { OllamaProvider } from '../src/providers/ollama';

async function testOllamaProvider() {
  console.log('Testing Ollama Provider...\n');

  // Initialize the provider
  const ollama = new OllamaProvider({
    host: 'http://127.0.0.1:11434'
  });

  try {
    console.log('Sending request to Ollama...');
    
    const response = await ollama.generateText({
      model: 'qwen3:30b',
      prompt: 'What is TypeScript in one sentence?',
      systemPrompt: 'You are a helpful programming assistant. Be concise.'
    });

    console.log('\n✅ Success!');
    console.log('Generated text:', response.text);
    console.log('\nUsage stats:');
    console.log('- Prompt tokens:', response.usage?.promptTokens || 'N/A');
    console.log('- Completion tokens:', response.usage?.completionTokens || 'N/A');
    console.log('- Total tokens:', response.usage?.totalTokens || 'N/A');

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure Ollama is running: ollama serve');
    console.log('2. Make sure you have the model: ollama pull llama3.2');
    console.log('3. Check if Ollama is accessible at http://127.0.0.1:11434');
  }
}

// Run the test
testOllamaProvider();