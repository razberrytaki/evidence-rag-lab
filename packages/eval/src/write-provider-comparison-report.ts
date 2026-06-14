import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderProviderComparisonReportMarkdown, type ProviderComparisonReportInput } from ".";

const repoRoot = join(__dirname, "..", "..", "..");

const report: ProviderComparisonReportInput = {
  generatedAt: "2026-06-12",
  providers: [
    {
      provider: "openai-compatible",
      role: "default-live",
      requestSurface: "POST /chat/completions",
      setup: "OPENAI_API_KEY",
      liveSmoke: {
        status: "pass",
        model: "gpt-5.4-mini",
        claimCount: 3,
        citationCount: 3,
        tracePersisted: true
      },
      deterministicChecks: [
        "request-shape",
        "citation-validation",
        "empty-context-rejection",
        "malformed-json-redaction"
      ],
      tradeOffs: ["OpenAI-compatible provider 전반에 portable", "Responses API보다 OpenAI-native 성격은 약함"]
    },
    {
      provider: "anthropic",
      role: "comparison-adapter",
      requestSurface: "POST /messages",
      setup: "OPENAI_API_KEY + ANTHROPIC_API_KEY",
      liveSmoke: {
        status: "not-run",
        reason: "ANTHROPIC_API_KEY가 설정되지 않음"
      },
      deterministicChecks: [
        "request-shape",
        "citation-validation",
        "empty-context-rejection",
        "malformed-json-redaction",
        "env-config-loading"
      ],
      tradeOffs: ["명시적 provider selection", "automatic fallback 없음"]
    },
    {
      provider: "fake",
      role: "test-double",
      requestSurface: "in-process",
      setup: "none",
      liveSmoke: {
        status: "not-run",
        reason: "FakeLLMProvider는 deterministic CI/test 전용"
      },
      deterministicChecks: ["citation-shape", "empty-context-rejection"],
      tradeOffs: ["stable eval output", "model-quality signal 아님"]
    }
  ],
  notes: [
    "retrieval query embedding이 text-embedding-3-small을 사용하므로 embedding에는 OpenAI가 계속 필요하다.",
    "Provider comparison은 explicit하므로 setup error가 fallback 뒤에 숨지 않는다.",
    "이 환경에서는 OpenAI-compatible live generation만 동작 확인된 상태다. Anthropic live 동작 확인에는 ANTHROPIC_API_KEY가 필요하다."
  ]
};

const targetPath = join(repoRoot, "docs", "provider-comparison-report.md");
writeFileSync(targetPath, renderProviderComparisonReportMarkdown(report), "utf8");
console.log(`Wrote ${targetPath}`);
