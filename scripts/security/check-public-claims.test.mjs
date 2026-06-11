import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scanPublicClaims } from "./public-claim-scan.mjs";

describe("public claim scanner", () => {
  it("blocks affirmative production and zero-hallucination claims", () => {
    const root = makeTempRepo();
    writeFileSync(
      join(root, "README.md"),
      [
        "EvidenceRAG guarantees zero hallucination.",
        "It is production-ready for 10M document throughput.",
        "The current implementation processes 10M documents in production.",
        "It includes a full BM25 implementation."
      ].join("\n")
    );

    const result = scanPublicClaims(root);

    assert.equal(result.ok, false);
    assert.deepEqual(result.failures, [
      { path: "README.md", line: 1, reason: "zero-hallucination-guarantee" },
      { path: "README.md", line: 2, reason: "production-ready-claim" },
      { path: "README.md", line: 3, reason: "10m-production-throughput-claim" },
      { path: "README.md", line: 4, reason: "bm25-implementation-claim" }
    ]);

    rmSync(root, { recursive: true, force: true });
  });

  it("blocks claims split across adjacent markdown lines", () => {
    const root = makeTempRepo();
    writeFileSync(
      join(root, "README.md"),
      ["EvidenceRAG guarantees", "zero hallucination for production use."].join("\n")
    );

    const result = scanPublicClaims(root);

    assert.equal(result.ok, false);
    assert.deepEqual(result.failures, [
      { path: "README.md", line: 1, reason: "zero-hallucination-guarantee" }
    ]);

    rmSync(root, { recursive: true, force: true });
  });

  it("allows explicit non-claims and scale alternatives", () => {
    const root = makeTempRepo();
    writeFileSync(
      join(root, "README.md"),
      [
        "It does not claim to process 10M documents in production or guarantee zero hallucination.",
        "This is not a production benchmark.",
        "The current implementation is not production-ready.",
        "OpenSearch BM25 is a scale alternative, not the current implementation."
      ].join("\n")
    );

    const result = scanPublicClaims(root);

    assert.deepEqual(result, {
      ok: true,
      failures: [],
      scannedFileCount: 1
    });

    rmSync(root, { recursive: true, force: true });
  });
});

function makeTempRepo() {
  const root = mkdtempSync(join(tmpdir(), "evidence-rag-public-claims-"));
  mkdirSync(join(root, "docs"), { recursive: true });
  return root;
}
