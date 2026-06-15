import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderVectorIndexBudgetReportMarkdown, type VectorIndexBudgetReportInput } from ".";

const repoRoot = join(__dirname, "..", "..", "..");

const report: VectorIndexBudgetReportInput = {
  generatedAt: "2026-06-12",
  assumptions: {
    documentCount: 10_000_000,
    averageChunksPerDocument: 8,
    embeddingDimensions: 1536,
    embeddingBytesPerDimension: 4,
    metadataBytesPerChunk: 1024,
    hnswM: 16,
    hnswLayerMultiplier: 1.1,
    hnswGraphBytesPerNeighbor: 8,
    hnswBuildMemoryMultiplier: 2
  },
  notes: [
    "HNSW 그래프 계산은 명시적 계획 가정이다.",
    "그래프 추정치는 PostgreSQL page 부가 비용, 색인 tuple 부가 비용, WAL, 복제본, 백업, vacuum 팽창, 캐시 효과를 제외한다.",
    "빌드 작업 메모리 추정치는 메모리 압력 논의용 계획치이며 관측된 maintenance_work_mem 요구량이 아니다.",
    "운영 전 검증에는 여전히 더 큰 색인, warm/cold 캐시 분리, p99 지연 시간, recall 확인, 실패율 보고가 필요하다."
  ]
};

const reportsDir = join(repoRoot, "docs", "reports");
const targetPath = join(reportsDir, "vector-index-budget-report.md");
mkdirSync(reportsDir, { recursive: true });
writeFileSync(targetPath, renderVectorIndexBudgetReportMarkdown(report), "utf8");
console.log(`Wrote ${targetPath}`);
