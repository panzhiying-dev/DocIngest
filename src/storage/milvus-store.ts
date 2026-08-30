import { MilvusClient, DataType, MetricType } from "@zilliz/milvus2-sdk-node";
import type { VectorRecord } from "../types.js";
import type { VectorStore } from "./vector-store.js";

export class MilvusStore implements VectorStore {
  private readonly client: MilvusClient;
  constructor(private readonly options: { address: string; token?: string; collection: string; dimension: number }) {
    this.client = new MilvusClient({ address: options.address, token: options.token });
  }
  async ensureCollection(): Promise<void> {
    const existing = await this.client.hasCollection({ collection_name: this.options.collection });
    if (existing.value) {
      const description = await this.client.describeCollection({ collection_name: this.options.collection });
      const vectorField: any = (description.schema?.fields as any[] | undefined)?.find((field: any) => field.name === "embedding");
      const dimension = vectorField?.params?.dim ?? vectorField?.type_params?.find((x: any) => x.key === "dim")?.value;
      if (dimension && Number(dimension) !== this.options.dimension) throw new Error(`Milvus embedding dimension mismatch: collection=${dimension}, configured=${this.options.dimension}`);
      return;
    }
    await this.client.createCollection({ collection_name: this.options.collection, fields: [
      { name: "id", data_type: DataType.VarChar, is_primary_key: true, max_length: 256 },
      { name: "document_id", data_type: DataType.VarChar, max_length: 256 },
      { name: "chunk_id", data_type: DataType.VarChar, max_length: 256 },
      { name: "content", data_type: DataType.VarChar, max_length: 65535 },
      { name: "embedding", data_type: DataType.FloatVector, dim: this.options.dimension },
      { name: "title", data_type: DataType.VarChar, max_length: 2048 },
      { name: "category", data_type: DataType.VarChar, max_length: 512 },
      { name: "source_file", data_type: DataType.VarChar, max_length: 4096 },
      { name: "page_start", data_type: DataType.Int64 },
      { name: "page_end", data_type: DataType.Int64 },
    ] as any });
    await this.client.createIndex({ collection_name: this.options.collection, field_name: "embedding", index_type: "AUTOINDEX", metric_type: MetricType.COSINE, params: {} });
    await this.client.loadCollectionSync({ collection_name: this.options.collection });
  }
  async upsert(records: VectorRecord[]): Promise<void> {
    if (!records.length) return;
    await this.client.upsert({ collection_name: this.options.collection, data: records.map((record) => ({ id: record.chunkId, document_id: record.documentId, chunk_id: record.chunkId, content: record.content, embedding: record.embedding, title: record.metadata.title, category: record.metadata.category, source_file: record.metadata.sourceFile, page_start: record.metadata.pageStart, page_end: record.metadata.pageEnd })) });
  }
}
