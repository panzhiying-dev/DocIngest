import type { VectorRecord } from "../types.js";
export interface VectorStore {
  ensureCollection(): Promise<void>;
  upsert(records: VectorRecord[]): Promise<void>;
}
