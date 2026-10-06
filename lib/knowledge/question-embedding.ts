import "server-only";

import OpenAI from "openai";
import { KNOWLEDGE_EMBEDDING_DIMENSIONS, KNOWLEDGE_EMBEDDING_MODEL } from "./embedding";

/*
 * A reader's question as a vector, to search knowledge_passages with.
 *
 * Embedded with exactly the model and size the loader embedded the passages
 * with (lib/knowledge/embedding.ts), or the distances mean nothing. The key
 * is the one palm reading's fallback already uses, so this needs nothing new
 * in the deployment.
 *
 * The questions are a fixed set today (lib/knowledge/ask-questions.ts), so a
 * process embeds each one once and keeps it: a question costs one embedding
 * call per cold start, about a millionth of a dollar, and none after.
 */

const MAX_CACHED = 200;
const cache = new Map<string, number[]>();
const inFlight = new Map<string, Promise<number[]>>();

/* Embedding is a short call; a slow one should give up and let the route fall back. */
const TIMEOUT_MS = 8_000;

export class QuestionEmbeddingUnavailable extends Error {}

export async function embedQuestion(text: string): Promise<number[]> {
  const cached = cache.get(text);
  if (cached) return cached;

  let pending = inFlight.get(text);
  if (!pending) {
    pending = request(text).finally(() => inFlight.delete(text));
    inFlight.set(text, pending);
  }
  const vector = await pending;
  if (cache.size >= MAX_CACHED) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(text, vector);
  return vector;
}

async function request(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new QuestionEmbeddingUnavailable("OPENAI_API_KEY is not configured.");
  const openai = new OpenAI({ apiKey, timeout: TIMEOUT_MS, maxRetries: 1 });
  const response = await openai.embeddings.create({
    model: KNOWLEDGE_EMBEDDING_MODEL,
    input: text,
    dimensions: KNOWLEDGE_EMBEDDING_DIMENSIONS,
  });
  const vector = response.data[0]?.embedding;
  if (!vector || vector.length !== KNOWLEDGE_EMBEDDING_DIMENSIONS) {
    throw new QuestionEmbeddingUnavailable("The embedding came back the wrong size.");
  }
  return vector;
}
