import type { GenerationResult } from "@evidencerag/domain";
import {
  GROUNDED_JSON_SYSTEM_PROMPT,
  isRecord,
  normalizeBaseUrl,
  parseGroundedAnswerPayload,
  rejected,
  renderGroundedUserPrompt,
  requireNonEmpty,
  safeErrorBody,
  validateGroundedAnswer
} from "./grounded-answer";
import type { GenerateAnswerInput, LLMProvider } from "./llm-provider";

export const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";
export const DEFAULT_ANTHROPIC_VERSION = "2023-06-01";
export const DEFAULT_ANTHROPIC_MAX_TOKENS = 1024;

export interface AnthropicProviderConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  anthropicVersion?: string;
  fetchImpl?: typeof fetch;
}

export interface AnthropicProviderEnv {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_BASE_URL?: string;
  ANTHROPIC_MODEL?: string;
  ANTHROPIC_MAX_TOKENS?: string;
}

interface AnthropicMessagesResponse {
  content: Array<{
    type: string;
    text?: string;
  }>;
}

export class AnthropicLLMProvider implements LLMProvider {
  readonly name = "anthropic";

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly anthropicVersion: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: AnthropicProviderConfig) {
    this.apiKey = requireNonEmpty(config.apiKey, "apiKey");
    this.baseUrl = normalizeBaseUrl(config.baseUrl ?? DEFAULT_ANTHROPIC_BASE_URL);
    this.model = config.model ?? DEFAULT_ANTHROPIC_MODEL;
    this.maxTokens = config.maxTokens ?? DEFAULT_ANTHROPIC_MAX_TOKENS;
    this.anthropicVersion = config.anthropicVersion ?? DEFAULT_ANTHROPIC_VERSION;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async generateAnswer(input: GenerateAnswerInput): Promise<GenerationResult> {
    if (input.selectedContext.length === 0) {
      return rejected("insufficient_evidence", "No selected context was available.");
    }

    const response = await this.fetchImpl(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": this.anthropicVersion,
        "content-type": "application/json"
      },
      body: JSON.stringify(this.buildRequestBody(input))
    });

    if (!response.ok) {
      throw new Error(`Anthropic messages request failed with status ${response.status}: ${await safeErrorBody(response)}`);
    }

    try {
      const payload = parseGroundedAnswerPayload(extractTextContent(await response.json()));
      return validateGroundedAnswer(payload, input);
    } catch {
      return rejected("citation_validation_failed", "Provider response was not valid grounded answer JSON.");
    }
  }

  private buildRequestBody(input: GenerateAnswerInput): Record<string, unknown> {
    return {
      model: this.model,
      max_tokens: this.maxTokens,
      system: GROUNDED_JSON_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: renderGroundedUserPrompt(input.question, input.selectedContext)
        }
      ]
    };
  }
}

export function loadAnthropicLLMConfigFromEnv(env: AnthropicProviderEnv): Required<
  Pick<AnthropicProviderConfig, "apiKey" | "baseUrl" | "model" | "maxTokens">
> {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is required for live Anthropic generation");
  }

  return {
    apiKey,
    baseUrl: normalizeBaseUrl(env.ANTHROPIC_BASE_URL?.trim() || DEFAULT_ANTHROPIC_BASE_URL),
    model: env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL,
    maxTokens: parsePositiveInteger(env.ANTHROPIC_MAX_TOKENS, DEFAULT_ANTHROPIC_MAX_TOKENS)
  };
}

function extractTextContent(value: unknown): string {
  const body = parseAnthropicMessagesResponse(value);
  const text = body.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .filter((text): text is string => typeof text === "string")
    .join("");
  if (!text) {
    throw new Error("Anthropic messages response is missing text content");
  }
  return text;
}

function parseAnthropicMessagesResponse(value: unknown): AnthropicMessagesResponse {
  if (!isRecord(value) || !Array.isArray(value.content)) {
    throw new Error("Anthropic messages response is missing content");
  }

  return {
    content: value.content.map((block) => {
      if (!isRecord(block) || typeof block.type !== "string") {
        throw new Error("Anthropic messages response contains an invalid content block");
      }
      const text = block.text;
      if (text !== undefined && typeof text !== "string") {
        throw new Error("Anthropic messages response contains invalid text content");
      }
      return {
        type: block.type,
        text
      };
    })
  };
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
