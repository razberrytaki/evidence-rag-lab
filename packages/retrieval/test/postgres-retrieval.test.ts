import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { QueryTrace } from "@evidencerag/domain";
import {
  buildExpiredQueryTraceDeleteSql,
  buildLatestQueryTraceSql,
  buildPostgresHybridRetrievalSql,
  buildPostgresLexicalRetrievalSql,
  buildPostgresVectorRetrievalSql,
  buildQueryTraceUpsertSql,
  extractLexicalExactTerms,
  formatPgVector,
  mapPostgresQueryTraceRow,
  mapPostgresRetrievalRow,
  rerankByQueryEvidence,
  runExpiredQueryTraceCleanup,
  sanitizeQueryTraceForStorage,
  shouldPersistTraceSample
} from "../src";

const repoRoot = join(__dirname, "..", "..", "..");

describe("PostgreSQL hybrid retrieval SQL", () => {
  it("builds parameterized lexical and pgvector retrieval with RRF", () => {
    const sql = buildPostgresHybridRetrievalSql({
      query: "semantic vectors'; drop table document_chunks; --",
      embedding: [0.125, -0.25, 0.5],
      topK: 7,
      reciprocalRankK: 60
    });

    expect(sql.text).toContain("websearch_to_tsquery");
    expect(sql.text).toContain("embedding <=> $2::vector");
    expect(sql.text).toContain("$6::text[]");
    expect(sql.text).toContain("1.0 / ($4 +");
    expect(sql.text).toContain("LIMIT $3");
    expect(sql.text).not.toContain("drop table");
    expect(sql.values).toEqual([
      "semantic vectors'; drop table document_chunks; --",
      "[0.125,-0.25,0.5]",
      7,
      60,
      "english",
      []
    ]);
  });

  it("rejects empty or invalid embeddings before SQL execution", () => {
    expect(() => formatPgVector([])).toThrow("embedding must contain at least one dimension");
    expect(() => formatPgVector([0.1, Number.NaN])).toThrow("embedding contains a non-finite value");
  });
});

describe("PostgreSQL retrieval mode SQL", () => {
  it("extracts identifier-like exact terms without treating normal words as mandatory matches", () => {
    expect(
      extractLexicalExactTerms(
        "Which note compares RRF with RAG for RAG_QUERY_MODE=postgres, selectedChunkIds, RAG-0427, and RB-17A?"
      )
    ).toEqual(["RRF", "RAG", "RAG_QUERY_MODE=postgres", "selectedChunkIds", "RAG-0427", "RB-17A"]);
  });

  it("builds lexical-only retrieval without embedding parameters", () => {
    const sql = buildPostgresLexicalRetrievalSql({
      query: "Which note names the exact config key RAG_QUERY_MODE=postgres?",
      topK: 5
    });

    expect(sql.text).toContain("websearch_to_tsquery");
    expect(sql.text).toContain("ts_rank_cd");
    expect(sql.text).toContain("strpos(lower(document_chunks.normalized_text), lower(exact_terms.term)) > 0");
    expect(sql.text).toContain("$4::text[]");
    expect(sql.text).toContain("NULL::bigint AS vector_rank");
    expect(sql.text).toContain("LIMIT $2");
    expect(sql.text).not.toContain("embedding <=>");
    expect(sql.values).toEqual([
      "Which note names the exact config key RAG_QUERY_MODE=postgres?",
      5,
      "english",
      ["RAG_QUERY_MODE=postgres"]
    ]);
  });

  it("builds vector-only retrieval without full-text search parameters", () => {
    const sql = buildPostgresVectorRetrievalSql({
      embedding: [0.25, -0.5, 0.75],
      topK: 5,
      reciprocalRankK: 60
    });

    expect(sql.text).toContain("embedding <=> $1::vector");
    expect(sql.text).toContain("NULL::bigint AS lexical_rank");
    expect(sql.text).toContain("1.0 / ($3 + vector_candidates.vector_rank)");
    expect(sql.text).toContain("LIMIT $2");
    expect(sql.text).not.toContain("websearch_to_tsquery");
    expect(sql.values).toEqual(["[0.25,-0.5,0.75]", 5, 60]);
  });
});

describe("PostgreSQL retrieval row mapper", () => {
  it("maps SQL rows into RetrievalResult with score breakdown and parent context", () => {
    const result = mapPostgresRetrievalRow({
      document_id: "hybrid-retrieval-note",
      document_title: "Hybrid Retrieval Note",
      source_type: "public-doc",
      source_url: "https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking",
      document_version: "v1",
      chunk_id: "hybrid-retrieval-note#chunk-001",
      heading_path: ["Hybrid Retrieval Note"],
      normalized_text: "Hybrid retrieval combines lexical retrieval and vector retrieval.",
      content_hash: "hash-001",
      chunk_version: "v1",
      lexical_rank: "1",
      vector_rank: 2,
      retrieval_score: "0.0325"
    });

    expect(result.chunk).toEqual({
      id: "hybrid-retrieval-note#chunk-001",
      documentId: "hybrid-retrieval-note",
      headingPath: ["Hybrid Retrieval Note"],
      text: "Hybrid retrieval combines lexical retrieval and vector retrieval.",
      contentHash: "hash-001",
      version: "v1"
    });
    expect(result.parentContext).toEqual({
      documentId: "hybrid-retrieval-note",
      headingPath: ["Hybrid Retrieval Note"],
      text: "Hybrid retrieval combines lexical retrieval and vector retrieval."
    });
    expect(result.score).toEqual({
      lexicalRank: 1,
      vectorRank: 2,
      retrievalScore: 0.0325,
      trustScore: 0.8,
      freshnessScore: 1,
      duplicatePenalty: 0
    });
  });

  it("demotes stale source rows during mapping", () => {
    const result = mapPostgresRetrievalRow({
      document_id: "deployment-policy-v1",
      document_title: "Deployment Policy v1",
      source_type: "synthetic-stale",
      source_url: null,
      document_version: "v1",
      chunk_id: "deployment-policy-v1#chunk-001",
      heading_path: ["Deployment Policy v1"],
      normalized_text: "This stale note says deployment approval can be completed without citation coverage.",
      content_hash: "hash-stale",
      chunk_version: "v1",
      lexical_rank: 1,
      vector_rank: null,
      retrieval_score: 0.016
    });

    expect(result.score.trustScore).toBe(0.3);
    expect(result.score.freshnessScore).toBe(0.3);
    expect(result.score.vectorRank).toBeUndefined();
  });
});

describe("deterministic query-evidence reranker", () => {
  it("reranks candidates by query token evidence without mutating raw retrieval ranks", () => {
    const reranked = rerankByQueryEvidence({
      query: "Which note describes reranker latency budget?",
      topK: 3,
      candidates: [
        makeRetrievalResult({
          chunkId: "generic-vector-note#chunk-001",
          documentId: "generic-vector-note",
          text: "Vector retrieval can return semantically close but generic context.",
          lexicalRank: undefined,
          vectorRank: 1,
          retrievalScore: 0.99,
          trustScore: 0.8
        }),
        makeRetrievalResult({
          chunkId: "reranker-latency-note#chunk-001",
          documentId: "reranker-latency-note",
          text: "Reranker latency must fit a fixed budget and stay separately measurable.",
          lexicalRank: 4,
          vectorRank: 2,
          retrievalScore: 0.89,
          trustScore: 0.8
        }),
        makeRetrievalResult({
          chunkId: "low-trust-reranker-note#chunk-001",
          documentId: "low-trust-reranker-note",
          text: "Reranker latency budget appears here but the source is low trust.",
          lexicalRank: 2,
          vectorRank: 3,
          retrievalScore: 0.79,
          trustScore: 0.3
        })
      ]
    });

    expect(reranked.map((result) => result.chunk.id)).toEqual([
      "reranker-latency-note#chunk-001",
      "low-trust-reranker-note#chunk-001",
      "generic-vector-note#chunk-001"
    ]);
    expect(reranked[0]?.score).toMatchObject({
      lexicalRank: 4,
      vectorRank: 2,
      rerankRank: 1,
      rerankScore: 0.787,
      retrievalScore: 0.99
    });
    expect(reranked[1]?.score).toMatchObject({
      rerankRank: 2,
      retrievalScore: 0.89
    });
    expect(reranked[2]?.score).toMatchObject({
      rerankRank: 3,
      retrievalScore: 0.79
    });
    expect(reranked[0]?.score.rerankScore).toBeGreaterThan(reranked[1]?.score.rerankScore ?? 0);
    expect(reranked[1]?.score.rerankScore).toBeGreaterThan(reranked[2]?.score.rerankScore ?? 0);
  });
});

describe("PostgreSQL retrieval schema", () => {
  it("declares vector, lexical, and sanitized trace storage contracts", () => {
    const schema = readFileSync(join(repoRoot, "infra/postgres/init/001_schema.sql"), "utf8");

    expect(schema).toContain("CREATE EXTENSION IF NOT EXISTS vector");
    expect(schema).toContain("embedding vector(1536)");
    expect(schema).toContain("search_vector tsvector NOT NULL DEFAULT ''::tsvector");
    expect(schema).not.toContain("GENERATED ALWAYS");
    expect(schema).toContain("USING hnsw (embedding vector_cosine_ops)");
    expect(schema).toContain("USING gin(search_vector)");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS query_traces");
    expect(schema).toContain("sanitized boolean NOT NULL DEFAULT true");
  });
});

describe("PostgreSQL query trace persistence", () => {
  it("builds a parameterized sanitized trace upsert without storing raw chunk text or citation quotes", () => {
    const trace: QueryTrace = {
      id: "pg-trace-001",
      query: "semantic vectors'; drop table query_traces; --",
      normalizedQuery: "semantic vectors",
      selectedChunkIds: ["hybrid-retrieval-note#chunk-001"],
      rejected: [{ chunkId: "deployment-policy-v1#chunk-001", reason: "stale_source" }],
      candidates: [
        {
          chunk: {
            id: "hybrid-retrieval-note#chunk-001",
            documentId: "hybrid-retrieval-note",
            headingPath: ["Hybrid Retrieval Note"],
            text: "raw chunk text must not be stored in query trace candidates",
            contentHash: "hash-001",
            version: "v1"
          },
          parentContext: {
            documentId: "hybrid-retrieval-note",
            headingPath: ["Hybrid Retrieval Note"],
            text: "raw parent text must not be stored"
          },
          score: {
            lexicalRank: 1,
            vectorRank: 2,
            fusedRank: 1,
            retrievalScore: 0.99,
            trustScore: 0.8,
            freshnessScore: 1,
            duplicatePenalty: 0
          }
        }
      ],
      generation: {
        status: "answered",
        answer: "The answer is grounded in selected context.",
        claims: [
          {
            id: "claim-1",
            text: "Hybrid retrieval used both signals.",
            citations: [
              {
                documentId: "hybrid-retrieval-note",
                chunkId: "hybrid-retrieval-note#chunk-001",
                quote: "citation quote must not be stored in query trace generation"
              }
            ]
          }
        ]
      },
      sanitized: true
    };

    const sql = buildQueryTraceUpsertSql(trace);
    const serializedValues = JSON.stringify(sql.values);

    expect(sql.text).toContain("INSERT INTO query_traces");
    expect(sql.text).toContain("$5::jsonb");
    expect(sql.text).toContain("ON CONFLICT (id) DO UPDATE");
    expect(sql.text).not.toContain("drop table");
    expect(sql.values[0]).toBe("pg-trace-001");
    expect(sql.values[1]).toBe("semantic vectors'; drop table query_traces; --");
    expect(sql.values[3]).toEqual(["hybrid-retrieval-note#chunk-001"]);
    expect(JSON.parse(String(sql.values[5]))).toEqual([
      {
        chunkId: "hybrid-retrieval-note#chunk-001",
        documentId: "hybrid-retrieval-note",
        headingPath: ["Hybrid Retrieval Note"],
        score: {
          lexicalRank: 1,
          vectorRank: 2,
          fusedRank: 1,
          retrievalScore: 0.99,
          trustScore: 0.8,
          freshnessScore: 1,
          duplicatePenalty: 0
        }
      }
    ]);
    expect(JSON.parse(String(sql.values[6]))).toEqual({
      status: "answered",
      claims: [
        {
          id: "claim-1",
          citations: [
            {
              documentId: "hybrid-retrieval-note",
              chunkId: "hybrid-retrieval-note#chunk-001"
            }
          ]
        }
      ]
    });
    expect(serializedValues).not.toContain("raw chunk text");
    expect(serializedValues).not.toContain("citation quote");
  });

  it("redacts sensitive query and rejection text before trace storage", () => {
    const trace: QueryTrace = {
      id: "pg-trace-secret",
      query: "Find user toby@example.com with OPENAI_API_KEY=sk-live-secret",
      normalizedQuery: "find user toby@example.com with openai_api_key=sk-live-secret",
      selectedChunkIds: [],
      rejected: [
        {
          chunkId: "unknown",
          reason: "provider said Bearer sk-provider-secret for toby@example.com"
        }
      ],
      candidates: [],
      generation: {
        status: "rejected",
        reason: "citation_validation_failed",
        message: "provider debug contained sk-provider-secret and toby@example.com"
      },
      sanitized: false
    };

    const sanitized = sanitizeQueryTraceForStorage(trace);

    expect(sanitized.query).toBe("Find user [redacted-email] with OPENAI_API_KEY=[redacted-secret]");
    expect(sanitized.normalizedQuery).toBe("find user [redacted-email] with openai_api_key=[redacted-secret]");
    expect(sanitized.rejected[0]?.reason).toBe("provider said Bearer [redacted-secret] for [redacted-email]");
    expect(sanitized.generation).toEqual({
      status: "rejected",
      reason: "citation_validation_failed",
      message: "provider debug contained [redacted-secret] and [redacted-email]"
    });
    expect(sanitized.sanitized).toBe(true);
    expect(JSON.stringify(sanitized)).not.toContain("sk-live-secret");
    expect(JSON.stringify(sanitized)).not.toContain("toby@example.com");
  });

  it("builds a retention cleanup query for expired sanitized traces", () => {
    const sql = buildExpiredQueryTraceDeleteSql({
      now: new Date("2026-06-11T00:00:00.000Z"),
      retainForDays: 7
    });

    expect(sql.text).toContain("DELETE FROM query_traces");
    expect(sql.text).toContain("created_at < $1::timestamptz");
    expect(sql.text).toContain("RETURNING id");
    expect(sql.values).toEqual(["2026-06-04T00:00:00.000Z"]);
  });

  it("rejects retention windows that can generate unsafe timestamp cutoffs", () => {
    expect(() => buildExpiredQueryTraceDeleteSql({ retainForDays: 0 })).toThrow(
      "retainForDays must be between 1 and 3650"
    );
    expect(() => buildExpiredQueryTraceDeleteSql({ retainForDays: 3651 })).toThrow(
      "retainForDays must be between 1 and 3650"
    );
  });

  it("makes deterministic sampling decisions from the trace id", () => {
    expect(shouldPersistTraceSample("pg-trace-001", 1)).toBe(true);
    expect(shouldPersistTraceSample("pg-trace-001", 0)).toBe(false);
    expect(shouldPersistTraceSample("pg-trace-001", 0.25)).toBe(shouldPersistTraceSample("pg-trace-001", 0.25));
    expect(() => shouldPersistTraceSample("pg-trace-001", 1.1)).toThrow("sampleRate must be between 0 and 1");
  });

  it("runs expired trace cleanup through an executor and returns an audit summary", async () => {
    const executed: Array<{ text: string; values: unknown[] }> = [];
    const summary = await runExpiredQueryTraceCleanup({
      queryExecutor: {
        query: async (text, values) => {
          executed.push({ text, values });
          return {
            rows: [{ id: "pg-trace-old" }, { id: "pg-trace-older" }]
          };
        }
      },
      now: new Date("2026-06-11T00:00:00.000Z"),
      retainForDays: 7
    });

    expect(executed).toHaveLength(1);
    expect(executed[0]?.text).toContain("DELETE FROM query_traces");
    expect(executed[0]?.values).toEqual(["2026-06-04T00:00:00.000Z"]);
    expect(summary).toEqual({
      retentionDays: 7,
      cutoff: "2026-06-04T00:00:00.000Z",
      deletedCount: 2,
      deletedTraceIds: ["pg-trace-old", "pg-trace-older"]
    });
  });
});

describe("PostgreSQL query trace reads", () => {
  it("builds a latest sanitized trace read query", () => {
    const sql = buildLatestQueryTraceSql();

    expect(sql.text).toContain("FROM query_traces");
    expect(sql.text).toContain("WHERE sanitized = true");
    expect(sql.text).toContain("ORDER BY created_at DESC, id DESC");
    expect(sql.text).toContain("LIMIT 1");
    expect(sql.values).toEqual([]);
  });

  it("maps a persisted trace row into a public-safe trace DTO", () => {
    const createdAt = new Date("2026-06-11T08:00:00.000Z");

    const trace = mapPostgresQueryTraceRow({
      id: "pg-trace-001",
      query: "Why not rely only on semantic vectors?",
      normalized_query: "why not rely only on semantic vectors?",
      selected_chunk_ids: ["hybrid-retrieval-note#chunk-001"],
      rejected: [{ chunkId: "deployment-policy-v1#chunk-001", reason: "stale_source" }],
      candidates: [
        {
          chunkId: "hybrid-retrieval-note#chunk-001",
          documentId: "hybrid-retrieval-note",
          headingPath: ["Hybrid Retrieval Note"],
          score: {
            lexicalRank: 1,
            vectorRank: 2,
            fusedRank: 1,
            retrievalScore: 0.99,
            trustScore: 0.8,
            freshnessScore: 1,
            duplicatePenalty: 0
          }
        }
      ],
      generation: {
        status: "answered",
        claims: [
          {
            id: "claim-1",
            citations: [
              {
                documentId: "hybrid-retrieval-note",
                chunkId: "hybrid-retrieval-note#chunk-001"
              }
            ]
          }
        ]
      },
      sanitized: true,
      created_at: createdAt
    });

    expect(trace).toEqual({
      id: "pg-trace-001",
      query: "Why not rely only on semantic vectors?",
      normalizedQuery: "why not rely only on semantic vectors?",
      selectedChunkIds: ["hybrid-retrieval-note#chunk-001"],
      rejected: [{ chunkId: "deployment-policy-v1#chunk-001", reason: "stale_source" }],
      candidates: [
        {
          chunkId: "hybrid-retrieval-note#chunk-001",
          documentId: "hybrid-retrieval-note",
          headingPath: ["Hybrid Retrieval Note"],
          score: {
            lexicalRank: 1,
            vectorRank: 2,
            fusedRank: 1,
            retrievalScore: 0.99,
            trustScore: 0.8,
            freshnessScore: 1,
            duplicatePenalty: 0
          }
        }
      ],
      generation: {
        status: "answered",
        claims: [
          {
            id: "claim-1",
            citations: [
              {
                documentId: "hybrid-retrieval-note",
                chunkId: "hybrid-retrieval-note#chunk-001"
              }
            ]
          }
        ]
      },
      sanitized: true,
      createdAt: "2026-06-11T08:00:00.000Z"
    });
  });
});

function makeRetrievalResult(input: {
  chunkId: string;
  documentId: string;
  text: string;
  lexicalRank?: number;
  vectorRank?: number;
  retrievalScore: number;
  trustScore: number;
}) {
  return {
    chunk: {
      id: input.chunkId,
      documentId: input.documentId,
      headingPath: [input.documentId],
      text: input.text,
      contentHash: `${input.chunkId}-hash`,
      version: "v1"
    },
    parentContext: {
      documentId: input.documentId,
      headingPath: [input.documentId],
      text: input.text
    },
    score: {
      lexicalRank: input.lexicalRank,
      vectorRank: input.vectorRank,
      retrievalScore: input.retrievalScore,
      trustScore: input.trustScore,
      freshnessScore: input.trustScore,
      duplicatePenalty: 0
    }
  };
}
