import type { GenerationResult, RetrievalResult } from "@evidencerag/domain";

export interface CitationPolicy {
  requireCitationPerClaim: boolean;
  rejectUnsupportedClaims: boolean;
}

export interface GenerateAnswerInput {
  question: string;
  selectedContext: RetrievalResult[];
  citationPolicy: CitationPolicy;
  modelConfig: {
    provider: "openai-compatible" | "anthropic" | "fake";
    model: string;
  };
}

export interface LLMProvider {
  readonly name: string;
  generateAnswer(input: GenerateAnswerInput): Promise<GenerationResult>;
}
