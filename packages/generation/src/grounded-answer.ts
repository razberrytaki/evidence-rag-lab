import type { GeneratedAnswer, GenerationRejected, GenerationResult, RetrievalResult } from "@evidencerag/domain";
import type { GenerateAnswerInput } from "./llm-provider";

export interface GroundedAnswerPayload {
  status?: "answered" | "conflict";
  answer: string;
  claims: Array<{
    id: string;
    text: string;
    citations: Array<{
      documentId: string;
      chunkId: string;
    }>;
  }>;
}

export const GROUNDED_JSON_SYSTEM_PROMPT = [
  "You answer only from selected context.",
  "Return JSON only with this shape:",
  '{"answer":"...","claims":[{"id":"claim-1","text":"...","citations":[{"documentId":"...","chunkId":"..."}]}]}',
  "Every major claim must cite at least one selected chunk.",
  "If selected context is insufficient, say so in the answer and cite no unsupported claims."
].join("\n");

export function renderGroundedUserPrompt(question: string, selectedContext: RetrievalResult[]): string {
  const context = selectedContext
    .map((result, index) =>
      [
        `Context ${index + 1}`,
        `documentId: ${result.chunk.documentId}`,
        `chunkId: ${result.chunk.id}`,
        `headingPath: ${result.chunk.headingPath.join(" > ")}`,
        "text:",
        result.chunk.text
      ].join("\n")
    )
    .join("\n\n---\n\n");

  return [`Question: ${question}`, "", "Selected context:", context].join("\n");
}

export function validateGroundedAnswer(payload: GroundedAnswerPayload, input: GenerateAnswerInput): GenerationResult {
  const contextByChunkId = new Map(input.selectedContext.map((result) => [result.chunk.id, result]));
  const claims: GeneratedAnswer["claims"] = [];

  for (const claim of payload.claims) {
    if (input.citationPolicy.requireCitationPerClaim && claim.citations.length === 0) {
      return rejected("unsupported_claim", `Claim ${claim.id} did not include a citation.`);
    }

    const citations: GeneratedAnswer["claims"][number]["citations"] = [];
    for (const citation of claim.citations) {
      const context = contextByChunkId.get(citation.chunkId);
      if (!context || context.chunk.documentId !== citation.documentId) {
        if (input.citationPolicy.rejectUnsupportedClaims) {
          return rejected(
            "citation_validation_failed",
            `Provider cited a chunk outside the selected context: ${citation.chunkId}.`
          );
        }
        continue;
      }

      citations.push({
        documentId: context.chunk.documentId,
        chunkId: context.chunk.id,
        sourceUrl: undefined,
        quote: context.chunk.text.slice(0, 160)
      });
    }

    claims.push({
      id: claim.id,
      text: claim.text,
      citations
    });
  }

  return {
    status: payload.status ?? "answered",
    answer: payload.answer,
    claims
  };
}

export function parseGroundedAnswerPayload(content: string): GroundedAnswerPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Provider response was not valid grounded answer JSON");
  }

  if (!isRecord(parsed) || typeof parsed.answer !== "string" || !Array.isArray(parsed.claims)) {
    throw new Error("Provider grounded answer JSON is missing answer or claims");
  }

  const status = parsed.status;
  if (status !== undefined && status !== "answered" && status !== "conflict") {
    throw new Error("Provider grounded answer JSON contains an invalid status");
  }

  return {
    status,
    answer: parsed.answer,
    claims: parsed.claims.map((claim) => {
      if (!isRecord(claim) || typeof claim.id !== "string" || typeof claim.text !== "string" || !Array.isArray(claim.citations)) {
        throw new Error("Provider grounded answer JSON contains an invalid claim");
      }

      return {
        id: claim.id,
        text: claim.text,
        citations: claim.citations.map((citation) => {
          if (!isRecord(citation) || typeof citation.documentId !== "string" || typeof citation.chunkId !== "string") {
            throw new Error("Provider grounded answer JSON contains an invalid citation");
          }
          return {
            documentId: citation.documentId,
            chunkId: citation.chunkId
          };
        })
      };
    })
  };
}

export function rejected(reason: GenerationRejected["reason"], message: string): GenerationRejected {
  return {
    status: "rejected",
    reason,
    message
  };
}

export function requireNonEmpty(value: string, fieldName: string): string {
  if (!value.trim()) {
    throw new Error(`${fieldName} must not be empty`);
  }
  return value;
}

export function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function safeErrorBody(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "<unavailable>";
  }
}
