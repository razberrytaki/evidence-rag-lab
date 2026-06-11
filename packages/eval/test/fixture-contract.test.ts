import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FakeLLMProvider } from "@evidencerag/generation";
import type { RetrievalResult } from "@evidencerag/domain";
import type { EvalFixture } from "../src";

const fixtureFiles = [
  "retrieval-basic.json",
  "trust-and-conflict.json",
  "generation-guard.json",
  "trace-and-regression.json"
];

describe("initial eval fixtures", () => {
  it("defines exactly 15 deterministic reliability fixtures", () => {
    const fixtures = fixtureFiles.flatMap(loadFixtureFile);
    expect(fixtures).toHaveLength(15);
    expect(new Set(fixtures.map((fixture) => fixture.id)).size).toBe(15);
  });

  it("uses fake generation for CI without external provider calls", async () => {
    const provider = new FakeLLMProvider();
    const result = await provider.generateAnswer({
      question: "What supports this answer?",
      selectedContext: [makeRetrievalResult("sample-doc#chunk-001", 0.9, 0.9)],
      citationPolicy: {
        requireCitationPerClaim: true,
        rejectUnsupportedClaims: true
      },
      modelConfig: {
        provider: "fake",
        model: "fake"
      }
    });

    expect(result.status).toBe("answered");
    if (result.status === "answered") {
      expect(result.claims[0]?.citations[0]?.chunkId).toBe("sample-doc#chunk-001");
    }
  });

  it("rejects empty context as insufficient evidence", async () => {
    const provider = new FakeLLMProvider();
    const result = await provider.generateAnswer({
      question: "What is missing?",
      selectedContext: [],
      citationPolicy: {
        requireCitationPerClaim: true,
        rejectUnsupportedClaims: true
      },
      modelConfig: {
        provider: "fake",
        model: "fake"
      }
    });

    expect(result).toEqual({
      status: "rejected",
      reason: "insufficient_evidence",
      message: "No selected context was available."
    });
  });
});

function loadFixtureFile(name: string): EvalFixture[] {
  const path = join(__dirname, "..", "fixtures", "initial", name);
  return JSON.parse(readFileSync(path, "utf8")) as EvalFixture[];
}

function makeRetrievalResult(chunkId: string, retrievalScore: number, trustScore: number): RetrievalResult {
  return {
    chunk: {
      id: chunkId,
      documentId: "sample-doc",
      headingPath: ["Sample"],
      text: "This selected context supports the answer.",
      contentHash: "hash",
      version: "v1"
    },
    score: {
      retrievalScore,
      trustScore,
      freshnessScore: 1,
      duplicatePenalty: 0
    }
  };
}
