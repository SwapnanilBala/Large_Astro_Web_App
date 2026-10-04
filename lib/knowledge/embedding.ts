/**
 * How knowledge passages are embedded. The loader embeds passages with these
 * settings, and anything that later embeds a question to search them must use
 * the same model, or the distances mean nothing.
 *
 * OpenAI's small model, because the project already holds an OpenAI key (the
 * palm-reading fallback) and Anthropic makes no embedding model. `dimensions`
 * shortens its native 1536 to 1024, which keeps the column the size Voyage's
 * models produce, should the corpus move there. Switching models means
 * re-embedding every row; the loader does that by itself, because each row
 * records the model that made its vector.
 */
export const KNOWLEDGE_EMBEDDING_MODEL = "text-embedding-3-small";
export const KNOWLEDGE_EMBEDDING_DIMENSIONS = 1024;

/** The text a passage is embedded from: its chapter, its plain summary, then the verse itself. */
export function embeddingInput(passage: { chapterTitle: string; summary: string; text: string }): string {
  return `${passage.chapterTitle}\n${passage.summary}\n\n${passage.text}`;
}
