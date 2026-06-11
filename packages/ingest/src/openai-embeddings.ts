export const DEFAULT_OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
export const DEFAULT_OPENAI_EMBEDDING_DIMENSIONS = 1536;
export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

export interface EmbeddingProvider {
  embedTexts(texts: readonly string[]): Promise<number[][]>;
}

export interface OpenAIEmbeddingConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  dimensions?: number;
  fetchImpl?: typeof fetch;
}

export interface OpenAIEmbeddingEnv {
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_EMBEDDING_MODEL?: string;
  EMBEDDING_DIMENSIONS?: string;
}

interface OpenAIEmbeddingResponse {
  data: Array<{
    index: number;
    embedding: number[];
  }>;
}

export class OpenAIEmbeddingClient implements EmbeddingProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly dimensions?: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OpenAIEmbeddingConfig) {
    this.apiKey = requireNonEmpty(config.apiKey, "apiKey");
    this.baseUrl = normalizeBaseUrl(config.baseUrl ?? DEFAULT_OPENAI_BASE_URL);
    this.model = config.model ?? DEFAULT_OPENAI_EMBEDDING_MODEL;
    this.dimensions = config.dimensions;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async embedTexts(texts: readonly string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const response = await this.fetchImpl(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(this.buildRequestBody(texts))
    });

    if (!response.ok) {
      throw new Error(`OpenAI embeddings request failed with status ${response.status}: ${await safeErrorBody(response)}`);
    }

    const body = parseEmbeddingResponse(await response.json());
    return body.data
      .slice()
      .sort((left, right) => left.index - right.index)
      .map((item) => validateEmbedding(item.embedding));
  }

  private buildRequestBody(texts: readonly string[]): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.model,
      input: texts,
      encoding_format: "float"
    };

    if (this.dimensions !== undefined) {
      body.dimensions = this.dimensions;
    }

    return body;
  }
}

export function loadOpenAIEmbeddingConfigFromEnv(env: OpenAIEmbeddingEnv): Required<
  Pick<OpenAIEmbeddingConfig, "apiKey" | "baseUrl" | "model" | "dimensions">
> {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for live OpenAI embeddings");
  }

  return {
    apiKey,
    baseUrl: normalizeBaseUrl(env.OPENAI_BASE_URL?.trim() || DEFAULT_OPENAI_BASE_URL),
    model: env.OPENAI_EMBEDDING_MODEL?.trim() || DEFAULT_OPENAI_EMBEDDING_MODEL,
    dimensions: parseDimensions(env.EMBEDDING_DIMENSIONS)
  };
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function parseDimensions(value: string | undefined): number {
  if (!value) {
    return DEFAULT_OPENAI_EMBEDDING_DIMENSIONS;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("EMBEDDING_DIMENSIONS must be a positive integer");
  }
  return parsed;
}

function requireNonEmpty(value: string, fieldName: string): string {
  if (!value.trim()) {
    throw new Error(`${fieldName} must not be empty`);
  }
  return value;
}

function parseEmbeddingResponse(value: unknown): OpenAIEmbeddingResponse {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    throw new Error("OpenAI embeddings response is missing data");
  }

  return {
    data: value.data.map((item) => {
      if (!isRecord(item) || typeof item.index !== "number" || !Array.isArray(item.embedding)) {
        throw new Error("OpenAI embeddings response contains an invalid item");
      }
      return {
        index: item.index,
        embedding: item.embedding
      };
    })
  };
}

function validateEmbedding(embedding: unknown[]): number[] {
  if (embedding.length === 0) {
    throw new Error("OpenAI embeddings response contains an empty embedding");
  }

  return embedding.map((value) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error("OpenAI embeddings response contains a non-finite embedding value");
    }
    return value;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function safeErrorBody(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "<unavailable>";
  }
}
