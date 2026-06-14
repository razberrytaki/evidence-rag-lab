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
    "Sizing math only. 10M-document load는 실행하지 않았다.",
    "Vector storage는 float32 embedding을 가정하며 HNSW graph overhead, WAL, replica, backup, vacuum bloat를 제외한다.",
    "Trace volume은 full provider prompt, raw context bundle, provider response가 아니라 sanitized aggregate trace payload를 가정한다.",
    "포트폴리오에서 중요한 signal은 assumption을 명시하고, pressure point를 계산하고, production 전에 무엇을 측정해야 하는지 이름 붙이는 능력이다."
  ]
};

const targetPath = join(repoRoot, "docs", "scale-budget-report.md");
writeFileSync(targetPath, renderScaleBudgetReportMarkdown(report), "utf8");
console.log(`Wrote ${targetPath}`);
