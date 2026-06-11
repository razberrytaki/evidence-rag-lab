import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderVectorIndexBudgetReportMarkdown, type VectorIndexBudgetReportInput } from ".";

const repoRoot = join(__dirname, "..", "..", "..");

const report: VectorIndexBudgetReportInput = {
  generatedAt: "2026-06-11",
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
    "HNSW graph math is an explicit scenario, not measured pgvector index size.",
    "The graph estimate excludes PostgreSQL page overhead, index tuple overhead, WAL, replicas, backups, vacuum bloat, and cache effects.",
    "The build working set estimate is a planning estimate for memory pressure discussion, not an observed maintenance_work_mem requirement.",
    "Production validation still needs larger indexes, warm/cold cache splits, p99 latency, recall checks, and failure-rate reporting."
  ]
};

const targetPath = join(repoRoot, "docs", "vector-index-budget-report.md");
writeFileSync(targetPath, renderVectorIndexBudgetReportMarkdown(report), "utf8");
console.log(`Wrote ${targetPath}`);
