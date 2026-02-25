import { fileURLToPath as __bundle_fileURLToPath } from 'url';
import { dirname as __bundle_dirname, join as __bundle_join } from 'path';
const __bundle_filename = __bundle_fileURLToPath(import.meta.url);
const __bundle_dirname_val = __bundle_dirname(__bundle_filename);
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/index.ts
import express from "express";
import cors from "cors";
import path4 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import dotenv from "dotenv";
import passport2 from "passport";

// src/routes/chat.ts
import { Router } from "express";

// src/services/claude.ts
import Anthropic from "@anthropic-ai/sdk";
function buildContentBlocks(prompt, images) {
  if (!images || images.length === 0) {
    return prompt;
  }
  const content = [];
  for (const img of images) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: img.mimeType,
        data: img.base64
      }
    });
  }
  if (prompt) {
    content.push({
      type: "text",
      text: prompt
    });
  }
  return content;
}
async function queryClaude(params) {
  const {
    prompt,
    images,
    model,
    temperature = 0.7,
    maxTokens = 1024,
    topK,
    topP,
    stopSequences,
    systemPrompt,
    messages = []
  } = params;
  if (!model) throw new Error("Claude model not specified");
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
  try {
    const allMessages = [
      ...messages,
      { role: "user", content: buildContentBlocks(prompt, images) }
    ];
    const requestParams = {
      model,
      max_tokens: maxTokens,
      temperature,
      messages: allMessages
    };
    if (systemPrompt) {
      requestParams.system = systemPrompt;
    }
    if (topK !== void 0) {
      requestParams.top_k = topK;
    }
    if (topP !== void 0) {
      requestParams.top_p = topP;
    }
    if (stopSequences && stopSequences.length > 0) {
      requestParams.stop_sequences = stopSequences;
    }
    const response = await client.messages.create(requestParams);
    const textBlock = response.content.find((block) => block.type === "text");
    return {
      text: textBlock ? textBlock.text : "No response",
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      }
    };
  } catch (error) {
    const err = error;
    throw new Error(`Claude API error: ${err.message}`);
  }
}
async function* streamClaude(params) {
  const {
    prompt,
    images,
    model,
    temperature = 0.7,
    maxTokens = 1024,
    topK,
    topP,
    stopSequences,
    systemPrompt,
    messages = []
  } = params;
  if (!model) throw new Error("Claude model not specified");
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
  const allMessages = [
    ...messages,
    { role: "user", content: buildContentBlocks(prompt, images) }
  ];
  const requestParams = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: allMessages
  };
  if (systemPrompt) {
    requestParams.system = systemPrompt;
  }
  if (topK !== void 0) {
    requestParams.top_k = topK;
  }
  if (topP !== void 0) {
    requestParams.top_p = topP;
  }
  if (stopSequences && stopSequences.length > 0) {
    requestParams.stop_sequences = stopSequences;
  }
  const stream = client.messages.stream(requestParams);
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield { type: "chunk", data: event.delta.text };
    }
  }
  const finalMessage = await stream.finalMessage();
  yield {
    type: "usage",
    data: {
      inputTokens: finalMessage.usage.input_tokens,
      outputTokens: finalMessage.usage.output_tokens
    }
  };
}

// src/services/openai.ts
import OpenAI from "openai";
function buildUserContent(prompt, images) {
  if (!images || images.length === 0) {
    return prompt;
  }
  const content = [];
  for (const img of images) {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${img.mimeType};base64,${img.base64}`
      }
    });
  }
  if (prompt) {
    content.push({
      type: "text",
      text: prompt
    });
  }
  return content;
}
async function queryChatGPT(params) {
  const {
    prompt,
    images,
    model,
    temperature = 0.7,
    maxTokens = 1024,
    topP,
    frequencyPenalty,
    presencePenalty,
    responseFormat,
    seed,
    systemPrompt,
    messages = []
  } = params;
  if (!model) throw new Error("OpenAI model not specified");
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  try {
    const allMessages = [];
    if (systemPrompt) {
      allMessages.push({ role: "system", content: systemPrompt });
    }
    for (const msg of messages) {
      allMessages.push({ role: msg.role, content: msg.content });
    }
    allMessages.push({ role: "user", content: buildUserContent(prompt, images) });
    const requestParams = {
      model,
      temperature,
      max_tokens: maxTokens,
      messages: allMessages
    };
    if (topP !== void 0) {
      requestParams.top_p = topP;
    }
    if (frequencyPenalty !== void 0) {
      requestParams.frequency_penalty = frequencyPenalty;
    }
    if (presencePenalty !== void 0) {
      requestParams.presence_penalty = presencePenalty;
    }
    if (responseFormat === "json_object") {
      requestParams.response_format = { type: "json_object" };
    }
    if (seed !== void 0) {
      requestParams.seed = seed;
    }
    const response = await client.chat.completions.create(requestParams);
    return {
      text: response.choices[0]?.message?.content || "No response",
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0
      }
    };
  } catch (error) {
    const err = error;
    throw new Error(`OpenAI API error: ${err.message}`);
  }
}
async function* streamChatGPT(params) {
  const {
    prompt,
    images,
    model,
    temperature = 0.7,
    maxTokens = 1024,
    topP,
    frequencyPenalty,
    presencePenalty,
    seed,
    systemPrompt,
    messages = []
  } = params;
  if (!model) throw new Error("OpenAI model not specified");
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  const allMessages = [];
  if (systemPrompt) {
    allMessages.push({ role: "system", content: systemPrompt });
  }
  for (const msg of messages) {
    allMessages.push({ role: msg.role, content: msg.content });
  }
  allMessages.push({ role: "user", content: buildUserContent(prompt, images) });
  const requestParams = {
    model,
    temperature,
    max_tokens: maxTokens,
    messages: allMessages,
    stream: true,
    stream_options: { include_usage: true }
  };
  if (topP !== void 0) {
    requestParams.top_p = topP;
  }
  if (frequencyPenalty !== void 0) {
    requestParams.frequency_penalty = frequencyPenalty;
  }
  if (presencePenalty !== void 0) {
    requestParams.presence_penalty = presencePenalty;
  }
  if (seed !== void 0) {
    requestParams.seed = seed;
  }
  const stream = await client.chat.completions.create(requestParams);
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield { type: "chunk", data: content };
    }
    if (chunk.usage) {
      yield {
        type: "usage",
        data: {
          inputTokens: chunk.usage.prompt_tokens || 0,
          outputTokens: chunk.usage.completion_tokens || 0
        }
      };
    }
  }
}

// src/services/gemini.ts
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
function buildMessageParts(prompt, images) {
  const parts = [];
  if (images) {
    for (const img of images) {
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.base64
        }
      });
    }
  }
  if (prompt) {
    parts.push({ text: prompt });
  }
  return parts;
}
function mapSafetyLevel(level) {
  switch (level) {
    case "BLOCK_NONE":
      return HarmBlockThreshold.BLOCK_NONE;
    case "BLOCK_ONLY_HIGH":
      return HarmBlockThreshold.BLOCK_ONLY_HIGH;
    case "BLOCK_MEDIUM_AND_ABOVE":
      return HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE;
    case "BLOCK_LOW_AND_ABOVE":
      return HarmBlockThreshold.BLOCK_LOW_AND_ABOVE;
    default:
      return HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE;
  }
}
function buildSafetySettings(settings) {
  if (!settings) return void 0;
  return [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: mapSafetyLevel(settings.harassment)
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: mapSafetyLevel(settings.hateSpeech)
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: mapSafetyLevel(settings.sexuallyExplicit)
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: mapSafetyLevel(settings.dangerousContent)
    }
  ];
}
async function queryGemini(params) {
  const {
    prompt,
    images,
    model,
    temperature = 0.7,
    maxTokens = 1024,
    topK,
    topP,
    stopSequences,
    safetySettings,
    systemPrompt,
    messages = []
  } = params;
  if (!model) throw new Error("Gemini model not specified");
  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");
    const generationConfig = {
      temperature,
      maxOutputTokens: maxTokens
    };
    if (topK !== void 0) {
      generationConfig.topK = topK;
    }
    if (topP !== void 0) {
      generationConfig.topP = topP;
    }
    if (stopSequences && stopSequences.length > 0) {
      generationConfig.stopSequences = stopSequences;
    }
    const modelConfig = {
      model,
      generationConfig,
      systemInstruction: systemPrompt,
      safetySettings: buildSafetySettings(safetySettings)
    };
    const geminiModel = genAI.getGenerativeModel(modelConfig);
    const history = messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));
    const chat = geminiModel.startChat({ history });
    const messageParts = buildMessageParts(prompt, images);
    const result = await chat.sendMessage(messageParts);
    const usageMetadata = result.response.usageMetadata;
    return {
      text: result.response.text(),
      usage: {
        inputTokens: usageMetadata?.promptTokenCount || 0,
        outputTokens: usageMetadata?.candidatesTokenCount || 0
      }
    };
  } catch (error) {
    const err = error;
    throw new Error(`Gemini API error: ${err.message}`);
  }
}
async function* streamGemini(params) {
  const {
    prompt,
    images,
    model,
    temperature = 0.7,
    maxTokens = 1024,
    topK,
    topP,
    stopSequences,
    safetySettings,
    systemPrompt,
    messages = []
  } = params;
  if (!model) throw new Error("Gemini model not specified");
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");
  const generationConfig = {
    temperature,
    maxOutputTokens: maxTokens
  };
  if (topK !== void 0) {
    generationConfig.topK = topK;
  }
  if (topP !== void 0) {
    generationConfig.topP = topP;
  }
  if (stopSequences && stopSequences.length > 0) {
    generationConfig.stopSequences = stopSequences;
  }
  const modelConfig = {
    model,
    generationConfig,
    systemInstruction: systemPrompt,
    safetySettings: buildSafetySettings(safetySettings)
  };
  const geminiModel = genAI.getGenerativeModel(modelConfig);
  const history = messages.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }]
  }));
  const chat = geminiModel.startChat({ history });
  const messageParts = buildMessageParts(prompt, images);
  const result = await chat.sendMessageStream(messageParts);
  for await (const chunk of result.stream) {
    const text2 = chunk.text();
    if (text2) {
      yield { type: "chunk", data: text2 };
    }
  }
  const response = await result.response;
  const usageMetadata = response.usageMetadata;
  yield {
    type: "usage",
    data: {
      inputTokens: usageMetadata?.promptTokenCount || 0,
      outputTokens: usageMetadata?.candidatesTokenCount || 0
    }
  };
}

// src/services/openai-compatible.ts
import OpenAI2 from "openai";
function createOpenAICompatibleProvider(config) {
  const { name, apiKeyEnv, baseURL } = config;
  async function query(params) {
    const {
      prompt,
      model,
      temperature = 0.7,
      maxTokens = 1024,
      topP,
      systemPrompt,
      messages = []
    } = params;
    if (!model) throw new Error(`${name} model not specified`);
    const apiKey2 = process.env[apiKeyEnv];
    if (!apiKey2) {
      throw new Error(`${name} API key not configured (${apiKeyEnv})`);
    }
    const client = new OpenAI2({ apiKey: apiKey2, baseURL });
    const allMessages = [];
    if (systemPrompt) {
      allMessages.push({ role: "system", content: systemPrompt });
    }
    for (const msg of messages) {
      allMessages.push({ role: msg.role, content: msg.content });
    }
    allMessages.push({ role: "user", content: prompt });
    const requestParams = {
      model,
      temperature,
      max_tokens: maxTokens,
      messages: allMessages
    };
    if (topP !== void 0) {
      requestParams.top_p = topP;
    }
    const response = await client.chat.completions.create(requestParams);
    let text2 = response.choices[0]?.message?.content || "No response";
    const citations = response.citations;
    if (citations && Array.isArray(citations) && citations.length > 0) {
      text2 += "\n\n**Sources:**\n" + citations.map((c, i) => `[${i + 1}] ${c}`).join("\n");
    }
    return {
      text: text2,
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0
      }
    };
  }
  async function* stream(params) {
    const {
      prompt,
      model,
      temperature = 0.7,
      maxTokens = 1024,
      topP,
      systemPrompt,
      messages = []
    } = params;
    if (!model) throw new Error(`${name} model not specified`);
    const apiKey2 = process.env[apiKeyEnv];
    if (!apiKey2) {
      throw new Error(`${name} API key not configured (${apiKeyEnv})`);
    }
    const client = new OpenAI2({ apiKey: apiKey2, baseURL });
    const allMessages = [];
    if (systemPrompt) {
      allMessages.push({ role: "system", content: systemPrompt });
    }
    for (const msg of messages) {
      allMessages.push({ role: msg.role, content: msg.content });
    }
    allMessages.push({ role: "user", content: prompt });
    const requestParams = {
      model,
      temperature,
      max_tokens: maxTokens,
      messages: allMessages,
      stream: true,
      stream_options: { include_usage: true }
    };
    if (topP !== void 0) {
      requestParams.top_p = topP;
    }
    const streamResponse = await client.chat.completions.create(requestParams);
    for await (const chunk of streamResponse) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield { type: "chunk", data: content };
      }
      if (chunk.usage) {
        yield {
          type: "usage",
          data: {
            inputTokens: chunk.usage.prompt_tokens || 0,
            outputTokens: chunk.usage.completion_tokens || 0
          }
        };
      }
    }
  }
  return { query, stream };
}
var xaiProvider = createOpenAICompatibleProvider({
  name: "xAI (Grok)",
  apiKeyEnv: "XAI_API_KEY",
  baseURL: "https://api.x.ai/v1"
});
var groqProvider = createOpenAICompatibleProvider({
  name: "Groq (Llama)",
  apiKeyEnv: "GROQ_API_KEY",
  baseURL: "https://api.groq.com/openai/v1"
});
var perplexityProvider = createOpenAICompatibleProvider({
  name: "Perplexity",
  apiKeyEnv: "PERPLEXITY_API_KEY",
  baseURL: "https://api.perplexity.ai"
});

// src/services/embeddings.ts
var EMBEDDING_MODEL = "gemini-embedding-001";
var API_BASE = "https://generativelanguage.googleapis.com/v1beta";
var apiKey = null;
function initEmbeddings() {
  if (!process.env.GOOGLE_AI_API_KEY) {
    console.warn("GOOGLE_AI_API_KEY not set - embeddings will be disabled");
    return;
  }
  apiKey = process.env.GOOGLE_AI_API_KEY;
  console.log(`Embeddings initialized with model: ${EMBEDDING_MODEL}`);
}
function isEmbeddingsEnabled() {
  return apiKey !== null;
}
async function generateEmbedding(text2) {
  if (!apiKey) {
    throw new Error("Google AI API key not initialized");
  }
  const url = `${API_BASE}/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: { parts: [{ text: text2 }] }
    })
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding API error: ${response.status} - ${error}`);
  }
  const data = await response.json();
  return data.embedding.values;
}
async function generateEmbeddings(texts) {
  if (!apiKey) {
    throw new Error("Google AI API key not initialized");
  }
  if (texts.length === 0) {
    return [];
  }
  const embeddings = await Promise.all(
    texts.map((text2) => generateEmbedding(text2))
  );
  return embeddings;
}

// src/services/pinecone.ts
import { Pinecone } from "@pinecone-database/pinecone";
var pineconeClient = null;
var indexName = null;
function initPinecone() {
  if (!process.env.PINECONE_API_KEY) {
    console.warn("PINECONE_API_KEY not set - RAG features will be disabled");
    return;
  }
  pineconeClient = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
  });
  indexName = process.env.PINECONE_INDEX || "llm-chat-tester";
  console.log(`Pinecone initialized with index: ${indexName}`);
}
function getIndex() {
  if (!pineconeClient || !indexName) {
    throw new Error("Pinecone not initialized");
  }
  return pineconeClient.index(indexName);
}
function isPineconeEnabled() {
  return pineconeClient !== null && indexName !== null;
}
function getUserNamespace(userId) {
  return `user-${userId}`;
}
async function upsertVectors(userId, vectors) {
  const index = getIndex();
  const namespace = getUserNamespace(userId);
  const batchSize = 100;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    await index.namespace(namespace).upsert({
      records: batch.map((v) => ({
        id: v.id,
        values: v.values,
        metadata: v.metadata
      }))
    });
  }
}
async function queryVectors(userId, queryVector, topK = 5, collectionId) {
  const index = getIndex();
  const namespace = getUserNamespace(userId);
  const queryParams = {
    vector: queryVector,
    topK,
    includeMetadata: true
  };
  if (collectionId) {
    queryParams.filter = { collectionId: { $eq: collectionId } };
  }
  const results = await index.namespace(namespace).query(queryParams);
  return (results.matches || []).map((match) => ({
    id: match.id,
    score: match.score || 0,
    text: match.metadata?.text || "",
    documentName: match.metadata?.documentName || "",
    documentId: match.metadata?.documentId || "",
    collectionId: match.metadata?.collectionId || "",
    chunkIndex: match.metadata?.chunkIndex || 0
  }));
}
async function deleteByDocumentId(userId, documentId) {
  const index = getIndex();
  const namespace = getUserNamespace(userId);
  await index.namespace(namespace).deleteMany({
    filter: { documentId: { $eq: documentId } }
  });
}
async function deleteByCollectionId(userId, collectionId) {
  const index = getIndex();
  const namespace = getUserNamespace(userId);
  await index.namespace(namespace).deleteMany({
    filter: { collectionId: { $eq: collectionId } }
  });
}
async function deleteUserNamespace(userId) {
  const index = getIndex();
  const namespace = getUserNamespace(userId);
  await index.namespace(namespace).deleteAll();
}

// src/services/auth.ts
import jwt from "jsonwebtoken";
var JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
var JWT_EXPIRES_IN = "24h";
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// src/middleware/requireAuth.ts
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "No token provided" });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  req.user = payload;
  next();
}

// src/routes/chat.ts
var chatRouter = Router();
chatRouter.use(requireAuth);
function buildRagContext(results) {
  if (results.length === 0) return "";
  const contextParts = results.map(
    (r, idx) => `[Source ${idx + 1}: ${r.documentName}]
${r.text}`
  );
  return `

--- Relevant Context from Documents ---
${contextParts.join("\n\n")}
--- End Context ---

`;
}
function injectRagContext(prompt, context) {
  if (!context) return prompt;
  return `${context}Based on the above context (if relevant), please answer the following:

${prompt}`;
}
var PROVIDER_DISPATCH = {
  claude: { query: queryClaude, stream: streamClaude },
  openai: { query: queryChatGPT, stream: streamChatGPT },
  gemini: { query: queryGemini, stream: streamGemini },
  xai: { query: xaiProvider.query, stream: xaiProvider.stream },
  groq: { query: groqProvider.query, stream: groqProvider.stream },
  perplexity: { query: perplexityProvider.query, stream: perplexityProvider.stream }
};
var DEFAULT_ENABLED = ["claude", "openai", "gemini"];
chatRouter.post("/", async (req, res) => {
  const authReq = req;
  const userId = authReq.user.userId;
  const {
    prompt,
    enabledProviders = DEFAULT_ENABLED,
    claude = {},
    openai = {},
    gemini = {},
    xai = {},
    groq = {},
    perplexity = {},
    history,
    useRag = false,
    ragTopK = 5,
    ragCollectionId
  } = req.body;
  if (!prompt) {
    res.status(400).json({ error: "Prompt is required" });
    return;
  }
  let ragContext = "";
  let ragResults = [];
  if (useRag && isPineconeEnabled() && isEmbeddingsEnabled()) {
    try {
      const queryEmbedding = await generateEmbedding(prompt);
      ragResults = await queryVectors(userId, queryEmbedding, ragTopK, ragCollectionId);
      ragContext = buildRagContext(ragResults);
    } catch (error) {
      console.error("RAG query error:", error);
    }
  }
  const augmentedPrompt = injectRagContext(prompt, ragContext);
  const providerParams = { claude, openai, gemini, xai, groq, perplexity };
  const executeWithTiming = async (fn) => {
    const start = Date.now();
    try {
      const result = await fn();
      return {
        response: result.text,
        error: null,
        duration: Date.now() - start,
        usage: result.usage
      };
    } catch (error) {
      const err = error;
      return {
        response: null,
        error: err.message,
        duration: Date.now() - start
      };
    }
  };
  const results = {};
  const promises = enabledProviders.map(async (provider) => {
    const dispatch = PROVIDER_DISPATCH[provider];
    if (!dispatch) return;
    const params = providerParams[provider] || {};
    results[provider] = await executeWithTiming(
      () => dispatch.query({ prompt: augmentedPrompt, ...params, messages: history?.[provider] })
    );
  });
  await Promise.all(promises);
  const allProviders = ["claude", "openai", "gemini", "xai", "groq", "perplexity"];
  for (const p of allProviders) {
    if (!results[p]) {
      results[p] = { response: null, error: null, duration: 0 };
    }
  }
  res.json({
    ...results,
    ragContext: useRag ? ragResults : void 0
  });
});
chatRouter.post("/stream", async (req, res) => {
  const authReq = req;
  const userId = authReq.user.userId;
  const {
    prompt,
    images,
    enabledProviders = DEFAULT_ENABLED,
    claude = {},
    openai = {},
    gemini = {},
    xai = {},
    groq = {},
    perplexity = {},
    history,
    useRag = false,
    ragTopK = 5,
    ragCollectionId
  } = req.body;
  if (!prompt && (!images || images.length === 0)) {
    res.status(400).json({ error: "Prompt or images are required" });
    return;
  }
  let ragContext = "";
  let ragResults = [];
  if (useRag && isPineconeEnabled() && isEmbeddingsEnabled()) {
    try {
      const queryEmbedding = await generateEmbedding(prompt);
      ragResults = await queryVectors(userId, queryEmbedding, ragTopK, ragCollectionId);
      ragContext = buildRagContext(ragResults);
    } catch (error) {
      console.error("RAG query error:", error);
    }
  }
  const augmentedPrompt = injectRagContext(prompt, ragContext);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  if (useRag && ragResults.length > 0) {
    res.write(`data: ${JSON.stringify({ type: "rag", data: ragResults })}

`);
  }
  const sendEvent = (provider, type, data) => {
    res.write(`data: ${JSON.stringify({ provider, type, data })}

`);
  };
  const providerParams = { claude, openai, gemini, xai, groq, perplexity };
  const streamProvider = async (name) => {
    const dispatch = PROVIDER_DISPATCH[name];
    if (!dispatch) return;
    const params = providerParams[name] || {};
    const startTime = Date.now();
    try {
      for await (const result of dispatch.stream({
        prompt: augmentedPrompt,
        images: name === "claude" || name === "openai" || name === "gemini" ? images : void 0,
        ...params,
        messages: history?.[name]
      })) {
        if (result.type === "chunk") {
          sendEvent(name, "chunk", result.data);
        } else if (result.type === "usage") {
          sendEvent(name, "usage", result.data);
        }
      }
      const duration = Date.now() - startTime;
      sendEvent(name, "done", String(duration));
    } catch (error) {
      const err = error;
      sendEvent(name, "error", err.message);
    }
  };
  await Promise.all(enabledProviders.map((p) => streamProvider(p)));
  res.write("data: [DONE]\n\n");
  res.end();
});

// src/routes/rag.ts
import { Router as Router2 } from "express";
import multer from "multer";
import path3 from "path";
import { eq, and } from "drizzle-orm";

// src/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  collections: () => collections,
  documents: () => documents,
  users: () => users
});
import { pgTable, uuid, varchar, timestamp, integer } from "drizzle-orm/pg-core";
var users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  provider: varchar("provider", { length: 50 }).notNull(),
  // 'google'
  providerId: varchar("provider_id", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at").defaultNow().notNull()
});
var collections = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  collectionId: uuid("collection_id").notNull().references(() => collections.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  size: integer("size").notNull(),
  chunkCount: integer("chunk_count").notNull().default(0),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull()
});

// src/db/index.ts
var db = null;
function initDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn("DATABASE_URL not set - database features will be disabled");
    return;
  }
  const client = postgres(connectionString, {
    ssl: "require",
    max: 10
    // Connection pool size
  });
  db = drizzle(client, { schema: schema_exports });
  console.log("Database connection initialized");
}
function getDb() {
  if (!db) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return db;
}
function isDatabaseEnabled() {
  return db !== null;
}

// src/services/documents.ts
import { extractText as extractPdfText } from "unpdf";
import mammoth from "mammoth";
import path from "path";
import { randomUUID } from "crypto";
var CHUNK_SIZE = 1e3;
var CHUNK_OVERLAP = 200;
async function extractText(buffer, mimeType, filename) {
  const ext = path.extname(filename).toLowerCase();
  if (mimeType === "application/pdf" || ext === ".pdf") {
    const { text: text2 } = await extractPdfText(buffer);
    return Array.isArray(text2) ? text2.join("\n") : text2;
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || ext === ".docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  if (mimeType === "text/plain" || mimeType === "text/markdown" || ext === ".txt" || ext === ".md") {
    return buffer.toString("utf-8");
  }
  throw new Error(`Unsupported file type: ${mimeType || ext}`);
}
function chunkText(text2) {
  const chunks = [];
  const cleanedText = text2.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (cleanedText.length <= CHUNK_SIZE) {
    return [{ text: cleanedText, chunkIndex: 0 }];
  }
  let start = 0;
  let chunkIndex = 0;
  while (start < cleanedText.length) {
    let end = start + CHUNK_SIZE;
    if (end < cleanedText.length) {
      const searchStart = Math.max(start + CHUNK_SIZE - 100, start);
      const searchText = cleanedText.slice(searchStart, end + 50);
      const paragraphBreak = searchText.lastIndexOf("\n\n");
      if (paragraphBreak > 50) {
        end = searchStart + paragraphBreak + 2;
      } else {
        const sentenceEnd = searchText.search(/[.!?]\s/);
        if (sentenceEnd > 50) {
          end = searchStart + sentenceEnd + 2;
        } else {
          const spaceIndex = searchText.lastIndexOf(" ");
          if (spaceIndex > 50) {
            end = searchStart + spaceIndex + 1;
          }
        }
      }
    }
    const chunkText2 = cleanedText.slice(start, end).trim();
    if (chunkText2.length > 0) {
      chunks.push({ text: chunkText2, chunkIndex });
      chunkIndex++;
    }
    start = end - CHUNK_OVERLAP;
    if (start >= cleanedText.length - CHUNK_OVERLAP) {
      break;
    }
  }
  return chunks;
}
function generateDocumentId() {
  return randomUUID();
}

// src/services/fileStorage.ts
import fs from "fs/promises";
import path2 from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var UPLOADS_DIR = process.env.UPLOADS_DIR || __bundle_join(__bundle_dirname_val, "uploads");
async function ensureDir(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}
function getUserUploadsDir(userId) {
  return path2.join(UPLOADS_DIR, userId);
}
async function saveFile(userId, documentId, buffer, originalName) {
  const userDir = getUserUploadsDir(userId);
  await ensureDir(userDir);
  const ext = path2.extname(originalName).toLowerCase();
  const fileName = `${documentId}${ext}`;
  const filePath = path2.join(userDir, fileName);
  await fs.writeFile(filePath, buffer);
  return filePath;
}
async function getFile(filePath) {
  return fs.readFile(filePath);
}
async function deleteFile(filePath) {
  try {
    await fs.unlink(filePath);
  } catch {
  }
}
async function deleteUserFiles(userId) {
  const userDir = getUserUploadsDir(userId);
  try {
    await fs.rm(userDir, { recursive: true, force: true });
  } catch {
  }
}

// src/routes/rag.ts
var ragRouter = Router2();
var upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
    // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/markdown"
    ];
    const allowedExtensions = [".pdf", ".docx", ".txt", ".md"];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf("."));
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  }
});
ragRouter.get("/status", (_req, res) => {
  res.json({
    enabled: isPineconeEnabled() && isEmbeddingsEnabled() && isDatabaseEnabled(),
    pinecone: isPineconeEnabled(),
    embeddings: isEmbeddingsEnabled(),
    database: isDatabaseEnabled()
  });
});
ragRouter.use(requireAuth);
ragRouter.get("/collections", async (req, res) => {
  try {
    const authReq = req;
    const userId = authReq.user.userId;
    const db2 = getDb();
    const userCollections = await db2.query.collections.findMany({
      where: eq(collections.userId, userId),
      orderBy: (collections2, { asc }) => [asc(collections2.createdAt)]
    });
    res.json({ collections: userCollections });
  } catch (error) {
    const err = error;
    res.status(500).json({ error: err.message });
  }
});
ragRouter.post("/collections", async (req, res) => {
  try {
    const authReq = req;
    const userId = authReq.user.userId;
    const { name } = req.body;
    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "Collection name is required" });
      return;
    }
    const db2 = getDb();
    const [newCollection] = await db2.insert(collections).values({
      userId,
      name: name.trim()
    }).returning();
    res.json({ collection: newCollection });
  } catch (error) {
    const err = error;
    res.status(500).json({ error: err.message });
  }
});
ragRouter.put("/collections/:id", async (req, res) => {
  try {
    const authReq = req;
    const userId = authReq.user.userId;
    const { id } = req.params;
    const { name } = req.body;
    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "Collection name is required" });
      return;
    }
    const db2 = getDb();
    const result = await db2.update(collections).set({ name: name.trim() }).where(and(eq(collections.id, id), eq(collections.userId, userId))).returning();
    if (result.length === 0) {
      res.status(404).json({ error: "Collection not found" });
      return;
    }
    res.json({ success: true, collection: result[0] });
  } catch (error) {
    const err = error;
    res.status(500).json({ error: err.message });
  }
});
ragRouter.delete("/collections/:id", async (req, res) => {
  try {
    const authReq = req;
    const userId = authReq.user.userId;
    const { id } = req.params;
    const db2 = getDb();
    const collectionDocs = await db2.query.documents.findMany({
      where: and(eq(documents.collectionId, id), eq(documents.userId, userId))
    });
    if (isPineconeEnabled()) {
      await deleteByCollectionId(userId, id);
    }
    for (const doc of collectionDocs) {
      await deleteFile(doc.filePath);
    }
    const result = await db2.delete(collections).where(and(eq(collections.id, id), eq(collections.userId, userId))).returning();
    if (result.length === 0) {
      res.status(404).json({ error: "Collection not found" });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    const err = error;
    res.status(500).json({ error: err.message });
  }
});
ragRouter.get("/documents", async (req, res) => {
  try {
    const authReq = req;
    const userId = authReq.user.userId;
    const { collectionId } = req.query;
    const db2 = getDb();
    let userDocuments;
    if (collectionId && typeof collectionId === "string") {
      userDocuments = await db2.query.documents.findMany({
        where: and(eq(documents.userId, userId), eq(documents.collectionId, collectionId)),
        orderBy: (documents2, { desc }) => [desc(documents2.uploadedAt)]
      });
    } else {
      userDocuments = await db2.query.documents.findMany({
        where: eq(documents.userId, userId),
        orderBy: (documents2, { desc }) => [desc(documents2.uploadedAt)]
      });
    }
    res.json({ documents: userDocuments });
  } catch (error) {
    const err = error;
    res.status(500).json({ error: err.message });
  }
});
ragRouter.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const authReq = req;
    const userId = authReq.user.userId;
    if (!isPineconeEnabled() || !isEmbeddingsEnabled()) {
      res.status(503).json({ error: "RAG services not configured" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }
    const file = req.file;
    const collectionId = req.body.collectionId;
    if (!collectionId) {
      res.status(400).json({ error: "Collection ID is required" });
      return;
    }
    const db2 = getDb();
    const collection = await db2.query.collections.findFirst({
      where: and(eq(collections.id, collectionId), eq(collections.userId, userId))
    });
    if (!collection) {
      res.status(404).json({ error: "Collection not found" });
      return;
    }
    const docCount = await db2.query.documents.findMany({
      where: eq(documents.userId, userId)
    });
    if (docCount.length >= 100) {
      res.status(400).json({ error: "Document limit reached (100 documents max)" });
      return;
    }
    const documentId = generateDocumentId();
    const text2 = await extractText(file.buffer, file.mimetype, file.originalname);
    if (!text2.trim()) {
      res.status(400).json({ error: "Could not extract text from document" });
      return;
    }
    const filePath = await saveFile(userId, documentId, file.buffer, file.originalname);
    const chunks = chunkText(text2);
    const chunkTexts = chunks.map((c) => c.text);
    const embeddings = await generateEmbeddings(chunkTexts);
    const vectors = chunks.map((chunk, idx) => ({
      id: `${documentId}_chunk_${chunk.chunkIndex}`,
      values: embeddings[idx],
      metadata: {
        documentId,
        documentName: file.originalname,
        collectionId,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text
      }
    }));
    await upsertVectors(userId, vectors);
    const [newDocument] = await db2.insert(documents).values({
      id: documentId,
      userId,
      collectionId,
      name: file.originalname,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      chunkCount: chunks.length,
      filePath
    }).returning();
    res.json({
      success: true,
      document: newDocument,
      message: `Document processed: ${chunks.length} chunks created`
    });
  } catch (error) {
    const err = error;
    console.error("Upload error:", err);
    res.status(500).json({ error: err.message });
  }
});
ragRouter.get("/documents/:id/download", async (req, res) => {
  try {
    const authReq = req;
    const userId = authReq.user.userId;
    const { id } = req.params;
    const db2 = getDb();
    const doc = await db2.query.documents.findFirst({
      where: and(eq(documents.id, id), eq(documents.userId, userId))
    });
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    const fileBuffer = await getFile(doc.filePath);
    const ext = path3.extname(doc.originalName);
    res.setHeader("Content-Disposition", `attachment; filename="${doc.originalName}"`);
    res.setHeader("Content-Type", doc.mimeType);
    res.send(fileBuffer);
  } catch (error) {
    const err = error;
    res.status(500).json({ error: err.message });
  }
});
ragRouter.delete("/documents/:id", async (req, res) => {
  try {
    const authReq = req;
    const userId = authReq.user.userId;
    const { id } = req.params;
    if (!isPineconeEnabled()) {
      res.status(503).json({ error: "RAG services not configured" });
      return;
    }
    const db2 = getDb();
    const doc = await db2.query.documents.findFirst({
      where: and(eq(documents.id, id), eq(documents.userId, userId))
    });
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    await deleteByDocumentId(userId, id);
    await deleteFile(doc.filePath);
    await db2.delete(documents).where(eq(documents.id, id));
    res.json({ success: true, message: "Document deleted" });
  } catch (error) {
    const err = error;
    res.status(500).json({ error: err.message });
  }
});
ragRouter.post("/query", async (req, res) => {
  try {
    const authReq = req;
    const userId = authReq.user.userId;
    const { query, topK = 5, collectionId } = req.body;
    if (!query) {
      res.status(400).json({ error: "Query is required" });
      return;
    }
    if (!isPineconeEnabled() || !isEmbeddingsEnabled()) {
      res.status(503).json({ error: "RAG services not configured" });
      return;
    }
    const queryEmbedding = await generateEmbedding(query);
    const results = await queryVectors(userId, queryEmbedding, topK, collectionId);
    res.json({ results });
  } catch (error) {
    const err = error;
    res.status(500).json({ error: err.message });
  }
});

// src/routes/auth.ts
import { Router as Router3 } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { eq as eq2 } from "drizzle-orm";
var authRouter = Router3();
function initPassport() {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL = process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback";
  if (!clientID || !clientSecret) {
    console.warn("Google OAuth not configured - GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing");
    return;
  }
  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error("No email from Google"));
          }
          const db2 = getDb();
          let user = await db2.query.users.findFirst({
            where: eq2(users.email, email)
          });
          if (!user) {
            const [newUser] = await db2.insert(users).values({
              email,
              name: profile.displayName || null,
              avatarUrl: profile.photos?.[0]?.value || null,
              provider: "google",
              providerId: profile.id
            }).returning();
            await db2.insert(collections).values({
              userId: newUser.id,
              name: "Default"
            });
            user = newUser;
            console.log(`New user created: ${email}`);
          } else {
            await db2.update(users).set({ lastLoginAt: /* @__PURE__ */ new Date() }).where(eq2(users.id, user.id));
          }
          done(null, {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl
          });
        } catch (err) {
          done(err);
        }
      }
    )
  );
  console.log("Google OAuth initialized");
}
authRouter.get("/google", (req, res, next) => {
  if (!passport._strategy("google")) {
    res.status(503).json({ error: "Google OAuth not configured on server" });
    return;
  }
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false
  })(req, res, next);
});
authRouter.get(
  "/google/callback",
  (req, res, next) => {
    passport.authenticate("google", {
      session: false,
      failureRedirect: "/login?error=auth_failed"
    })(req, res, next);
  },
  (req, res) => {
    const user = req.user;
    const token = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name
    });
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  }
);
authRouter.get("/me", requireAuth, async (req, res) => {
  try {
    const db2 = getDb();
    const authReq = req;
    const user = await db2.query.users.findFirst({
      where: eq2(users.id, authReq.user.userId)
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    const err = error;
    res.status(500).json({ error: err.message });
  }
});
authRouter.post("/logout", (_req, res) => {
  res.json({ success: true });
});
authRouter.delete("/account", requireAuth, async (req, res) => {
  try {
    const db2 = getDb();
    const authReq = req;
    const userId = authReq.user.userId;
    if (isPineconeEnabled()) {
      try {
        await deleteUserNamespace(userId);
      } catch (error) {
        console.error("Failed to delete Pinecone namespace:", error);
      }
    }
    try {
      await deleteUserFiles(userId);
    } catch (error) {
      console.error("Failed to delete user files:", error);
    }
    await db2.delete(users).where(eq2(users.id, userId));
    res.json({ success: true, message: "Account deleted" });
  } catch (error) {
    const err = error;
    res.status(500).json({ error: err.message });
  }
});

// src/services/modelFetcher.ts
import Anthropic2 from "@anthropic-ai/sdk";
import OpenAI3 from "openai";
var cache = /* @__PURE__ */ new Map();
var CACHE_TTL = 5 * 60 * 1e3;
var ERROR_BACKOFF = 60 * 1e3;
function getCached(provider) {
  const entry = cache.get(provider);
  if (!entry) return null;
  const ttl = entry.isError ? ERROR_BACKOFF : CACHE_TTL;
  if (Date.now() - entry.fetchedAt > ttl) return null;
  return entry.models;
}
function setCache(provider, models, isError = false) {
  cache.set(provider, { models, fetchedAt: Date.now(), isError });
}
var PREFERRED_ORDER = {
  claude: ["claude-sonnet-4-6", "claude-sonnet-4-5-20250929", "claude-opus-4-6", "claude-haiku-4-5-20251001"],
  openai: ["gpt-4o", "gpt-4o-mini", "o4-mini", "o3-mini", "gpt-4-turbo"],
  gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
  xai: ["grok-4-0709", "grok-3", "grok-3-mini"],
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "qwen/qwen3-32b"],
  perplexity: ["sonar", "sonar-pro", "sonar-reasoning", "sonar-reasoning-pro", "sonar-deep-research"]
};
function sortModels(provider, models) {
  const preferred = PREFERRED_ORDER[provider] || [];
  const preferredSet = new Set(preferred);
  const top = preferred.filter((m) => models.includes(m));
  const rest = models.filter((m) => !preferredSet.has(m)).sort().reverse();
  return [...top, ...rest];
}
async function fetchClaudeModels() {
  const apiKey2 = process.env.ANTHROPIC_API_KEY;
  if (!apiKey2) return [];
  const client = new Anthropic2({ apiKey: apiKey2 });
  const response = await client.models.list({ limit: 100 });
  const models = response.data.map((m) => m.id);
  return sortModels("claude", models);
}
async function fetchOpenAIModels() {
  const apiKey2 = process.env.OPENAI_API_KEY;
  if (!apiKey2) return [];
  const client = new OpenAI3({ apiKey: apiKey2 });
  const response = await client.models.list();
  const allModels = [];
  for await (const model of response) {
    allModels.push(model.id);
  }
  const includePatterns = [/^gpt-[345]/, /^gpt-4o/, /^o[134]-/];
  const excludePatterns = [
    /instruct/i,
    /realtime/i,
    /audio/i,
    /embedding/i,
    /dall-e/i,
    /whisper/i,
    /tts/i,
    /babbage/i,
    /davinci/i,
    /image/i,
    /sora/i,
    /codex/i,
    /search/i,
    /transcribe/i,
    /deep-research/i,
    /moderation/i,
    /diarize/i
  ];
  const filtered = allModels.filter((id) => includePatterns.some((p) => p.test(id))).filter((id) => !excludePatterns.some((p) => p.test(id)));
  return sortModels("openai", filtered);
}
async function fetchGeminiModels() {
  const apiKey2 = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey2) return [];
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey2}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gemini list models: ${res.status}`);
  const data = await res.json();
  const excludePatterns = [
    /embedding/i,
    /aqa/i,
    /bison/i,
    /image/i,
    /tts/i,
    /robotics/i,
    /computer-use/i,
    /gemma/i,
    /nano-/i,
    /deep-research/i,
    /customtools/i
  ];
  const filtered = data.models.filter((m) => m.supportedGenerationMethods?.includes("generateContent")).map((m) => m.name.replace("models/", "")).filter((id) => id.startsWith("gemini-")).filter((id) => !excludePatterns.some((p) => p.test(id)));
  return sortModels("gemini", filtered);
}
async function fetchXAIModels() {
  const apiKey2 = process.env.XAI_API_KEY;
  if (!apiKey2) return [];
  const client = new OpenAI3({ apiKey: apiKey2, baseURL: "https://api.x.ai/v1" });
  const response = await client.models.list();
  const allModels = [];
  for await (const model of response) {
    allModels.push(model.id);
  }
  const excludePatterns = [/embedding/i, /image/i, /imagine/i, /vision/i, /video/i];
  const filtered = allModels.filter((id) => id.startsWith("grok-")).filter((id) => !excludePatterns.some((p) => p.test(id)));
  return sortModels("xai", filtered);
}
async function fetchGroqModels() {
  const apiKey2 = process.env.GROQ_API_KEY;
  if (!apiKey2) return [];
  const client = new OpenAI3({ apiKey: apiKey2, baseURL: "https://api.groq.com/openai/v1" });
  const response = await client.models.list();
  const allModels = [];
  for await (const model of response) {
    allModels.push(model.id);
  }
  const includePatterns = [
    /^llama-/,
    /^meta-llama\/llama-4/,
    /^mixtral-/,
    /^gemma-/,
    /^deepseek-/,
    /^qwen/,
    /^moonshotai\/kimi/,
    /^openai\/gpt-oss-(?!safeguard)/
  ];
  const excludePatterns = [/whisper/i, /distil/i, /guard/i, /orpheus/i, /compound/i, /allam/i];
  const filtered = allModels.filter((id) => includePatterns.some((p) => p.test(id))).filter((id) => !excludePatterns.some((p) => p.test(id)));
  return sortModels("groq", filtered);
}
async function fetchPerplexityModels() {
  return ["sonar-deep-research", "sonar-reasoning-pro", "sonar-reasoning", "sonar-pro", "sonar"];
}
var fetchers = {
  claude: fetchClaudeModels,
  openai: fetchOpenAIModels,
  gemini: fetchGeminiModels,
  xai: fetchXAIModels,
  groq: fetchGroqModels,
  perplexity: fetchPerplexityModels
};
var apiKeyEnvVars = {
  claude: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  gemini: "GOOGLE_AI_API_KEY",
  xai: "XAI_API_KEY",
  groq: "GROQ_API_KEY",
  perplexity: "PERPLEXITY_API_KEY"
};
var MODEL_PRICING = {
  // Claude
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-sonnet-4-5-20250929": { input: 3, output: 15 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
  "claude-opus-4-20250514": { input: 15, output: 75 },
  "claude-opus-4-1-20250805": { input: 15, output: 75 },
  "claude-opus-4-5-20251101": { input: 15, output: 75 },
  "claude-opus-4-6": { input: 15, output: 75 },
  "claude-3-haiku-20240307": { input: 0.25, output: 1.25 },
  // OpenAI
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4-turbo": { input: 10, output: 30 },
  "gpt-4": { input: 30, output: 60 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
  "gpt-3.5-turbo": { input: 0.5, output: 1.5 },
  "o1": { input: 15, output: 60 },
  "o3": { input: 10, output: 40 },
  "o3-mini": { input: 1.1, output: 4.4 },
  "o4-mini": { input: 1.1, output: 4.4 },
  // Gemini
  "gemini-2.5-flash": { input: 0.15, output: 0.6 },
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "gemini-2.0-flash-lite": { input: 0.075, output: 0.3 },
  // xAI (Grok)
  "grok-3": { input: 3, output: 15 },
  "grok-3-mini": { input: 0.3, output: 0.5 },
  "grok-4-0709": { input: 3, output: 15 },
  // Groq (Llama)
  "llama-3.3-70b-versatile": { input: 0.59, output: 0.79 },
  "llama-3.1-8b-instant": { input: 0.05, output: 0.08 },
  "mixtral-8x7b-32768": { input: 0.24, output: 0.24 },
  // Perplexity
  "sonar": { input: 1, output: 1 },
  "sonar-pro": { input: 3, output: 15 },
  "sonar-reasoning": { input: 1, output: 5 },
  "sonar-reasoning-pro": { input: 2, output: 8 },
  "sonar-deep-research": { input: 2, output: 8 }
};
async function getAllModels() {
  const providers = Object.keys(fetchers);
  const results = {};
  await Promise.all(
    providers.map(async (provider) => {
      if (provider !== "perplexity" && !process.env[apiKeyEnvVars[provider]]) {
        results[provider] = [];
        return;
      }
      const cached = getCached(provider);
      if (cached !== null) {
        results[provider] = cached;
        return;
      }
      try {
        const models = await fetchers[provider]();
        setCache(provider, models);
        results[provider] = models;
      } catch (err) {
        console.error(`Failed to fetch models for ${provider}:`, err instanceof Error ? err.message : err);
        setCache(provider, [], true);
        results[provider] = [];
      }
    })
  );
  return results;
}

// src/index.ts
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path4.dirname(__filename2);
dotenv.config({ path: __bundle_join(__bundle_dirname_val, ".env") });
dotenv.config({ path: __bundle_join(__bundle_dirname_val, ".env") });
dotenv.config();
initDatabase();
initPinecone();
initEmbeddings();
if (isDatabaseEnabled()) {
  initPassport();
}
var app = express();
var PORT = process.env.PORT || 3001;
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(passport2.initialize());
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    database: isDatabaseEnabled()
  });
});
app.get("/api/providers", (_req, res) => {
  res.json({
    claude: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    gemini: !!process.env.GOOGLE_AI_API_KEY,
    xai: !!process.env.XAI_API_KEY,
    groq: !!process.env.GROQ_API_KEY,
    perplexity: !!process.env.PERPLEXITY_API_KEY
  });
});
app.get("/api/providers/models", async (_req, res) => {
  try {
    const models = await getAllModels();
    res.json({ models, pricing: MODEL_PRICING });
  } catch (err) {
    console.error("Failed to fetch models:", err);
    res.status(500).json({ error: "Failed to fetch models" });
  }
});
app.use("/api/auth", authRouter);
app.use("/api/chat", chatRouter);
app.use("/api/rag", ragRouter);
var publicPath = __bundle_join(__bundle_dirname_val, "public");
app.use(express.static(publicPath));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.sendFile(path4.join(publicPath, "index.html"));
});
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
