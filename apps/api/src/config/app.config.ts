import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { OpenAIEmbeddingEnv } from "@evidencerag/ingest";
import type { ProviderEnv } from "@evidencerag/generation";

export type QueryMode = "sample" | "postgres";

export const DEFAULT_DATABASE_URL = "postgresql://evidence:rag@localhost:5432/evidence_rag_lab";

const DEFAULT_CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];
const DEFAULT_RATE_LIMIT_MAX = 30;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

type RawConfig = Record<string, unknown>;

@Injectable()
export class AppConfigService {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  get port(): number {
    return parsePort(readOptionalString(this.configService, "PORT"));
  }

  get queryMode(): QueryMode {
    return parseQueryMode(readOptionalString(this.configService, "RAG_QUERY_MODE"));
  }

  get databaseUrl(): string {
    return readOptionalString(this.configService, "DATABASE_URL") ?? DEFAULT_DATABASE_URL;
  }

  get apiAuthToken(): string | undefined {
    return normalizeOptionalString(readOptionalString(this.configService, "API_AUTH_TOKEN"));
  }

  get corsOrigins(): string[] {
    const configured = parseCorsOrigins(readOptionalString(this.configService, "API_CORS_ORIGINS"));
    return configured.length > 0 ? configured : DEFAULT_CORS_ORIGINS;
  }

  get rateLimitMax(): number {
    return parsePositiveInteger(
      readOptionalString(this.configService, "API_RATE_LIMIT_MAX"),
      "API_RATE_LIMIT_MAX",
      DEFAULT_RATE_LIMIT_MAX
    );
  }

  get rateLimitWindowMs(): number {
    return parsePositiveInteger(
      readOptionalString(this.configService, "API_RATE_LIMIT_WINDOW_MS"),
      "API_RATE_LIMIT_WINDOW_MS",
      DEFAULT_RATE_LIMIT_WINDOW_MS
    );
  }

  get providerEnv(): OpenAIEmbeddingEnv & ProviderEnv {
    return {
      OPENAI_API_KEY: readOptionalString(this.configService, "OPENAI_API_KEY"),
      OPENAI_EMBEDDING_MODEL: readOptionalString(this.configService, "OPENAI_EMBEDDING_MODEL"),
      OPENAI_CHAT_MODEL: readOptionalString(this.configService, "OPENAI_CHAT_MODEL"),
      OPENAI_BASE_URL: readOptionalString(this.configService, "OPENAI_BASE_URL"),
      LLM_PROVIDER: readOptionalString(this.configService, "LLM_PROVIDER"),
      ANTHROPIC_API_KEY: readOptionalString(this.configService, "ANTHROPIC_API_KEY"),
      ANTHROPIC_MODEL: readOptionalString(this.configService, "ANTHROPIC_MODEL")
    };
  }
}

export function validateAppConfig(config: RawConfig): RawConfig {
  parsePort(readRawString(config, "PORT"));
  parseQueryMode(readRawString(config, "RAG_QUERY_MODE"));
  parseCorsOrigins(readRawString(config, "API_CORS_ORIGINS"));
  parsePositiveInteger(readRawString(config, "API_RATE_LIMIT_MAX"), "API_RATE_LIMIT_MAX", DEFAULT_RATE_LIMIT_MAX);
  parsePositiveInteger(
    readRawString(config, "API_RATE_LIMIT_WINDOW_MS"),
    "API_RATE_LIMIT_WINDOW_MS",
    DEFAULT_RATE_LIMIT_WINDOW_MS
  );
  return config;
}

export function parseQueryMode(value: string | undefined): QueryMode {
  const mode = (value ?? "sample").trim().toLowerCase();
  if (mode === "sample" || mode === "postgres") {
    return mode;
  }
  throw new Error(`unsupported RAG_QUERY_MODE: ${value}`);
}

function parsePort(value: string | undefined): number {
  return parsePositiveInteger(value, "PORT", 3000, 65_535);
}

function parsePositiveInteger(value: string | undefined, key: string, fallback: number, max?: number): number {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return fallback;
  }
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || (max !== undefined && parsed > max)) {
    throw new Error(`${key} must be an integer between 1 and ${max ?? "Infinity"}`);
  }
  return parsed;
}

function parseCorsOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function readOptionalString(configService: ConfigService, key: string): string | undefined {
  const value = configService.get<string | undefined>(key);
  return typeof value === "string" ? value : undefined;
}

function readRawString(config: RawConfig, key: string): string | undefined {
  const value = config[key];
  return typeof value === "string" ? value : undefined;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
