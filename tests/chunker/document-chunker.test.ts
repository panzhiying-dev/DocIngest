import { test } from "node:test";
import assert from "node:assert/strict";
import { DocumentChunker } from "../../src/chunker/document-chunker.js";

const document = { documentId: "doc_demo", content: "# Title\n\n<!-- page: 1 -->\n\n" + "text ".repeat(300), metadata: { documentId: "doc_demo", title: "Demo", category: "test", source: "", sourceFile: "demo.pdf", pageCount: 1, qualityScore: 90 } };

test("chunk ids are stable and metadata is propagated", async () => {
  const chunker = new DocumentChunker(100, 20);
  const first = await chunker.chunk([document]);
  const second = await chunker.chunk([document]);
  assert.ok(first.length > 1);
  assert.deepEqual(first.map((chunk) => chunk.chunkId), second.map((chunk) => chunk.chunkId));
  assert.equal(first[0].metadata.title, "Demo");
  assert.equal(first[0].metadata.pageStart, 1);
});
