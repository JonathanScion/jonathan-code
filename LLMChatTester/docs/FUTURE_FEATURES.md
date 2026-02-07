# Future Features

## Planned Enhancements

### 1. System Prompts
Set custom system prompts per provider to control behavior and persona.

### 2. Clear Conversation
Reset button to clear conversation history and start fresh.

### 3. Streaming Responses
~~Real-time token streaming instead of waiting for full response.~~ **IN PROGRESS**

### 4. Model Selector UI
Dropdowns to easily switch models for each provider (Claude, OpenAI, Gemini).

### 5. Token/Cost Tracking
Show token usage statistics and estimated cost per response.

### 6. Export Conversations
Save conversations as JSON or markdown files.

### 7. Response Comparison
Side-by-side diff view or rating system to compare LLM outputs.

### 8. Prompt Templates
Save and reuse common prompts for testing.

### 9. Provider-Specific Parameter UIs
Each LLM API has unique parameters. Build dedicated configuration panels:
- **Claude**: system prompt, thinking/extended thinking, top_k, tool use
- **OpenAI**: system message, frequency_penalty, presence_penalty, logit_bias, response_format
- **Gemini**: safety settings, stop sequences, candidate count
