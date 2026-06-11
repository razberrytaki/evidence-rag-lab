import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderScaleBudgetReportMarkdown, type ScaleBudgetReportInput } from ".";

const repoRoot = join(__dirname, "..", "..", "..");

const report: ScaleBudgetReportInput = {
  generatedAt: "2026-06-11",
  assumptions: {
    documentCount: 10_000_000,
    averageChunksPerDocument: 8,
    embeddingDimensions: 1536,
    embeddingBytesPerDimension: 4,
    metadataBytesPerChunk: 1024,
    averageTraceBytes: 4096,
    dailyQueryCount: 50_000,
    traceRetentionDays: 7
  },
  notes: [
    "Sizing math only. No 10M-document load was executed.",
    "Vector storage assumes float32 embeddings and excludes HNSW graph overhead, WAL, replicas, backups, and vacuum bloat.",
    "Trace volume assumes sanitized aggregate trace payloads, not raw prompts, raw context, or provider responses.",
    "The useful portfolio signal is the ability to state assumptions, calculate pressure points, and name what must be measured before production."
  ]
};

const targetPath = join(repoRoot, "docs", "scale-budget-report.md");
writeFileSync(targetPath, renderScaleBudgetReportMarkdown(report), "utf8");
console.log(`Wrote ${targetPath}`);
