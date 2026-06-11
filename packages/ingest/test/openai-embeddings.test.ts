import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPENAI_EMBEDDING_MODEL,
  OpenAIEmbeddingClient,
  loadOpenAIEmbeddingConfigFromEnv
} from "../src/openai-embeddings";

describe("OpenAI embedding client", () => {
  it("posts batched text to an OpenAI-compatible embeddings endpoint without leaking credentials", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      requests.push({ url: String(url), init: init ?? {} });
      return new Response(
        JSON.stringify({
          data: [
            { index: 1, embedding: [0.3, 0.4, 0.5] },
            { index: 0, embedding: [0.1, 0.2, 0.3] }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };

    const client = new OpenAIEmbeddingClient({
      apiKey: "test-openai-key",
      baseUrl: "https://api.openai.test/v1/",
      model: "text-embedding-3-small",
      dimensions: 1536,
      fetchImpl
    });

    await expect(client.embedTexts(["first chunk", "second chunk"])).resolves.toEqual([
      [0.1, 0.2, 0.3],
      [0.3, 0.4, 0.5]
    ]);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://api.openai.test/v1/embeddings");
    expect(requests[0]?.init.method).toBe("POST");
    expect(requests[0]?.init.headers).toEqual({
      authorization: "Bearer test-openai-key",
      "content-type": "application/json"
    });
    expect(JSON.parse(String(requests[0]?.init.body))).toEqual({
      model: "text-embedding-3-small",
      input: ["first chunk", "second chunk"],
      encoding_format: "float",
      dimensions: 1536
    });
  });

  it("requires an API key before live OpenAI embeddings can be configured", () => {
    expect(() =>
      loadOpenAIEmbeddingConfigFromEnv({
        OPENAI_API_KEY: "",
        OPENAI_EMBEDDING_MODEL: "",
        EMBEDDING_DIMENSIONS: "1536"
      })
    ).toThrow("OPENAI_API_KEY is required for live OpenAI embeddings");
  });

  it("uses the agreed text-embedding-3-small default with 1536 dimensions", () => {
    expect(
      loadOpenAIEmbeddingConfigFromEnv({
        OPENAI_API_KEY: "test-openai-key"
      })
    ).toMatchObject({
      apiKey: "test-openai-key",
      baseUrl: "https://api.openai.com/v1",
      model: DEFAULT_OPENAI_EMBEDDING_MODEL,
      dimensions: 1536
    });
  });
});
