import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const forbiddenPatterns = [
  /OPENAI_API_KEY\s*=/i,
  /ANTHROPIC_API_KEY\s*=/i,
  /https:\/\/example\.com/i,
  /placeholder/i,
  /\bcorpus\b/i,
  /provider[-_ ]?response/i,
  /token[-_ ]?billing/i,
  /patient/i,
  /customer[-_ ]?data/i
];

const docsForbiddenPatterns = [
  /https:\/\/example\.com/i,
  /placeholder/i,
  /\bcorpus\b/i
];

const fixtureRoots = ["sample-docs", "packages/eval/fixtures"];
const docsRoots = ["README.md", "docs"];
const failures = [];

for (const root of fixtureRoots) {
  walk(root, forbiddenPatterns);
}

for (const root of docsRoots) {
  walk(root, docsForbiddenPatterns);
}

if (failures.length > 0) {
  console.error("Public fixture hygiene failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Public fixture hygiene passed.");

function walk(path, patterns) {
  const stat = statSync(path);
  if (stat.isFile()) {
    checkFile(path, patterns);
    return;
  }

  for (const name of readdirSync(path)) {
    const childPath = join(path, name);
    const childStat = statSync(childPath);
    if (childStat.isDirectory()) {
      walk(childPath, patterns);
      continue;
    }
    checkFile(childPath, patterns);
  }
}

function checkFile(path, patterns) {
  if (!/\.(md|json)$/i.test(path)) {
    return;
  }
  const text = readFileSync(path, "utf8");
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      failures.push(`${path}: matched ${pattern}`);
    }
  }
}
