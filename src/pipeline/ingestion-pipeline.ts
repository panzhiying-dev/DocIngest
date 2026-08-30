import type { DocumentLoader } from "../loader/document-loader.js";
import type { DocumentChunker } from "../chunker/document-chunker.js";
import type { EmbeddingProvider } from "../embedding/embedding-provider.js";
import type { VectorStore } from "../storage/vector-store.js";
import type { VectorRecord } from "../types.js";

export interface IngestionStats { discovered: number; loaded: number; chunks: number; embedded: number; upserted: number; succeeded: number; failed: number }

export class IngestionPipeline {
  constructor(private readonly loader: DocumentLoader, private readonly chunker: DocumentChunker, private readonly embeddingProvider: EmbeddingProvider, private readonly vectorStore: VectorStore, private readonly logger: (message: string) => void = console.log) {}
  async run(inputDir: string): Promise<IngestionStats> {
    const result = await this.loader.loadWithFailures(inputDir);
    const stats: IngestionStats = { discovered: result.documents.length + result.failures.length, loaded: result.documents.length, chunks: 0, embedded: 0, upserted: 0, succeeded: 0, failed: result.failures.length };
    for (const failure of result.failures) this.logger(`[ERROR] document_id=${failure.directory} stage=load message=${failure.error.message}`);
    await this.vectorStore.ensureCollection();
    for (const document of result.documents) {
      try {
        const chunks = await this.chunker.chunk([document]);
        stats.chunks += chunks.length;
        const embeddings = await this.embeddingProvider.embedBatch(chunks.map((chunk) => chunk.content));
        if (embeddings.length !== chunks.length) throw new Error(`Embedding 数量与 Chunk 数量不一致: ${embeddings.length} != ${chunks.length}`);
        stats.embedded += embeddings.length;
        const records: VectorRecord[] = chunks.map((chunk, index) => ({ ...chunk, embedding: embeddings[index] }));
        await this.vectorStore.upsert(records);
        stats.upserted += records.length;
        stats.succeeded += 1;
        this.logger(`[INFO] document_id=${document.documentId} chunks=${chunks.length} embedding=${embeddings.length} upsert=${records.length} success`);
      } catch (error) {
        stats.failed += 1;
        this.logger(`[ERROR] document_id=${document.documentId} stage=process message=${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return stats;
  }
}
