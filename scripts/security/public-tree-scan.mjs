import { basename, join, relative } from "node:path";
import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from "node:fs";

const PUBLIC_ROOT_FILES = [
  ".env.example",
  ".github",
  ".gitignore",
  ".gitleaks.toml",
  ".npmrc",
  "LICENSE",
  "README.md",
  "apps",
  "docs",
  "infra",
  "package.json",
  "packages",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "sample-docs",
  "scripts",
  "tsconfig.base.json"
];

const PUBLIC_ROOT_FILE_SET = new Set(PUBLIC_ROOT_FILES);
const LOCAL_ONLY_ROOT_ENTRY_PATTERN = /^(?:\.git|node_modules|\.env|\.env\.local|\.env\.[^.]+\.local)$/;
const TEXT_FILE_PATTERN = /(?:^|\/)(?:LICENSE|\.gitignore|\.npmrc)$|\.(cjs|css|env\.example|html|js|json|md|mjs|sql|toml|ts|tsx|txt|yaml|yml)$/i;
const EXCLUDED_DIRECTORY_NAMES = new Set([".git", ".turbo", ".vite", "coverage", "dist", "node_modules"]);

const SECRET_ASSIGNMENT_PATTERNS = [
  {
    name: "openai-api-key-assignment",
    pattern: /\bOPENAI_API_KEY[ \t]*=[ \t]*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^"'\s#\r\n]*))/gi
  },
  {
    name: "anthropic-api-key-assignment",
    pattern: /\bANTHROPIC_API_KEY[ \t]*=[ \t]*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^"'\s#\r\n]*))/gi
  },
  {
    name: "npm-auth-token-assignment",
    pattern: /(?:^|\r?\n)[ \t]*(?:(?:\/\/[^\s=]+\/)?:)?_authToken[ \t]*=[ \t]*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^"'\s#\r\n]*))/gi
  }
];

const SECRET_PATTERNS = [
  {
    name: "openai-secret-key",
    pattern: /\b(sk-[A-Za-z0-9_-]{20,})\b/g
  },
  {
    name: "anthropic-secret-key",
    pattern: /\b(sk-ant-[A-Za-z0-9_-]{20,})\b/g
  },
  {
    name: "github-token",
    pattern: /\b((?:ghp|github_pat)_[A-Za-z0-9_]{20,})\b/g
  },
  {
    name: "private-key-block",
    pattern: /(-----BEGIN [A-Z ]*PRIVATE KEY-----)/g
  }
];

const KNOWN_FAKE_SECRET_VALUES = new Set([
  "[redacted-secret]",
  "existing-secret",
  "file-secret",
  "secret",
  "secret value",
  "sk-live-secret"
]);

const BLOCKED_PATH_PATTERNS = [
  {
    name: "raw-query-trace",
    pattern: /(?:^|\/)query-traces\/.*\.raw\.json$/i
  },
  {
    name: "raw-query-trace-directory",
    pattern: /(?:^|\/)query-traces\/raw(?:\/|$)/i
  },
  {
    name: "provider-response-artifact",
    pattern: /(?:^|\/).*provider-response.*\.json$/i
  },
  {
    name: "embedding-cache",
    pattern: /(?:^|\/)(?:embedding-cache|vector-cache)(?:\/|$)/i
  },
  {
    name: "database-dump",
    pattern: /(?:^|\/)(?:db-dumps|local-data)(?:\/|$)|\.(?:dump|sqlite)$/i
  }
];

export function scanPublicTree(root = process.cwd()) {
  const failures = [];
  let scannedFileCount = 0;

  failures.push(...findUnexpectedRootEntries(root));

  for (const publicPath of listPublicCandidateFiles(root)) {
    const relativePath = toPosix(relative(root, publicPath));
    const blockedPath = BLOCKED_PATH_PATTERNS.find(({ pattern }) => pattern.test(relativePath));
    if (blockedPath) {
      failures.push({
        path: relativePath,
        reason: blockedPath.name
      });
      continue;
    }

    if (!TEXT_FILE_PATTERN.test(relativePath)) {
      continue;
    }

    scannedFileCount += 1;
    const text = readFileSync(publicPath, "utf8");
    for (const { name, pattern } of SECRET_ASSIGNMENT_PATTERNS) {
      for (const match of text.matchAll(pattern)) {
        if (!isAllowedSecretPlaceholder(firstCapture(match))) {
          failures.push({
            path: relativePath,
            reason: name
          });
        }
      }
    }
    for (const { name, pattern } of SECRET_PATTERNS) {
      for (const match of text.matchAll(pattern)) {
        if (!isAllowedSecretPlaceholder(firstCapture(match))) {
          failures.push({
            path: relativePath,
            reason: name
          });
        }
      }
    }
  }

  failures.sort((left, right) => `${left.path}:${left.reason}`.localeCompare(`${right.path}:${right.reason}`));

  return {
    ok: failures.length === 0,
    failures,
    scannedFileCount
  };
}

function findUnexpectedRootEntries(root) {
  return readdirSync(root)
    .filter((name) => !PUBLIC_ROOT_FILE_SET.has(name) && !LOCAL_ONLY_ROOT_ENTRY_PATTERN.test(name))
    .map((name) => ({
      path: toPosix(name),
      reason: "unexpected-root-entry"
    }));
}

function listPublicCandidateFiles(root) {
  return PUBLIC_ROOT_FILES.flatMap((publicRoot) => {
    const path = join(root, publicRoot);
    if (!existsSync(path)) {
      return [];
    }
    return listFiles(path);
  }).sort((left, right) => left.localeCompare(right));
}

function listFiles(path) {
  const linkStat = lstatSync(path);
  if (linkStat.isSymbolicLink()) {
    return [];
  }

  const stat = statSync(path);
  if (stat.isFile()) {
    return [path];
  }
  if (EXCLUDED_DIRECTORY_NAMES.has(basename(path))) {
    return [];
  }

  return readdirSync(path)
    .flatMap((name) => listFiles(join(path, name)))
    .sort((left, right) => left.localeCompare(right));
}

function toPosix(path) {
  return path.split("\\").join("/");
}

function firstCapture(match) {
  return match.slice(1).find((value) => value !== undefined) ?? match[0] ?? "";
}

function isAllowedSecretPlaceholder(value) {
  const normalized = value.trim();
  return (
    normalized === "" ||
    normalized === "..." ||
    KNOWN_FAKE_SECRET_VALUES.has(normalized) ||
    normalized === "<OPENAI_API_KEY>" ||
    normalized === "<ANTHROPIC_API_KEY>" ||
    /^<[^>]+>$/.test(normalized) ||
    /^\$\{[A-Z0-9_]+\}$/.test(normalized) ||
    /^your[-_]/i.test(normalized)
  );
}
