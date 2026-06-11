import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { SourceDocument, SourceType } from "@evidencerag/domain";
import { makeChunk, normalizeText } from "./index";
import type { EmbeddingProvider } from "./openai-embeddings";
import type { PostgresDocumentInput } from "./postgres";

const SOURCE_TYPES = new Set<SourceType>(["public-doc", "synthetic-conflict", "synthetic-stale"]);

export async function loadMarkdownDocumentSet(sampleDocsDir: string): Promise<PostgresDocumentInput[]> {
  const paths = (await listMarkdownFiles(sampleDocsDir))
    .filter((path) => !path.endsWith("README.md"))
    .sort((left, right) => left.localeCompare(right));

  return Promise.all(
    paths.map(async (path) => {
      const raw = await readFile(path, "utf8");
      const { source, body } = parseMarkdownSource(raw);
      return {
        source,
        chunks: [
          {
            chunk: makeChunk(source, body, 1),
            embedding: null
          }
        ]
      };
    })
  );
}

export async function loadEmbeddedMarkdownDocumentSet(
  sampleDocsDir: string,
  provider: EmbeddingProvider
): Promise<PostgresDocumentInput[]> {
  const documents = await loadMarkdownDocumentSet(sampleDocsDir);
  const chunks = documents.flatMap((document) => document.chunks.map((chunk) => chunk.chunk));
  const embeddings = await provider.embedTexts(chunks.map((chunk) => chunk.text));

  if (embeddings.length !== chunks.length) {
    throw new Error("embedding provider returned a different number of vectors than requested chunks");
  }

  let offset = 0;
  return documents.map((document) => ({
    source: document.source,
    chunks: document.chunks.map((chunk) => ({
      chunk: chunk.chunk,
      embedding: embeddings[offset++]
    }))
  }));
}

async function listMarkdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return listMarkdownFiles(path);
      }
      return entry.isFile() && entry.name.endsWith(".md") ? [path] : [];
    })
  );
  return nested.flat();
}

function parseMarkdownSource(raw: string): { source: SourceDocument; body: string } {
  if (!raw.startsWith("---\n")) {
    throw new Error("sample document is missing frontmatter");
  }

  const end = raw.indexOf("\n---", 4);
  if (end === -1) {
    throw new Error("sample document has unterminated frontmatter");
  }

  const frontmatter = parseFrontmatter(raw.slice(4, end));
  const body = normalizeText(raw.slice(end + 4));
  const id = requireFrontmatter(frontmatter, "id");
  const sourceType = parseSourceType(requireFrontmatter(frontmatter, "sourceType"));

  return {
    source: {
      id,
      title: extractTitle(body, id),
      sourceType,
      sourceUrl: frontmatter.get("sourceUrl"),
      version: frontmatter.get("version"),
      publishedAt: frontmatter.get("accessed"),
      licenseNote: requireFrontmatter(frontmatter, "licenseNote")
    },
    body
  };
}

function parseFrontmatter(frontmatter: string): Map<string, string> {
  const parsed = new Map<string, string>();
  for (const line of frontmatter.split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }
    parsed.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }
  return parsed;
}

function requireFrontmatter(frontmatter: Map<string, string>, key: string): string {
  const value = frontmatter.get(key);
  if (!value) {
    throw new Error(`sample document is missing ${key}`);
  }
  return value;
}

function parseSourceType(value: string): SourceType {
  if (!SOURCE_TYPES.has(value as SourceType)) {
    throw new Error(`unknown sourceType: ${value}`);
  }
  return value as SourceType;
}

function extractTitle(body: string, fallback: string): string {
  const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return title ?? fallback;
}
