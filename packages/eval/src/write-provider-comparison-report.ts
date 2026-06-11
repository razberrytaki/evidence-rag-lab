import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderProviderComparisonReportMarkdown, type ProviderComparisonReportInput } from ".";

const repoRoot = join(__dirname, "..", "..", "..");

const report: ProviderComparisonReportInput = {
  generatedAt: "2026-06-11",
  providers: [
    {
      provider: "openai-compatible",
      role: "default-live",
      requestSurface: "POST /chat/completions",
      setup: "OPENAI_API_KEY",
      liveSmoke: {
        status: "pass",
        model: "gpt-5.4-mini",
        claimCount: 4,
        citationCount: 4,
        tracePersisted: true
      },
      deterministicChecks: [
        "request-shape",
        "citation-validation",
        "empty-context-rejection",
        "malformed-json-redaction"
      ],
      tradeOffs: ["portable across OpenAI-compatible providers", "less OpenAI-native than Responses API"]
    },
    {
      provider: "anthropic",
      role: "comparison-adapter",
      requestSurface: "POST /messages",
      setup: "OPENAI_API_KEY + ANTHROPIC_API_KEY",
      liveSmoke: {
        status: "not-run",
        reason: "ANTHROPIC_API_KEY is not configured"
      },
      deterministicChecks: [
        "request-shape",
        "citation-validation",
        "empty-context-rejection",
        "malformed-json-redaction",
        "env-config-loading"
      ],
      tradeOffs: ["explicit provider selection", "no automatic fallback"]
    },
    {
      provider: "fake",
      role: "test-double",
      requestSurface: "in-process",
      setup: "none",
      liveSmoke: {
        status: "not-run",
        reason: "FakeLLMProvider is deterministic CI/test only"
      },
      deterministicChecks: ["citation-shape", "empty-context-rejection"],
      tradeOffs: ["stable eval output", "not a model-quality signal"]
    }
  ],
  notes: [
    "OpenAI remains required for embeddings because retrieval query embedding uses text-embedding-3-small.",
    "Provider comparison is explicit so setup errors are not hidden by fallback.",
    "Only OpenAI-compatible live generation has been smoke-tested in this environment; Anthropic live smoke requires ANTHROPIC_API_KEY."
  ]
};

const targetPath = join(repoRoot, "docs", "provider-comparison-report.md");
writeFileSync(targetPath, renderProviderComparisonReportMarkdown(report), "utf8");
console.log(`Wrote ${targetPath}`);
