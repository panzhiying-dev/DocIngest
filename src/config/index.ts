import "dotenv/config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function numberValue(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative number`);
  return value;
}

export interface AppConfig {
  inputDir: string;
  chunkSize: number;
  chunkOverlap: number;
  embeddingBatchSize: number;
  embeddingMaxRetries: number;
  embeddingDimension?: number;
  qwenApiKey?: string;
  qwenBaseUrl: string;
  qwenEmbeddingModel: string;
  milvusAddress: string;
  milvusToken?: string;
  milvusCollection: string;
}

export function loadConfig(): AppConfig {
  const dimensionRaw = process.env.EMBEDDING_DIMENSION?.trim();
  const embeddingDimension = dimensionRaw ? Number(dimensionRaw) : undefined;
  if (embeddingDimension !== undefined && (!Number.isInteger(embeddingDimension) || embeddingDimension <= 0)) {
    throw new Error("EMBEDDING_DIMENSION must be a positive integer");
  }
  return {
    inputDir: process.env.INPUT_DIR?.trim() || "./data/input",
    chunkSize: numberValue("CHUNK_SIZE", 800),
    chunkOverlap: numberValue("CHUNK_OVERLAP", 120),
    embeddingBatchSize: Math.max(1, numberValue("EMBEDDING_BATCH_SIZE", 16)),
    embeddingMaxRetries: Math.max(0, numberValue("EMBEDDING_MAX_RETRIES", 3)),
    embeddingDimension,
    qwenApiKey: process.env.QWEN_API_KEY?.trim() || undefined,
    qwenBaseUrl: process.env.QWEN_BASE_URL?.trim() || "https://dashscope.aliyuncs.com/compatible-mode/v1",
    qwenEmbeddingModel: process.env.QWEN_EMBEDDING_MODEL?.trim() || "text-embedding-v3",
    milvusAddress: required("MILVUS_ADDRESS"),
    milvusToken: process.env.MILVUS_TOKEN?.trim() || undefined,
    milvusCollection: process.env.MILVUS_COLLECTION?.trim() || "document_chunks",
  };
}
