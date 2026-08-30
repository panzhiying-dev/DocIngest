import { OpenAIEmbeddings } from "@langchain/openai";
import type { EmbeddingProvider } from "./embedding-provider.js";

export class QwenEmbeddingProvider implements EmbeddingProvider {
  private readonly embeddings: OpenAIEmbeddings;
  constructor(private readonly options: { apiKey: string; baseUrl: string; model: string; batchSize?: number; maxRetries?: number }) {
    this.embeddings = new OpenAIEmbeddings({
      apiKey: options.apiKey,
      model: options.model,
      batchSize: options.batchSize ?? 16,
      maxRetries: options.maxRetries ?? 3,
      // Keep requests serialized by default. This avoids sending all batches
      // concurrently when a large input directory is ingested.
      maxConcurrency: 1,
      configuration: { baseURL: options.baseUrl },
    });
  }
  async embed(text: string): Promise<number[]> { return this.embeddings.embedQuery(text); }
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];
    return this.embeddings.embedDocuments(texts);
  }
}
