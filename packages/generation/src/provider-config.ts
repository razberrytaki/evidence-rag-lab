export interface ProviderEnv {
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_EMBEDDING_MODEL?: string;
  EMBEDDING_DIMENSIONS?: string;
  OPENAI_CHAT_MODEL?: string;
  LLM_PROVIDER?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_BASE_URL?: string;
  ANTHROPIC_MODEL?: string;
  ANTHROPIC_MAX_TOKENS?: string;
  EVAL_LLM_PROVIDER?: string;
  TRACE_SANITIZE?: string;
}

export interface ResolvedProviderConfig {
  embeddingModel: string;
  embeddingDimensions: number;
  llmProvider: "openai-compatible" | "anthropic" | "fake";
  chatModel: string;
  traceSanitize: boolean;
}

export function resolveProviderConfig(env: ProviderEnv, mode: "live" | "test"): ResolvedProviderConfig {
  if (mode === "test") {
    return {
      embeddingModel: env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      embeddingDimensions: parseInteger(env.EMBEDDING_DIMENSIONS, 1536),
      llmProvider: "fake",
      chatModel: "fake",
      traceSanitize: true
    };
  }

  if (!env.OPENAI_API_KEY) {
    throw new SetupRequiredError("missing_openai_api_key");
  }

  const requested = env.LLM_PROVIDER ?? "openai-compatible";
  if (requested === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) {
      throw new SetupRequiredError("missing_anthropic_api_key");
    }
    return {
      embeddingModel: env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      embeddingDimensions: parseInteger(env.EMBEDDING_DIMENSIONS, 1536),
      llmProvider: "anthropic",
      chatModel: env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      traceSanitize: env.TRACE_SANITIZE !== "false"
    };
  }

  return {
    embeddingModel: env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    embeddingDimensions: parseInteger(env.EMBEDDING_DIMENSIONS, 1536),
    llmProvider: "openai-compatible",
    chatModel: env.OPENAI_CHAT_MODEL ?? "gpt-5.4-mini",
    traceSanitize: env.TRACE_SANITIZE !== "false"
  };
}

export class SetupRequiredError extends Error {
  constructor(readonly reason: "missing_openai_api_key" | "missing_anthropic_api_key") {
    super(`SetupRequired(reason: "${reason}")`);
    this.name = "SetupRequiredError";
  }
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
