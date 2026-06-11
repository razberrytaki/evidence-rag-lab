import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  ".env.example",
  ".github/workflows/ci.yml",
  ".gitignore",
  ".gitleaks.toml",
  "LICENSE",
  "README.md",
  "docs/security/public-repo-hygiene.md",
  "infra/postgres/init/001_schema.sql",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml"
];

const PUBLIC_CHECK_SCRIPT_COMMANDS = [
  "pnpm build",
  "pnpm test",
  "pnpm typecheck",
  "pnpm security:public",
  "pnpm eval:report",
  "pnpm provider:report",
  "pnpm scale:report",
  "pnpm index:report"
];

const PUBLIC_CHECK_REPORT_COMMANDS = [
  "pnpm eval:report",
  "pnpm provider:report",
  "pnpm scale:report",
  "pnpm index:report"
];

const CI_COMMANDS = ["pnpm build", "pnpm test", "pnpm typecheck", "pnpm security:public"];

export function scanPublicReadiness(root = process.cwd()) {
  const failures = [];

  for (const filePath of REQUIRED_FILES) {
    if (!existsSync(join(root, filePath))) {
      failures.push({ path: filePath, reason: "missing-required-file" });
    }
  }
  checkRequiredFilesAreNotGitignored(root, failures);

  const packagePath = join(root, "package.json");
  if (existsSync(packagePath)) {
    const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
    if (packageJson.license === "MIT") {
      checkMitLicense(root, failures);
    }
    const publicCheckScript = packageJson.scripts?.["public:check"];
    if (typeof publicCheckScript !== "string") {
      failures.push({ path: "package.json", reason: "missing-script: public:check" });
    } else {
      const publicCheckCommands = parsePackageScriptCommands(publicCheckScript);
      for (const command of PUBLIC_CHECK_SCRIPT_COMMANDS) {
        if (!publicCheckCommands.includes(command)) {
          failures.push({ path: "package.json", reason: `missing-public-check-command: ${command}` });
        }
      }
      if (!securityRunsAfterReportGeneration(publicCheckCommands)) {
        failures.push({
          path: "package.json",
          reason: "public-check-security-must-run-after-report-generation"
        });
      }
    }
  }

  const ciPath = ".github/workflows/ci.yml";
  const absoluteCiPath = join(root, ciPath);
  if (existsSync(absoluteCiPath)) {
    const ciWorkflow = readFileSync(absoluteCiPath, "utf8");
    const ciRunCommands = parseGithubActionRunCommands(ciWorkflow);
    for (const command of CI_COMMANDS) {
      if (!ciRunCommands.includes(command)) {
        failures.push({ path: ciPath, reason: `missing-ci-command: ${command}` });
      }
    }
  }

  failures.sort((left, right) => `${left.path}:${left.reason}`.localeCompare(`${right.path}:${right.reason}`));

  return {
    ok: failures.length === 0,
    failures
  };
}

function checkMitLicense(root, failures) {
  const licensePath = join(root, "LICENSE");
  if (!existsSync(licensePath)) {
    return;
  }

  const licenseText = readFileSync(licensePath, "utf8");
  if (!licenseText.includes("MIT License") || !licenseText.includes("Permission is hereby granted")) {
    failures.push({ path: "LICENSE", reason: "license-text-does-not-match-package-license" });
  }
}

function checkRequiredFilesAreNotGitignored(root, failures) {
  const gitignorePath = join(root, ".gitignore");
  if (!existsSync(gitignorePath)) {
    return;
  }

  const rules = parseGitignoreRules(readFileSync(gitignorePath, "utf8"));
  for (const filePath of REQUIRED_FILES) {
    if (existsSync(join(root, filePath)) && isGitignoredByRules(filePath, rules)) {
      failures.push({ path: filePath, reason: "required-file-is-gitignored" });
    }
  }
}

function parseGitignoreRules(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line) => ({
      negated: line.startsWith("!"),
      pattern: line.startsWith("!") ? line.slice(1) : line
    }));
}

function isGitignoredByRules(filePath, rules) {
  return rules.reduce((ignored, rule) => {
    if (!matchesGitignoreRule(filePath, rule.pattern)) {
      return ignored;
    }
    return !rule.negated;
  }, false);
}

function matchesGitignoreRule(filePath, pattern) {
  const normalizedPattern = pattern.split("\\").join("/");
  if (normalizedPattern.endsWith("/")) {
    return filePath.startsWith(normalizedPattern);
  }
  if (!normalizedPattern.includes("/")) {
    return matchesBasenameRule(filePath.split("/").pop() ?? "", normalizedPattern);
  }
  return filePath === normalizedPattern || matchesGlobSegment(filePath, normalizedPattern);
}

function matchesBasenameRule(basename, pattern) {
  return basename === pattern || matchesGlobSegment(basename, pattern);
}

function matchesGlobSegment(value, pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`).test(value);
}

function parsePackageScriptCommands(script) {
  return script
    .split("&&")
    .map((command) => command.trim())
    .filter(Boolean);
}

function parseGithubActionRunCommands(workflowText) {
  return workflowText
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*-\s*run:\s*(.+?)\s*$/)?.[1])
    .filter((command) => typeof command === "string")
    .map((command) => stripYamlQuotes(command.trim()));
}

function stripYamlQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function securityRunsAfterReportGeneration(publicCheckCommands) {
  const securityIndex = publicCheckCommands.lastIndexOf("pnpm security:public");
  if (securityIndex === -1) {
    return false;
  }

  return PUBLIC_CHECK_REPORT_COMMANDS.every((command) => {
    const commandIndex = publicCheckCommands.indexOf(command);
    return commandIndex !== -1 && commandIndex < securityIndex;
  });
}
