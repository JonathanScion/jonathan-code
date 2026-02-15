# LLM Chat Tester - Feature Roadmap

## Current Features
- [x] Multi-LLM comparison (Claude, OpenAI/ChatGPT, Gemini) with streaming
- [x] Per-provider parameter tuning (temperature, topK, topP, max tokens, etc.)
- [x] Prompt templates
- [x] Rating controls for responses
- [x] RAG (Retrieval-Augmented Generation) with Pinecone + document upload
- [x] Per-user document collections
- [x] Image support in chat
- [x] Multi-user auth (Google OAuth + JWT)
- [x] Speech-to-text input
- [x] Health check endpoint (`/api/health`)

## Planned Features

### More Providers
- [ ] xAI (Grok) - Elon Musk's AI, own models (not Llama)
- [ ] Mistral
- [ ] DeepSeek
- [ ] Meta Llama (via Groq or Together AI)
- [ ] Perplexity

### Low Effort
- [ ] Conversation history persistence (save to DB, revisit past chats)
- [ ] Export chat as markdown/JSON
- [ ] Token cost display (estimated $ per response based on usage)

### Medium Effort
- [ ] System prompt management (save/load reusable system prompts)
- [ ] Response comparison tools (diff view, word count, readability, timing charts)
- [ ] Favorite/bookmark best responses

### Bigger Features
- [ ] Automated testing/benchmarks (run prompt lists through all models, score results)
- [ ] Sharing (public links to conversation comparisons)

## Architecture
- **Frontend**: React + Vite + Tailwind, deployed to `llmtester.jonathanscode.io` (Hostinger static)
- **Backend**: Express + TypeScript, deployed to `llmtester-api.jonathanscode.io` (Hostinger Node.js)
- **Database**: Neon PostgreSQL (users, collections, documents)
- **Vector DB**: Pinecone (RAG embeddings)
- **Embeddings**: Google `gemini-embedding-001` (3072 dimensions) - DO NOT change without re-indexing Pinecone
