import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateFixtures, renderEvalReportMarkdown, type EvalFixture, type EvalObservation } from ".";

const packageRoot = join(__dirname, "..");
const repoRoot = join(packageRoot, "..", "..");

const fixtureFiles = [
  "retrieval-basic.json",
  "trust-and-conflict.json",
  "generation-guard.json",
  "trace-and-regression.json"
];

const fixtures = fixtureFiles.flatMap((fileName) =>
  readJson<EvalFixture[]>(join(packageRoot, "fixtures", "initial", fileName))
);
const observations = readJson<EvalObservation[]>(join(packageRoot, "fixtures", "fake-llm", "observations.json"));
const report = evaluateFixtures(fixtures, observations);
const targetPath = join(repoRoot, "docs", "eval-report.md");

writeFileSync(targetPath, renderEvalReportMarkdown(report), "utf8");
console.log(`Wrote ${targetPath}`);

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}
