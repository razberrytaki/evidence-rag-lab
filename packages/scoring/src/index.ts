import type { SourceDocument } from "@evidencerag/domain";

export interface TrustScoreInput {
  source: SourceDocument;
  duplicateCount: number;
  retrievalAgreement: number;
}

export function computeTrustScore(input: TrustScoreInput): number {
  const sourceTypeScore = input.source.sourceType === "public-doc" ? 0.8 : 0.6;
  const duplicatePenalty = Math.min(input.duplicateCount * 0.1, 0.4);
  const score = sourceTypeScore + input.retrievalAgreement * 0.2 - duplicatePenalty;
  return clamp(score, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
