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

export const DEFAULT_OPENAI_COMPATIBLE_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_OPENAI_COMPATIBLE_CHAT_MODEL = "gpt-5.4-mini";

export interface OpenAICompatibleProviderConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

export interface OpenAICompatibleProviderEnv {
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_CHAT_MODEL?: string;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string | null;
    };
  }>;
}

export class OpenAICompatibleLLMProvider implements LLMProvider {
  readonly name = "openai-compatible";

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OpenAICompatibleProviderConfig) {
    this.apiKey = requireNonEmpty(config.apiKey, "apiKey");
    this.baseUrl = normalizeBaseUrl(config.baseUrl ?? DEFAULT_OPENAI_COMPATIBLE_BASE_URL);
    this.model = config.model ?? DEFAULT_OPENAI_COMPATIBLE_CHAT_MODEL;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async generateAnswer(input: GenerateAnswerInput): Promise<GenerationResult> {
    if (input.selectedContext.length === 0) {
      return rejected("insufficient_evidence", "No selected context was available.");
    }

    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(this.buildRequestBody(input))
    });

    if (!response.ok) {
      throw new Error(`OpenAI-compatible chat request failed with status ${response.status}: ${await safeErrorBody(response)}`);
    }

    try {
      const payload = parseGroundedAnswerPayload(extractContent(await response.json()));
      return validateGroundedAnswer(payload, input);
    } catch {
      return rejected("citation_validation_failed", "Provider response was not valid grounded answer JSON.");
    }
  }

  private buildRequestBody(input: GenerateAnswerInput): Record<string, unknown> {
    return {
      model: this.model,
      messages: [
        {
          role: "system",
          content: GROUNDED_JSON_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: renderGroundedUserPrompt(input.question, input.selectedContext)
        }
      ],
      response_format: {
        type: "json_object"
      }
    };
  }
}

export function loadOpenAICompatibleLLMConfigFromEnv(env: OpenAICompatibleProviderEnv): Required<
  Pick<OpenAICompatibleProviderConfig, "apiKey" | "baseUrl" | "model">
> {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for live OpenAI-compatible generation");
  }

  return {
    apiKey,
    baseUrl: normalizeBaseUrl(env.OPENAI_BASE_URL?.trim() || DEFAULT_OPENAI_COMPATIBLE_BASE_URL),
    model: env.OPENAI_CHAT_MODEL?.trim() || DEFAULT_OPENAI_COMPATIBLE_CHAT_MODEL
  };
}

function extractContent(value: unknown): string {
  const body = parseChatCompletionResponse(value);
  const content = body.choices[0]?.message.content;
  if (!content) {
    throw new Error("OpenAI-compatible chat response is missing message content");
  }
  return content;
}

function parseChatCompletionResponse(value: unknown): ChatCompletionResponse {
  if (!isRecord(value) || !Array.isArray(value.choices)) {
    throw new Error("OpenAI-compatible chat response is missing choices");
  }

  return {
    choices: value.choices.map((choice) => {
      if (!isRecord(choice) || !isRecord(choice.message)) {
        throw new Error("OpenAI-compatible chat response contains an invalid choice");
      }
      const content = choice.message.content;
      if (typeof content !== "string" && content !== null) {
        throw new Error("OpenAI-compatible chat response contains invalid message content");
      }
      return {
        message: {
          content
        }
      };
    })
  };
}
