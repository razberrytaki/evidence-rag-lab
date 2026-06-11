import type { GeneratedAnswer, GenerationRejected, GenerationResult } from "@evidencerag/domain";
import type { GenerateAnswerInput, LLMProvider } from "./llm-provider";

export class FakeLLMProvider implements LLMProvider {
  readonly name = "fake";

  async generateAnswer(input: GenerateAnswerInput): Promise<GenerationResult> {
    if (input.selectedContext.length === 0) {
      return rejected("insufficient_evidence", "No selected context was available.");
    }

    const best = input.selectedContext[0];
    if (best.score.retrievalScore < 0.5 || best.score.trustScore < 0.5) {
      return rejected("low_retrieval_confidence", "Retrieval confidence was below the answer threshold.");
    }

    const conflict = input.selectedContext.some((result) =>
      result.chunk.text.toLowerCase().includes("[conflict]")
    );

    const firstCitation = {
      documentId: best.chunk.documentId,
      chunkId: best.chunk.id,
      sourceUrl: undefined,
      quote: best.chunk.text.slice(0, 160)
    };

    const answer: GeneratedAnswer = {
      status: conflict ? "conflict" : "answered",
      answer: conflict
        ? "The retrieved sources conflict. The trace should show which evidence was selected and rejected."
        : "The answer is grounded in the selected context and includes a citation.",
      claims: [
        {
          id: "claim-1",
          text: conflict
            ? "Retrieved sources contain a conflict that must be surfaced."
            : "The selected context supports this answer.",
          citations: [firstCitation]
        }
      ]
    };

    return answer;
  }
}

function rejected(reason: GenerationRejected["reason"], message: string): GenerationRejected {
  return {
    status: "rejected",
    reason,
    message
  };
}
