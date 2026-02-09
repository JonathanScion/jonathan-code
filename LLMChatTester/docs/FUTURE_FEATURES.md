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

### 5. Provider-Specific Parameter UIs ✓
Each LLM API has unique parameters with dedicated configuration panels.

### 6. Response Comparison ✓
Side-by-side rating system to compare LLM outputs with:
- Star ratings (1-5) per response
- Winner selection (one per turn)
- Notes field for comments
- Summary stats in header (win %, average stars)

### 7. Token/Cost Tracking ✓
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

### 9. Export Conversations ✓
Save conversations as JSON or markdown files:
- JSON export with full data (params, history, stats)
- Markdown export with formatted conversation, ratings, and summary
- Downloads with timestamped filenames
- Includes token usage and cost per response

### 10. RAG (Retrieval-Augmented Generation) ✓
Document-based context for LLM responses:
- Upload PDF, DOCX, TXT, MD files
- Text chunking with overlap for better retrieval
- Google embeddings (gemini-embedding-001)
- Pinecone vector database for storage and search
- RAG toggle to enable/disable context injection
- Shows retrieved chunks with relevance scores
- Context injected into all three LLM providers

---

## Planned Features

### 11. One-Click Copy Response ✓
Copy any LLM response to clipboard with a single click.

### 12. Keyboard Shortcuts ✓
Power user keyboard navigation:
- Ctrl+Enter to send message
- Escape to clear input
- Ctrl+L to clear conversation

### 13. Quick Temperature Presets ✓
One-click temperature settings:
- "Creative" (high temperature)
- "Balanced" (medium)
- "Precise" (low temperature)

### 14. Light Theme Toggle ✓
Switch between dark and light themes with localStorage persistence.

### 15. Image Input Support (Multimodal) ✓
Send images to vision-capable models:
- Drag & drop, paste, or file picker
- Support for Claude, GPT-4o, Gemini vision models
- Image preview before sending
- Up to 4 images per message

### 16. Voice Input ✓
Speech-to-text for prompts:
- Microphone button in input area
- Uses Web Speech API
- Real-time transcription
- Toggle on/off with visual indicator

---

### Conversation Management

#### 17. Save/Load Conversations
Persist conversations beyond the session:
- Save to localStorage or files
- Load previous conversations
- Auto-save option

#### 18. Multiple Conversation Threads
Work with multiple conversations:
- Tabbed interface
- Switch between threads
- Name/rename threads

#### 19. Branching Conversations
Fork from any point in history:
- Create alternative branches
- Compare different conversation paths
- Visual branch indicator

#### 20. Response Regeneration
Re-run a specific prompt:
- Regenerate button per response
- Compare with previous output
- Track regeneration count

---

### Analysis & Comparison

#### 21. Response Diff View
Highlight differences between outputs:
- Side-by-side diff display
- Word-level or character-level diff
- Toggle diff mode on/off

#### 22. Latency/Cost Charts
Visualize performance over time:
- Response time graphs
- Cost accumulation chart
- Per-provider comparison

#### 23. Context Window Usage
Show how much context is used:
- Token count per provider
- Visual progress bar
- Warning when near limit

#### 24. Automated Batch Testing
Run multiple prompts automatically:
- Upload test prompt file
- Run all prompts sequentially
- Export results as CSV/JSON

---

### Advanced Features

#### 25. Function/Tool Calling
Compare tool use across providers:
- Define custom tools
- Compare function call outputs
- Test structured responses

#### 26. JSON Mode Testing
Test structured output:
- JSON schema validation
- Compare output structure
- Format verification

#### 27. Prompt A/B Testing
Compare different prompts:
- Side-by-side prompt variants
- Same model, different prompts
- Statistical comparison

#### 28. Webhook Notifications
Send results externally:
- Slack integration
- Discord webhooks
- Custom webhook URL

---

### RAG Enhancements

### 29. Multiple Document Collections ✓
Organize documents into groups:
- Create named collections
- Switch between collections with dropdown
- Documents upload to selected collection
- RAG queries filter by selected collection
- Delete collection (removes all its documents)

---

## Planned Features

### RAG Enhancements (continued)

#### 30. Chunk Preview/Editing
Review chunks before upload:
- Preview extracted text
- Edit chunk boundaries
- Delete unwanted chunks

#### 31. Hybrid Search
Combine semantic and keyword search:
- BM25 + vector search
- Adjustable weighting
- Better precision for specific terms
