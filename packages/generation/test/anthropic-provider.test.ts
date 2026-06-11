import { describe, expect, it } from "vitest";
import type { RetrievalResult } from "@evidencerag/domain";
import { AnthropicLLMProvider, loadAnthropicLLMConfigFromEnv } from "../src/anthropic-provider";

describe("Anthropic LLM provider", () => {
  it("posts a grounded Messages request and maps citations back to selected context", async () => {
    const requests: Array<{ url: string; init: RequestInit; body: Record<string, unknown> }> = [];
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      requests.push({ url: String(url), init: init ?? {}, body });
      return Response.json({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              answer: "Hybrid retrieval uses keyword and vector evidence.",
              claims: [
                {
                  id: "claim-1",
                  text: "Hybrid retrieval combines keyword and vector evidence.",
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
    };
    const provider = new AnthropicLLMProvider({
      apiKey: "test-anthropic-key",
      baseUrl: "https://anthropic.example/v1/",
      model: "test-claude-model",
      maxTokens: 700,
      fetchImpl
    });

    const result = await provider.generateAnswer({
      question: "Why not rely only on semantic vectors?",
      selectedContext: [selectedHybridContext()],
      citationPolicy: {
        requireCitationPerClaim: true,
        rejectUnsupportedClaims: true
      },
      modelConfig: {
        provider: "anthropic",
        model: "test-claude-model"
      }
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://anthropic.example/v1/messages");
    expect(requests[0]?.init.method).toBe("POST");
    expect(requests[0]?.init.headers).toMatchObject({
      "x-api-key": "test-anthropic-key",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    });
    expect(requests[0]?.body).toMatchObject({
      model: "test-claude-model",
      max_tokens: 700
    });
    expect(JSON.stringify(requests[0]?.body)).toContain("hybrid-retrieval-note#chunk-001");
    expect(JSON.stringify(requests[0]?.body)).toContain("Why not rely only on semantic vectors?");

    expect(result).toEqual({
      status: "answered",
      answer: "Hybrid retrieval uses keyword and vector evidence.",
      claims: [
        {
          id: "claim-1",
          text: "Hybrid retrieval combines keyword and vector evidence.",
          citations: [
            {
              documentId: "hybrid-retrieval-note",
              chunkId: "hybrid-retrieval-note#chunk-001",
              sourceUrl: undefined,
              quote:
                "Hybrid retrieval combines exact keyword matching with semantic vector search so weak vector-only matches can be checked."
            }
          ]
        }
      ]
    });
  });

  it("rejects provider output that cites chunks outside the selected context", async () => {
    const provider = new AnthropicLLMProvider({
      apiKey: "test-anthropic-key",
      model: "test-claude-model",
      fetchImpl: async () =>
        Response.json({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                answer: "Unsupported answer.",
                claims: [
                  {
                    id: "claim-1",
                    text: "This claim cites an unknown chunk.",
                    citations: [
                      {
                        documentId: "unknown-doc",
                        chunkId: "unknown-doc#chunk-001"
                      }
                    ]
                  }
                ]
              })
            }
          ]
        })
    });

    const result = await provider.generateAnswer({
      question: "Why not rely only on semantic vectors?",
      selectedContext: [selectedHybridContext()],
      citationPolicy: {
        requireCitationPerClaim: true,
        rejectUnsupportedClaims: true
      },
      modelConfig: {
        provider: "anthropic",
        model: "test-claude-model"
      }
    });

    expect(result).toEqual({
      status: "rejected",
      reason: "citation_validation_failed",
      message: "Provider cited a chunk outside the selected context: unknown-doc#chunk-001."
    });
  });

  it("rejects empty selected context without calling the provider", async () => {
    let fetchCalled = false;
    const provider = new AnthropicLLMProvider({
      apiKey: "test-anthropic-key",
      model: "test-claude-model",
      fetchImpl: async () => {
        fetchCalled = true;
        return Response.json({});
      }
    });

    const result = await provider.generateAnswer({
      question: "What unpublished evidence exists?",
      selectedContext: [],
      citationPolicy: {
        requireCitationPerClaim: true,
        rejectUnsupportedClaims: true
      },
      modelConfig: {
        provider: "anthropic",
        model: "test-claude-model"
      }
    });

    expect(fetchCalled).toBe(false);
    expect(result).toEqual({
      status: "rejected",
      reason: "insufficient_evidence",
      message: "No selected context was available."
    });
  });

  it("rejects malformed provider JSON without returning the raw provider content", async () => {
    const provider = new AnthropicLLMProvider({
      apiKey: "test-anthropic-key",
      model: "test-claude-model",
      fetchImpl: async () =>
        Response.json({
          content: [
            {
              type: "text",
              text: "not-json-with-sensitive-provider-debug"
            }
          ]
        })
    });

    const result = await provider.generateAnswer({
      question: "Why not rely only on semantic vectors?",
      selectedContext: [selectedHybridContext()],
      citationPolicy: {
        requireCitationPerClaim: true,
        rejectUnsupportedClaims: true
      },
      modelConfig: {
        provider: "anthropic",
        model: "test-claude-model"
      }
    });

    expect(result).toEqual({
      status: "rejected",
      reason: "citation_validation_failed",
      message: "Provider response was not valid grounded answer JSON."
    });
    expect(JSON.stringify(result)).not.toContain("not-json-with-sensitive-provider-debug");
  });

  it("loads Anthropic generation config from env", () => {
    expect(
      loadAnthropicLLMConfigFromEnv({
        ANTHROPIC_API_KEY: " test-anthropic-key ",
        ANTHROPIC_MODEL: " test-claude-model "
      })
    ).toEqual({
      apiKey: "test-anthropic-key",
      baseUrl: "https://api.anthropic.com/v1",
      model: "test-claude-model",
      maxTokens: 1024
    });
  });
});

function selectedHybridContext(): RetrievalResult {
  return {
    chunk: {
      id: "hybrid-retrieval-note#chunk-001",
      documentId: "hybrid-retrieval-note",
      headingPath: ["Hybrid Retrieval Note"],
      text:
        "Hybrid retrieval combines exact keyword matching with semantic vector search so weak vector-only matches can be checked.",
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
  };
}
