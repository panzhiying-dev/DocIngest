import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type { DocumentChunk, SourceDocument } from "../types.js";

export class DocumentChunker {
  private readonly splitter: RecursiveCharacterTextSplitter;
  constructor(private readonly chunkSize = 800, private readonly chunkOverlap = 120) {
    if (chunkOverlap >= chunkSize) throw new Error("CHUNK_OVERLAP must be smaller than CHUNK_SIZE");
    this.splitter = new RecursiveCharacterTextSplitter({ chunkSize, chunkOverlap, separators: ["\n## ", "\n# ", "\n\n", "\n", "。", "！", "？", " ", ""] });
  }
  async chunk(documents: SourceDocument[]): Promise<DocumentChunk[]> {
    const result: DocumentChunk[] = [];
    for (const document of documents) {
      const parts = await this.splitter.splitText(document.content);
      parts.forEach((content, index) => {
        const pages = [...content.matchAll(/<!--\s*page:\s*(\d+)\s*-->/g)].map((match) => Number(match[1]));
        const pageStart = pages.length ? Math.min(...pages) : 1;
        const pageEnd = pages.length ? Math.max(...pages) : document.metadata.pageCount || pageStart;
        result.push({ chunkId: `${document.documentId}_c${String(index + 1).padStart(3, "0")}`, documentId: document.documentId, content, metadata: { ...document.metadata, pageStart, pageEnd } });
      });
    }
    return result;
  }
}
