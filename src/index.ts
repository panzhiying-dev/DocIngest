import { loadConfig } from "./config/index.js";
import { DocumentLoader } from "./loader/document-loader.js";
import { DocumentChunker } from "./chunker/document-chunker.js";
import { QwenEmbeddingProvider } from "./embedding/qwen-embedding.js";
import { MilvusStore } from "./storage/milvus-store.js";
import { IngestionPipeline } from "./pipeline/ingestion-pipeline.js";

function inputArgument(): string | undefined {
  const index = process.argv.indexOf("--input");
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const config = loadConfig();
  if (!config.qwenApiKey) throw new Error("QWEN_API_KEY 未配置");
  if (!config.embeddingDimension) throw new Error("EMBEDDING_DIMENSION 未配置，无法校验 Milvus 向量维度");
  const inputDir = inputArgument() || config.inputDir;
  const loader = new DocumentLoader();
  const chunker = new DocumentChunker(config.chunkSize, config.chunkOverlap);
  const embeddingProvider = new QwenEmbeddingProvider({ apiKey: config.qwenApiKey, baseUrl: config.qwenBaseUrl, model: config.qwenEmbeddingModel, batchSize: config.embeddingBatchSize, maxRetries: config.embeddingMaxRetries });
  const vectorStore = new MilvusStore({ address: config.milvusAddress, token: config.milvusToken, collection: config.milvusCollection, dimension: config.embeddingDimension });
  const pipeline = new IngestionPipeline(loader, chunker, embeddingProvider, vectorStore, console.log);
  console.log(`[INFO] Input directory: ${inputDir}`);
  let stats;
  try {
    stats = await pipeline.run(inputDir);
  } catch (error) {
    console.error(`[ERROR] stage=pipeline message=${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    return;
  }
  console.log(`[INFO] 发现文档：${stats.discovered}`);
  console.log(`[INFO] 加载成功：${stats.loaded}`);
  console.log(`[INFO] Chunk 数量：${stats.chunks}`);
  console.log(`[INFO] Embedding：${stats.embedded}`);
  console.log(`[INFO] Milvus Upsert：${stats.upserted}`);
  console.log(`[INFO] 成功：${stats.succeeded}`);
  console.log(`[INFO] 失败：${stats.failed}`);
}

main().catch((error) => { console.error(`[ERROR] ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; });
