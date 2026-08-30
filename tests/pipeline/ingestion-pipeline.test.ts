import { test } from "node:test";
import assert from "node:assert/strict";
import { IngestionPipeline } from "../../src/pipeline/ingestion-pipeline.js";

test("pipeline wires load, chunk, embed and upsert", async () => {
  const loader = { loadWithFailures: async () => ({ documents: [{ documentId: "doc", content: "hello", metadata: { documentId: "doc", title: "T", category: "C", source: "", sourceFile: "f", pageCount: 1, qualityScore: 1 } }], failures: [] }) } as any;
  const chunker = { chunk: async (docs: any[]) => [{ chunkId: "doc_c001", documentId: docs[0].documentId, content: docs[0].content, metadata: { ...docs[0].metadata, pageStart: 1, pageEnd: 1 } }] } as any;
  const embedding = { embedBatch: async (texts: string[]) => texts.map(() => [0.1, 0.2]) } as any;
  const calls: any[] = [];
  const store = { ensureCollection: async () => calls.push("ensure"), upsert: async (records: any[]) => calls.push(records) } as any;
  const stats = await new IngestionPipeline(loader, chunker, embedding, store, () => {}).run("input");
  assert.deepEqual(calls[0], "ensure");
  assert.equal(calls[1][0].embedding[0], 0.1);
  assert.equal(stats.succeeded, 1);
});

test("pipeline records one failed document and continues", async () => {
  const document = (documentId: string) => ({ documentId, content: "hello", metadata: { documentId, title: "T", category: "C", source: "", sourceFile: "f", pageCount: 1, qualityScore: 1 } });
  const loader = { loadWithFailures: async () => ({ documents: [document("failed"), document("succeeded")], failures: [] }) } as any;
  const chunker = { chunk: async (docs: any[]) => [{ chunkId: `${docs[0].documentId}_c001`, documentId: docs[0].documentId, content: docs[0].content, metadata: { ...docs[0].metadata, pageStart: 1, pageEnd: 1 } }] } as any;
  const embedding = { embedBatch: async (texts: string[]) => { if (texts[0] === "hello") return [[0.1]]; return []; } } as any;
  let calls = 0;
  embedding.embedBatch = async () => { calls += 1; if (calls === 1) throw new Error("quota exceeded"); return [[0.1]]; };
  const upserted: string[] = [];
  const store = { ensureCollection: async () => {}, upsert: async (records: any[]) => upserted.push(records[0].documentId) } as any;
  const logs: string[] = [];
  const stats = await new IngestionPipeline(loader, chunker, embedding, store, (message) => logs.push(message)).run("input");
  assert.deepEqual(upserted, ["succeeded"]);
  assert.equal(stats.failed, 1);
  assert.equal(stats.succeeded, 1);
  assert.match(logs[0], /document_id=failed/);
});
