import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderScaleBudgetReportMarkdown, type ScaleBudgetReportInput } from ".";

const repoRoot = join(__dirname, "..", "..", "..");

const report: ScaleBudgetReportInput = {
  generatedAt: "2026-06-12",
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
    "문서 수, 평균 chunk 수, embedding dimension 가정에서 storage pressure를 계산한다.",
    "Vector storage는 float32 embedding을 가정하며 HNSW graph overhead, WAL, replica, backup, vacuum bloat를 제외한다.",
    "Trace volume은 full provider prompt, raw context bundle, provider response가 아니라 sanitized aggregate trace payload를 가정한다.",
    "이 계산은 assumptions, pressure points, production validation targets를 산출한다."
  ]
};

const targetPath = join(repoRoot, "docs", "scale-budget-report.md");
writeFileSync(targetPath, renderScaleBudgetReportMarkdown(report), "utf8");
console.log(`Wrote ${targetPath}`);
