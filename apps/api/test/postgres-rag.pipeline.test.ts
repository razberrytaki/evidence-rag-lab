import { describe, expect, it } from "vitest";
import type { EmbeddingProvider } from "@evidencerag/ingest";
import type { LLMProvider } from "@evidencerag/generation";
import { createLiveLLMProvider, runPostgresRagPipeline } from "../src/postgres-rag.pipeline";

describe("PostgreSQL RAG pipeline", () => {
  it("embeds the query, retrieves PostgreSQL rows, calibrates DB scores, and generates a grounded answer", async () => {
    const embeddedTexts: string[] = [];
    const executed: Array<{ text: string; values: unknown[] }> = [];
    const embeddingProvider: EmbeddingProvider = {
      embedTexts: async (texts) => {
        embeddedTexts.push(...texts);
        return [[0.1, 0.2, 0.3]];
      }
    };
    const queryExecutor = {
      query: async (text: string, values: unknown[]) => {
        executed.push({ text, values });
        return {
          rows: [
            {
              document_id: "hybrid-retrieval-note",
              document_title: "Hybrid Retrieval Note",
              source_type: "public-doc",
              source_url: "https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking",
              document_version: "v1",
              chunk_id: "hybrid-retrieval-note#chunk-001",
              heading_path: ["Hybrid Retrieval Note"],
              normalized_text:
                "Hybrid retrieval explains why teams should not rely only on semantic vectors because lexical retrieval preserves exact signals.",
              content_hash: "hash-001",
              chunk_version: "v1",
              lexical_rank: "1",
              vector_rank: null,
              retrieval_score: "0.01639344262295082"
            }
          ]
        };
      }
    };

    const result = await runPostgresRagPipeline({
      question: "Why not rely only on semantic vectors?",
      embeddingProvider,
      queryExecutor,
      topK: 3
    });

    expect(embeddedTexts).toEqual(["Why not rely only on semantic vectors?"]);
    expect(executed).toHaveLength(1);
    expect(executed[0]?.text).toContain("websearch_to_tsquery");
    expect(executed[0]?.values).toEqual([
      "Why not rely only on semantic vectors?",
      "[0.1,0.2,0.3]",
      3,
      60,
      "english",
      []
    ]);
    expect(result.generation.status).toBe("answered");
    expect(result.selectedContext[0]?.chunk.id).toBe("hybrid-retrieval-note#chunk-001");
    expect(result.selectedContext[0]?.score.retrievalScore).toBe(0.99);
    expect(result.selectedContext[0]?.score.rerankScore).toBeGreaterThanOrEqual(0.5);
    expect(result.trace.sanitized).toBe(true);
    expect(result.trace.candidates[0]?.chunk.id).toBe("hybrid-retrieval-note#chunk-001");
  });

  it("returns an insufficient evidence rejection when PostgreSQL returns no candidates", async () => {
    const embeddingProvider: EmbeddingProvider = {
      embedTexts: async () => [[0.1, 0.2, 0.3]]
    };
    const queryExecutor = {
      query: async () => ({ rows: [] })
    };

    const result = await runPostgresRagPipeline({
      question: "What was the unpublished internal incident root cause?",
      embeddingProvider,
      queryExecutor,
      topK: 3
    });

    expect(result.selectedContext).toEqual([]);
    expect(result.generation).toEqual({
      status: "rejected",
      reason: "insufficient_evidence",
      message: "No selected context was available."
    });
    expect(result.trace.selectedChunkIds).toEqual([]);
  });

  it("reranks PostgreSQL candidates by query evidence before selecting generation context", async () => {
    const embeddingProvider: EmbeddingProvider = {
      embedTexts: async () => [[0.1, 0.2, 0.3]]
    };
    const queryExecutor = {
      query: async () => ({
        rows: [
          {
            document_id: "generic-vector-note",
            document_title: "Generic Vector Note",
            source_type: "public-doc",
            source_url: null,
            document_version: "v1",
            chunk_id: "generic-vector-note#chunk-001",
            heading_path: ["Generic Vector Note"],
            normalized_text: "Vector retrieval can return semantically close but generic context.",
            content_hash: "hash-generic",
            chunk_version: "v1",
            lexical_rank: null,
            vector_rank: 1,
            retrieval_score: "0.016"
          },
          {
            document_id: "reranker-latency-note",
            document_title: "Reranker Latency Note",
            source_type: "public-doc",
            source_url: null,
            document_version: "v1",
            chunk_id: "reranker-latency-note#chunk-001",
            heading_path: ["Reranker Latency Note"],
            normalized_text: "Reranker latency must fit a fixed budget and stay separately measurable.",
            content_hash: "hash-reranker",
            chunk_version: "v1",
            lexical_rank: 4,
            vector_rank: 2,
            retrieval_score: "0.015"
          }
        ]
      })
    };

    const result = await runPostgresRagPipeline({
      question: "Which note describes reranker latency budget?",
      embeddingProvider,
      queryExecutor,
      topK: 2
    });

    expect(result.selectedContext.map((context) => context.chunk.id)).toEqual([
      "reranker-latency-note#chunk-001"
    ]);
    expect(result.selectedContext[0]?.score).toMatchObject({
      rerankRank: 1,
      rerankScore: 0.787,
      retrievalScore: 0.89
    });
    expect(result.trace.candidates[0]?.chunk.id).toBe("reranker-latency-note#chunk-001");
  });

  it("rejects PostgreSQL vector candidates when query evidence is below the answer threshold", async () => {
    const embeddingProvider: EmbeddingProvider = {
      embedTexts: async () => [[0.1, 0.2, 0.3]]
    };
    const queryExecutor = {
      query: async () => ({
        rows: [
          {
            document_id: "generic-vector-note",
            document_title: "Generic Vector Note",
            source_type: "public-doc",
            source_url: null,
            document_version: "v1",
            chunk_id: "generic-vector-note#chunk-001",
            heading_path: ["Generic Vector Note"],
            normalized_text: "Vector retrieval can return semantically close but generic context.",
            content_hash: "hash-generic",
            chunk_version: "v1",
            lexical_rank: null,
            vector_rank: 1,
            retrieval_score: "0.016"
          }
        ]
      })
    };

    const result = await runPostgresRagPipeline({
      question: "What is the rollback owner for an unpublished billing incident?",
      embeddingProvider,
      queryExecutor,
      topK: 3
    });

    expect(result.selectedContext).toEqual([]);
    expect(result.trace.candidates[0]?.score).toMatchObject({
      retrievalScore: 0.99
    });
    expect(result.trace.candidates[0]?.score.rerankScore ?? 1).toBeLessThan(0.5);
    expect(result.generation).toEqual({
      status: "rejected",
      reason: "insufficient_evidence",
      message: "No selected context was available."
    });
  });

  it("persists the sanitized query trace when trace persistence is enabled", async () => {
    const embeddingProvider: EmbeddingProvider = {
      embedTexts: async () => [[0.1, 0.2, 0.3]]
    };
    const executed: Array<{ text: string; values: unknown[] }> = [];
    const queryExecutor = {
      query: async (text: string, values: unknown[]) => {
        executed.push({ text, values });
        if (text.includes("INSERT INTO query_traces")) {
          return { rows: [] };
        }
        return {
          rows: [
            {
              document_id: "hybrid-retrieval-note",
              document_title: "Hybrid Retrieval Note",
              source_type: "public-doc",
              source_url: null,
              document_version: "v1",
              chunk_id: "hybrid-retrieval-note#chunk-001",
              heading_path: ["Hybrid Retrieval Note"],
              normalized_text:
                "Hybrid retrieval explains why teams should not rely only on semantic vectors while raw chunk text must stay out of the stored trace payload.",
              content_hash: "hash-001",
              chunk_version: "v1",
              lexical_rank: 1,
              vector_rank: 1,
              retrieval_score: "0.032"
            }
          ]
        };
      }
    };

    const result = await runPostgresRagPipeline({
      question: "Why not rely only on semantic vectors?",
      embeddingProvider,
      queryExecutor,
      persistTrace: true,
      topK: 3
    });

    expect(result.trace.selectedChunkIds).toEqual(["hybrid-retrieval-note#chunk-001"]);
    expect(executed).toHaveLength(2);
    expect(executed[1]?.text).toContain("INSERT INTO query_traces");
    expect(JSON.stringify(executed[1]?.values)).not.toContain("raw chunk text");
  });

  it("skips trace persistence when deterministic trace sampling rejects the trace", async () => {
    const embeddingProvider: EmbeddingProvider = {
      embedTexts: async () => [[0.1, 0.2, 0.3]]
    };
    const executed: Array<{ text: string; values: unknown[] }> = [];
    const queryExecutor = {
      query: async (text: string, values: unknown[]) => {
        executed.push({ text, values });
        return {
          rows: [
            {
              document_id: "hybrid-retrieval-note",
              document_title: "Hybrid Retrieval Note",
              source_type: "public-doc",
              source_url: null,
              document_version: "v1",
              chunk_id: "hybrid-retrieval-note#chunk-001",
              heading_path: ["Hybrid Retrieval Note"],
              normalized_text:
                "Hybrid retrieval explains why teams should not rely only on semantic vectors because lexical retrieval preserves exact signals.",
              content_hash: "hash-001",
              chunk_version: "v1",
              lexical_rank: 1,
              vector_rank: 1,
              retrieval_score: "0.032"
            }
          ]
        };
      }
    };

    await runPostgresRagPipeline({
      question: "Why not rely only on semantic vectors?",
      embeddingProvider,
      queryExecutor,
      persistTrace: true,
      traceSampleRate: 0,
      topK: 3
    });

    expect(executed).toHaveLength(1);
    expect(executed[0]?.text).toContain("websearch_to_tsquery");
    expect(executed.some((item) => item.text.includes("INSERT INTO query_traces"))).toBe(false);
  });

  it("uses an injected generation provider and passes selected context with model config", async () => {
    const embeddingProvider: EmbeddingProvider = {
      embedTexts: async () => [[0.1, 0.2, 0.3]]
    };
    const queryExecutor = {
      query: async () => ({
        rows: [
          {
            document_id: "hybrid-retrieval-note",
            document_title: "Hybrid Retrieval Note",
            source_type: "public-doc",
            source_url: null,
            document_version: "v1",
            chunk_id: "hybrid-retrieval-note#chunk-001",
            heading_path: ["Hybrid Retrieval Note"],
            normalized_text:
              "Hybrid retrieval explains why teams should not rely only on semantic vectors because lexical retrieval preserves exact signals.",
            content_hash: "hash-001",
            chunk_version: "v1",
            lexical_rank: 1,
            vector_rank: 1,
            retrieval_score: "0.032"
          }
        ]
      })
    };
    const generationInputs: Parameters<LLMProvider["generateAnswer"]>[0][] = [];
    const llmProvider: LLMProvider = {
      name: "openai-compatible",
      generateAnswer: async (input) => {
        generationInputs.push(input);
        return {
          status: "answered",
          answer: "Injected provider answer.",
          claims: [
            {
              id: "claim-1",
              text: "Injected provider received selected context.",
              citations: [
                {
                  documentId: "hybrid-retrieval-note",
                  chunkId: "hybrid-retrieval-note#chunk-001",
                  quote: "Hybrid retrieval combines lexical retrieval and vector retrieval."
                }
              ]
            }
          ]
        };
      }
    };

    const result = await runPostgresRagPipeline({
      question: "Why not rely only on semantic vectors?",
      embeddingProvider,
      queryExecutor,
      llmProvider,
      modelConfig: {
        provider: "openai-compatible",
        model: "test-chat-model"
      }
    });

    expect(generationInputs).toHaveLength(1);
    expect(generationInputs[0]?.selectedContext[0]?.chunk.id).toBe("hybrid-retrieval-note#chunk-001");
    expect(generationInputs[0]?.modelConfig).toEqual({
      provider: "openai-compatible",
      model: "test-chat-model"
    });
    expect(result.generation).toMatchObject({
      status: "answered",
      answer: "Injected provider answer."
    });
    expect(result.trace.generation).toBe(result.generation);
  });

  it("creates an Anthropic live provider when LLM_PROVIDER is anthropic", async () => {
    const requests: Array<{ url: string; init: RequestInit; body: Record<string, unknown> }> = [];
    const provider = createLiveLLMProvider(
      {
        llmProvider: "anthropic",
        chatModel: "test-claude-model"
      },
      {
        OPENAI_API_KEY: "test-openai-key",
        ANTHROPIC_API_KEY: "test-anthropic-key",
        ANTHROPIC_MODEL: "test-claude-model"
      },
      async (url: string | URL | Request, init?: RequestInit) => {
        requests.push({ url: String(url), init: init ?? {}, body: JSON.parse(String(init?.body)) as Record<string, unknown> });
        return Response.json({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                answer: "Anthropic provider used selected context.",
                claims: [
                  {
                    id: "claim-1",
                    text: "Anthropic provider cited selected context.",
                    citations: [
                      {
                        documentId: "hybrid-retrieval-note",
                        chunkId: "hybrid-retrieval-note#chunk-001"
                      }
                    ]
                  }
                ]
              })
            }
          ]
        });
      }
    );

    const result = await provider.generateAnswer({
      question: "Why not rely only on semantic vectors?",
      selectedContext: [
        {
          chunk: {
            id: "hybrid-retrieval-note#chunk-001",
            documentId: "hybrid-retrieval-note",
            headingPath: ["Hybrid Retrieval Note"],
            text: "Hybrid retrieval combines lexical retrieval and vector retrieval.",
            contentHash: "hash-001",
            version: "v1"
          },
          score: {
            lexicalRank: 1,
            vectorRank: 1,
            fusedRank: 1,
            retrievalScore: 0.99,
            trustScore: 1,
            freshnessScore: 1,
            duplicatePenalty: 0
          }
        }
      ],
      citationPolicy: {
        requireCitationPerClaim: true,
        rejectUnsupportedClaims: true
      },
      modelConfig: {
        provider: "anthropic",
        model: "test-claude-model"
      }
    });

    expect(provider.name).toBe("anthropic");
    expect(requests[0]?.url).toBe("https://api.anthropic.com/v1/messages");
    expect(requests[0]?.init.headers).toMatchObject({
      "x-api-key": "test-anthropic-key",
      "anthropic-version": "2023-06-01"
    });
    expect(requests[0]?.body).toMatchObject({
      model: "test-claude-model",
      max_tokens: 1024
    });
    expect(result.status).toBe("answered");
  });
});
