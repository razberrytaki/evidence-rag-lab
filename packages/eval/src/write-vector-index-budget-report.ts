import { writeFileSync } from "node:fs";
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
    "HNSW graph math는 explicit scenario이며 measured pgvector index size가 아니다.",
    "graph estimate는 PostgreSQL page overhead, index tuple overhead, WAL, replica, backup, vacuum bloat, cache effect를 제외한다.",
    "build working set estimate는 memory pressure 논의용 planning estimate이며 observed maintenance_work_mem requirement가 아니다.",
    "Production validation에는 여전히 larger index, warm/cold cache split, p99 latency, recall check, failure-rate reporting이 필요하다."
  ]
};

const targetPath = join(repoRoot, "docs", "vector-index-budget-report.md");
writeFileSync(targetPath, renderVectorIndexBudgetReportMarkdown(report), "utf8");
console.log(`Wrote ${targetPath}`);
