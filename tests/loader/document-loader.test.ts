import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DocumentLoader } from "../../src/loader/document-loader.js";

test("DocumentLoader reads markdown and package metadata", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "document-loader-"));
  const dir = path.join(root, "doc_demo");
  await fs.mkdir(dir);
  await fs.writeFile(path.join(dir, "document.md"), "---\ndocument_id: doc_demo\ntitle: Demo\n---\n\n# Hello\ncontent");
  await fs.writeFile(path.join(dir, "document.json"), JSON.stringify({ identity: { document_id: "doc_demo" }, metadata: { title: "JSON title", category: "test" }, structure: { page_count: 2 }, source: { relative_path: "a.pdf" }, quality: { score: 88 } }));
  const [document] = await new DocumentLoader().load(root);
  assert.equal(document.documentId, "doc_demo");
  assert.equal(document.metadata.title, "JSON title");
  assert.equal(document.metadata.pageCount, 2);
  assert.match(document.content, /Hello/);
});
