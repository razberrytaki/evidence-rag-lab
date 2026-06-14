import {
  AnthropicLLMProvider,
  type LLMProvider,
  loadAnthropicLLMConfigFromEnv,
  loadOpenAICompatibleLLMConfigFromEnv,
  OpenAICompatibleLLMProvider,
  type ProviderEnv,
  type ResolvedProviderConfig
} from "@evidencerag/generation";

export function createLiveLLMProvider(
  providerConfig: Pick<ResolvedProviderConfig, "llmProvider" | "chatModel">,
  env: ProviderEnv,
  fetchImpl?: typeof fetch
): LLMProvider {
  if (providerConfig.llmProvider === "anthropic") {
    return new AnthropicLLMProvider({
      ...loadAnthropicLLMConfigFromEnv(env),
      fetchImpl
    });
  }

  return new OpenAICompatibleLLMProvider({
    ...loadOpenAICompatibleLLMConfigFromEnv(env),
    fetchImpl
  });
}
