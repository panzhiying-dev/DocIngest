import { promises as fs } from "node:fs";
import path from "node:path";
import type { DocumentMetadata, SourceDocument } from "../types.js";

export interface LoadFailure { directory: string; error: Error }
export interface LoadResult { documents: SourceDocument[]; failures: LoadFailure[] }

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export class DocumentLoader {
  async load(inputDir: string): Promise<SourceDocument[]> {
    return (await this.loadWithFailures(inputDir)).documents;
  }

  async loadWithFailures(inputDir: string): Promise<LoadResult> {
    const entries = await fs.readdir(inputDir, { withFileTypes: true }).catch((error) => {
      throw new Error(`Cannot scan input directory ${inputDir}: ${(error as Error).message}`);
    });
    const directories = entries.filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    const documents: SourceDocument[] = [];
    const failures: LoadFailure[] = [];
    for (const entry of directories) {
      try { documents.push(await this.loadOne(path.join(inputDir, entry.name))); }
      catch (error) { failures.push({ directory: entry.name, error: error instanceof Error ? error : new Error(String(error)) }); }
    }
    return { documents, failures };
  }

  private async loadOne(directory: string): Promise<SourceDocument> {
    const markdownPath = path.join(directory, "document.md");
    const jsonPath = path.join(directory, "document.json");
    const [content, jsonText] = await Promise.all([
      fs.readFile(markdownPath, "utf8").catch(() => { throw new Error("document.md 不存在或无法读取"); }),
      fs.readFile(jsonPath, "utf8").catch(() => { throw new Error("document.json 不存在或无法读取"); }),
    ]);
    if (!content.trim()) throw new Error("Markdown 内容为空");
    let source: any;
    try { source = JSON.parse(jsonText); } catch (error) { throw new Error(`document.json 格式错误: ${(error as Error).message}`); }
    const frontmatter = this.parseFrontmatter(content);
    const documentId = asString(source?.identity?.document_id || source?.document_id || frontmatter.document_id);
    if (!documentId) throw new Error("document_id 缺失");
    const metadata: DocumentMetadata = {
      documentId,
      title: asString(source?.metadata?.title || frontmatter.title, documentId),
      category: asString(source?.metadata?.category || frontmatter.category),
      source: asString(source?.source?.relative_path || source?.source?.file_name || frontmatter.source),
      sourceFile: asString(source?.source?.relative_path || source?.source?.file_name || frontmatter.source_file),
      pageCount: asNumber(source?.structure?.page_count || frontmatter.page_count, 0),
      qualityScore: asNumber(source?.quality?.score || frontmatter.quality_score, 0),
    };
    return { documentId, content, metadata };
  }

  private parseFrontmatter(content: string): Record<string, string | number> {
    if (!content.startsWith("---")) return {};
    const end = content.indexOf("\n---", 3);
    if (end < 0) return {};
    const result: Record<string, string | number> = {};
    for (const line of content.slice(3, end).split("\n")) {
      const match = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
      if (!match) continue;
      const raw = match[2].trim().replace(/^['\"]|['\"]$/g, "");
      result[match[1]] = raw !== "" && Number.isFinite(Number(raw)) ? Number(raw) : raw;
    }
    return result;
  }
}
