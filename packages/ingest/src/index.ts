import { createHash } from "node:crypto";
import type { DocumentChunk, SourceDocument } from "@evidencerag/domain";
export * from "./postgres";
export * from "./sample-docs";
export * from "./openai-embeddings";
export * from "./env-file";

export function normalizeText(input: string): string {
  return input.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

export function contentHash(input: string): string {
  return createHash("sha256").update(normalizeText(input)).digest("hex");
}

export function makeChunk(document: SourceDocument, text: string, index: number): DocumentChunk {
  const normalized = normalizeText(text);
  return {
    id: `${document.id}#chunk-${String(index).padStart(3, "0")}`,
    documentId: document.id,
    headingPath: [document.title],
    text: normalized,
    contentHash: contentHash(normalized),
    version: document.version ?? "v1"
  };
}
