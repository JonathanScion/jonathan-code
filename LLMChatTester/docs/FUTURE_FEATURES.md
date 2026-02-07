# Future Features

## Completed

### 1. System Prompts ✓
Set custom system prompts per provider to control behavior and persona.

### 2. Clear Conversation ✓
Reset button to clear conversation history and start fresh.

### 3. Streaming Responses ✓
Real-time token streaming instead of waiting for full response.

### 4. Model Selector UI ✓
Dropdowns to easily switch models for each provider (Claude, OpenAI, Gemini).

### 9. Provider-Specific Parameter UIs ✓
Each LLM API has unique parameters with dedicated configuration panels.

### 7. Response Comparison ✓
Side-by-side rating system to compare LLM outputs with:
- Star ratings (1-5) per response
- Winner selection (one per turn)
- Notes field for comments
- Summary stats in header (win %, average stars)

### 5. Token/Cost Tracking ✓
Shows token usage and estimated cost per response:
- Input/output token counts displayed in response header
- Cost calculated based on model pricing (per 1M tokens)
- Pricing data for all supported Claude, OpenAI, and Gemini models

### 8. Prompt Templates ✓
Save and reuse common prompts for testing:
- Create, edit, and delete templates
- Optional category grouping
- Save current prompt as template
- Stored in localStorage for persistence
- Click to populate input field

### 6. Export Conversations ✓
Save conversations as JSON or markdown files:
- JSON export with full data (params, history, stats)
- Markdown export with formatted conversation, ratings, and summary
- Downloads with timestamped filenames
- Includes token usage and cost per response

### RAG (Retrieval-Augmented Generation) ✓
Document-based context for LLM responses:
- Upload PDF, DOCX, TXT, MD files
- Text chunking with overlap for better retrieval
- OpenAI embeddings (text-embedding-3-small)
- Pinecone vector database for storage and search
- RAG toggle to enable/disable context injection
- Shows retrieved chunks with relevance scores
- Context injected into all three LLM providers

---

## All Features Complete!
