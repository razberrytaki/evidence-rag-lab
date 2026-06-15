import { describe, expect, it } from "vitest";
import type { DocumentChunk, SourceDocument } from "@evidencerag/domain";
import { buildPostgresIngestPlan, executePostgresIngestPlan, formatNullablePgVector } from "../src/postgres";

const source: SourceDocument = {
  id: "hybrid-retrieval-note",
  title: "Hybrid Retrieval Note'); drop table source_documents; --",
  sourceType: "public-doc",
  sourceUrl: "https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking",
  version: "v1",
  publishedAt: "2026-06-11",
  licenseNote: "Short paraphrased note derived from public documentation."
};

const chunk: DocumentChunk = {
  id: "hybrid-retrieval-note#chunk-001",
  documentId: "hybrid-retrieval-note",
  headingPath: ["Hybrid Retrieval Note"],
  text: "Hybrid retrieval combines lexical retrieval and vector retrieval.",
  contentHash: "hash-001",
  version: "v1"
};

describe("PostgreSQL ingest upsert plan", () => {
  it("builds parameterized source and chunk upserts without interpolating document text", () => {
    const plan = buildPostgresIngestPlan({
      documents: [
        {
          source,
          chunks: [{ chunk, embedding: [0.125, -0.25, 0.5] }]
        }
      ]
    });

    expect(plan.statements).toHaveLength(2);
    expect(plan.statements[0]?.text).toContain("INSERT INTO source_documents");
    expect(plan.statements[0]?.text).toContain("ON CONFLICT (id) DO UPDATE");
    expect(plan.statements[0]?.text).toContain("WHERE (");
    expect(plan.statements[0]?.text).toContain("source_documents.title");
    expect(plan.statements[0]?.text).toContain("IS DISTINCT FROM");
    expect(plan.statements[0]?.text).not.toContain("drop table");
    expect(plan.statements[0]?.values).toEqual([
      source.id,
      source.title,
      source.sourceType,
      source.sourceUrl,
      source.version,
      source.publishedAt,
      source.licenseNote
    ]);

    expect(plan.statements[1]?.text).toContain("INSERT INTO document_chunks");
    expect(plan.statements[1]?.text).toContain("search_vector");
    expect(plan.statements[1]?.text).toContain("to_tsvector('english'");
    expect(plan.statements[1]?.text).toContain("array_to_string($4::text[]");
    expect(plan.statements[1]?.text).toContain("$7::vector");
    expect(plan.statements[1]?.text).toContain("ON CONFLICT (id) DO UPDATE");
    expect(plan.statements[1]?.text).toContain("WHERE (");
    expect(plan.statements[1]?.text).toContain("document_chunks.normalized_text");
    expect(plan.statements[1]?.text).toContain("IS DISTINCT FROM");
    expect(plan.statements[1]?.values).toEqual([
      chunk.id,
      chunk.documentId,
      null,
      chunk.headingPath,
      chunk.text,
      chunk.contentHash,
      "[0.125,-0.25,0.5]",
      chunk.version
    ]);
  });

  it("allows lexical-only rows while rejecting invalid embedding values", () => {
    expect(formatNullablePgVector(undefined)).toBeNull();
    expect(formatNullablePgVector(null)).toBeNull();
    expect(() => formatNullablePgVector([0.1, Number.POSITIVE_INFINITY])).toThrow(
      "embedding contains a non-finite value"
    );
  });

  it("executes statements in order through an injected SQL executor", async () => {
    const plan = buildPostgresIngestPlan({
      documents: [
        {
          source,
          chunks: [{ chunk, embedding: null }]
        }
      ]
    });
    const calls: Array<{ text: string; values: unknown[] }> = [];

    const summary = await executePostgresIngestPlan(
      {
        query: async (text, values) => {
          calls.push({ text, values });
        }
      },
      plan
    );

    expect(summary.statementCount).toBe(2);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.text).toContain("INSERT INTO source_documents");
    expect(calls[1]?.text).toContain("INSERT INTO document_chunks");
  });
});
