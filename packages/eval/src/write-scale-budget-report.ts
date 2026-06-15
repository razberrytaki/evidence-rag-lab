import { mkdirSync, writeFileSync } from "node:fs";
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
    "문서 수, 평균 청크 수, 임베딩 차원 가정에서 저장 공간 압력을 계산한다.",
    "벡터 저장량은 float32 임베딩을 가정하며 HNSW 그래프 부가 비용, WAL, 복제본, 백업, vacuum 팽창을 제외한다.",
    "추적 기록량은 전체 LLM 요청, 원문 문맥 묶음, LLM 응답 원문이 아니라 정리된 집계 추적 기록을 가정한다.",
    "이 계산은 가정, 압력 지점, 운영 전 검증 대상을 산출한다."
  ]
};

const reportsDir = join(repoRoot, "docs", "reports");
const targetPath = join(reportsDir, "scale-budget-report.md");
mkdirSync(reportsDir, { recursive: true });
writeFileSync(targetPath, renderScaleBudgetReportMarkdown(report), "utf8");
console.log(`Wrote ${targetPath}`);
