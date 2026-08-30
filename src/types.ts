export interface DocumentMetadata {
  documentId: string;
  title: string;
  category: string;
  source: string;
  sourceFile: string;
  pageCount: number;
  qualityScore: number;
  [key: string]: string | number | boolean | null | undefined;
}

export interface SourceDocument {
  documentId: string;
  content: string;
  metadata: DocumentMetadata;
}

export interface DocumentChunk {
  chunkId: string;
  documentId: string;
  content: string;
  metadata: DocumentMetadata & { pageStart: number; pageEnd: number };
}

export interface VectorRecord extends DocumentChunk {
  embedding: number[];
}
