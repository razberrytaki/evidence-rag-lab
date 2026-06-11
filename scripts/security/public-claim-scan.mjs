import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SCAN_ROOTS = ["README.md", "docs", "sample-docs"];

const CLAIM_PATTERNS = [
  {
    reason: "zero-hallucination-guarantee",
    pattern: /\b(?:guarantee[sd]?|ensure[sd]?|zero)\b.*\bzero hallucination\b|\bzero hallucination\b.*\b(?:guarantee[sd]?|ensure[sd]?)\b/i
  },
  {
    reason: "production-ready-claim",
    pattern: /\bproduction-ready\b|\bproduction ready\b/i
  },
  {
    reason: "10m-production-throughput-claim",
    pattern: /\b(?:process(?:es|ed|ing)?|handle[sd]?|support[sd]?|serve[sd]?|throughput)\b.*\b10M\b.*\b(?:documents?|docs?)\b.*\bproduction\b|\bproduction\b.*\b(?:process(?:es|ed|ing)?|handle[sd]?|support[sd]?|serve[sd]?|throughput)\b.*\b10M\b.*\b(?:documents?|docs?)\b/i
  },
  {
    reason: "bm25-implementation-claim",
    pattern: /\b(?:full|complete|current|implemented|includes?|ships?)\b.*\bBM25\b.*\bimplementation\b|\bBM25\b.*\b(?:full|complete|current|implemented|includes?|ships?)\b.*\bimplementation\b/i
  }
];

const NEGATED_CONTEXT_PATTERN = /\b(?:does not|do not|not|no|without|non-claims?|non-claim|avoid|forbidden|forbid|alternative)\b/i;

export function scanPublicClaims(root = process.cwd()) {
  const failures = [];
  let scannedFileCount = 0;

  for (const filePath of listClaimCandidateFiles(root)) {
    scannedFileCount += 1;
    const relativePath = toPosix(relative(root, filePath));
    const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      const lineFailures = findClaimFailures(relativePath, index + 1, line);
      failures.push(...lineFailures);
      const nextLine = lines[index + 1] ?? "";
      if (lineFailures.length === 0 && line.trim() !== "" && nextLine.trim() !== "") {
        failures.push(...findClaimFailures(relativePath, index + 1, `${line} ${nextLine}`));
      }
    }
  }

  const dedupedFailures = dedupeFailures(failures).sort((left, right) =>
    `${left.path}:${left.line}:${left.reason}`.localeCompare(`${right.path}:${right.line}:${right.reason}`)
  );

  return {
    ok: dedupedFailures.length === 0,
    failures: dedupedFailures,
    scannedFileCount
  };
}

function findClaimFailures(path, line, text) {
  if (isNegatedContext(text)) {
    return [];
  }
  return CLAIM_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ reason }) => ({ path, line, reason }));
}

function dedupeFailures(failures) {
  const seen = new Set();
  return failures.filter((failure) => {
    const key = `${failure.path}:${failure.line}:${failure.reason}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function listClaimCandidateFiles(root) {
  return SCAN_ROOTS.flatMap((scanRoot) => {
    const path = join(root, scanRoot);
    if (!existsSync(path)) {
      return [];
    }
    return listFiles(path);
  })
    .filter((path) => /\.md$/i.test(path))
    .sort((left, right) => left.localeCompare(right));
}

function listFiles(path) {
  const stat = statSync(path);
  if (stat.isFile()) {
    return [path];
  }
  return readdirSync(path)
    .flatMap((name) => listFiles(join(path, name)))
    .sort((left, right) => left.localeCompare(right));
}

function isNegatedContext(line) {
  return NEGATED_CONTEXT_PATTERN.test(line);
}

function toPosix(path) {
  return path.split("\\").join("/");
}
