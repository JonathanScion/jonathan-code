# LLM Chat Tester

A web application to simultaneously chat with Claude, ChatGPT, and Gemini, displaying responses side-by-side.

## Features

- Single prompt input sends to all 3 LLMs in parallel
- Side-by-side response comparison (Claude | ChatGPT | Gemini)
- Configurable API parameters per provider:
  - Model selection
  - Temperature (0-1)
  - Max tokens
- Response timing display
- Dark mode UI

## Prerequisites

- Node.js 18+
- API keys for:
  - Anthropic (Claude)
  - OpenAI (ChatGPT)
  - Google AI (Gemini)

## Setup

1. **Clone and install dependencies:**

```bash
cd LLMChatTester

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

2. **Configure API keys:**

```bash
# From LLMChatTester root
cp .env.example .env
# Edit .env and add your API keys
```

3. **Start the servers:**

```bash
# Terminal 1 - Backend (from LLMChatTester/backend)
npm run dev

# Terminal 2 - Frontend (from LLMChatTester/frontend)
npm run dev
```

4. **Open the app:**

Navigate to http://localhost:5173

## Usage

1. Adjust API parameters for each provider (optional)
2. Type your prompt in the input area
3. Press Enter or click Send
4. View responses from all three LLMs side-by-side

## Project Structure

```
LLMChatTester/
├── frontend/          # React + TypeScript + Vite
│   └── src/
│       ├── components/
│       ├── hooks/
│       └── types/
├── backend/           # Node.js + Express
│   └── src/
│       ├── routes/
│       └── services/
├── .env.example
└── README.md
```

## Future Enhancements

- RAG document upload support
- Conversation history
- Response streaming
- Export/compare functionality
