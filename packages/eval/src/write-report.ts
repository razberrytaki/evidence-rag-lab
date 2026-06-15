import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GenerationResult, QueryTrace, RetrievalResult } from "@evidencerag/domain";
import { evaluateFixtures, renderEvalReportMarkdown, type EvalFixture, type EvalObservation } from ".";

const packageRoot = join(__dirname, "..");
const repoRoot = join(packageRoot, "..", "..");
const sampleRuntimeFixtureIds = new Set(["insufficient-evidence", "user-prompt-injection"]);

const fixtureFiles = [
  "retrieval-basic.json",
  "trust-and-conflict.json",
  "generation-guard.json",
  "trace-and-regression.json"
];

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const fixtures = fixtureFiles.flatMap((fileName) =>
    readJson<EvalFixture[]>(join(packageRoot, "fixtures", "initial", fileName))
  );
  const staticObservations = readJson<EvalObservation[]>(
    join(packageRoot, "fixtures", "fake-llm", "observations.json")
  ).map((observation) => ({
    ...observation,
    observationSource: "static-fixture" as const
  }));
  const runtimeObservations = await buildSampleRuntimeObservations(fixtures);
  const observations = mergeObservationOverrides(staticObservations, runtimeObservations);
  const report = evaluateFixtures(fixtures, observations);
  const reportsDir = join(repoRoot, "docs", "reports");
  const targetPath = join(reportsDir, "eval-report.md");

  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(targetPath, renderEvalReportMarkdown(report), "utf8");
  console.log(`Wrote ${targetPath}`);
}

async function buildSampleRuntimeObservations(fixtures: EvalFixture[]): Promise<EvalObservation[]> {
  const runtimeModule = await loadSampleRuntimeModule();
  const sampleDocsDir = runtimeModule.findSampleDocsDir(repoRoot);
  const runtimeFixtures = fixtures.filter((fixture) => sampleRuntimeFixtureIds.has(fixture.id));

  return Promise.all(
    runtimeFixtures.map(async (fixture) =>
      toEvalObservation(
        fixture,
        await runtimeModule.runSampleRagPipeline({
          question: fixture.query,
          sampleDocsDir
        })
      )
    )
  );
}

async function loadSampleRuntimeModule(): Promise<SampleRuntimeModule> {
  const modulePath = join(repoRoot, "apps", "api", "dist", "rag", "sample", "sample-rag.pipeline.js");
  if (!existsSync(modulePath)) {
    throw new Error(`sample runtime module was not built: ${modulePath}. Run pnpm build before pnpm eval:report.`);
  }

  return (await import(modulePath)) as SampleRuntimeModule;
}

function toEvalObservation(fixture: EvalFixture, result: SampleRuntimeResult): EvalObservation {
  const rejectedDocIds = unique(
    result.trace.rejected
      .map((rejection) => documentIdForChunkId(result.trace.candidates, rejection.chunkId))
      .filter((documentId): documentId is string => Boolean(documentId))
  );

  return {
    fixtureId: fixture.id,
    retrievedDocIds: unique(result.selectedContext.map((context) => context.chunk.documentId)),
    rejectedDocIds,
    citationChunkIds:
      result.generation.status === "rejected"
        ? []
        : unique(result.generation.claims.flatMap((claim) => claim.citations.map((citation) => citation.chunkId))),
    finalStatus: result.generation.status,
    unsupportedClaimRejected: result.generation.status === "rejected" || rejectedDocIds.length > 0,
    traceComplete:
      Array.isArray(result.trace.candidates) &&
      Array.isArray(result.trace.selectedChunkIds) &&
      Array.isArray(result.trace.rejected),
    observationSource: "sample-runtime"
  };
}

function mergeObservationOverrides(
  staticObservations: EvalObservation[],
  runtimeObservations: EvalObservation[]
): EvalObservation[] {
  const byFixtureId = new Map(staticObservations.map((observation) => [observation.fixtureId, observation]));
  for (const observation of runtimeObservations) {
    byFixtureId.set(observation.fixtureId, observation);
  }
  return [...byFixtureId.values()];
}

function documentIdForChunkId(candidates: RetrievalResult[], chunkId: string): string | undefined {
  return candidates.find((candidate) => candidate.chunk.id === chunkId)?.chunk.documentId;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

interface SampleRuntimeModule {
  findSampleDocsDir(startDir?: string): string;
  runSampleRagPipeline(input: { question: string; sampleDocsDir: string }): Promise<SampleRuntimeResult>;
}

interface SampleRuntimeResult {
  selectedContext: RetrievalResult[];
  generation: GenerationResult;
  trace: QueryTrace;
}
