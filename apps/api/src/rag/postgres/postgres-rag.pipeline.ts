import type { GenerationResult, QueryTrace, RetrievalResult } from "@evidencerag/domain";
import {
  type EmbeddingProvider,
  loadOpenAIEmbeddingConfigFromEnv,
  normalizeText,
  OpenAIEmbeddingClient,
  type OpenAIEmbeddingEnv
} from "@evidencerag/ingest";
import {
  FakeLLMProvider,
  type GenerateAnswerInput,
  type LLMProvider,
  type ProviderEnv,
  resolveProviderConfig
} from "@evidencerag/generation";
import {
  buildPostgresHybridRetrievalSql,
  buildQueryTraceUpsertSql,
  mapPostgresRetrievalRow,
  rerankByQueryEvidence,
  shouldPersistTraceSample,
  type PostgresRetrievalRow
} from "@evidencerag/retrieval";
import { makeDeterministicTraceId } from "../../common/trace-id";
import type { QueryExecutor } from "../../database/query-executor";
import { createLiveLLMProvider } from "./live-llm-provider";

const DEFAULT_TOP_K = 3;
const MINIMUM_TRUST_SCORE = 0.5;
const MINIMUM_ANSWER_GATE_SCORE = 0.5;
const MINIMUM_RERANK_SCORE = 0.5;

export interface PostgresRagPipelineInput {
  question: string;
  embeddingProvider: EmbeddingProvider;
  llmProvider?: LLMProvider;
  modelConfig?: GenerateAnswerInput["modelConfig"];
  queryExecutor: QueryExecutor;
  persistTrace?: boolean;
  traceSampleRate?: number;
  topK?: number;
}

export interface PostgresRagPipelineResult {
  query: string;
  selectedContext: RetrievalResult[];
  generation: GenerationResult;
  trace: QueryTrace;
}

export type PostgresRagRuntimeEnv = OpenAIEmbeddingEnv & ProviderEnv;

export async function runPostgresRagPipeline(
  input: PostgresRagPipelineInput
): Promise<PostgresRagPipelineResult> {
  const normalizedQuery = normalizeText(input.question).toLowerCase();
  const [embedding] = await input.embeddingProvider.embedTexts([input.question]);
  if (!embedding) {
    throw new Error("embedding provider returned no vector for query");
  }

  const retrievalSql = buildPostgresHybridRetrievalSql({
    query: input.question,
    embedding,
    topK: input.topK ?? DEFAULT_TOP_K
  });
  const result = await input.queryExecutor.query(retrievalSql.text, retrievalSql.values);
  const mappedCandidates = result.rows
    .map((row) => mapPostgresRetrievalRow(row as PostgresRetrievalRow))
    .map(normalizeRankForLocalAnswerGate);
  const candidates = rerankByQueryEvidence({
    query: input.question,
    candidates: mappedCandidates,
    topK: input.topK ?? DEFAULT_TOP_K
  });
  const rejected = candidates
    .filter((candidate) => candidate.score.freshnessScore < MINIMUM_TRUST_SCORE)
    .map((candidate) => ({
      chunkId: candidate.chunk.id,
      reason: "stale_source"
    }));
  const selectedContext = selectContextForGroundedAnswer({
    candidates,
    rejected,
    topK: input.topK ?? DEFAULT_TOP_K
  });

  const provider = input.llmProvider ?? new FakeLLMProvider();
  const modelConfig = input.modelConfig ?? resolveDefaultModelConfig(provider);
  const generation = await provider.generateAnswer({
    question: input.question,
    selectedContext,
    citationPolicy: {
      requireCitationPerClaim: true,
      rejectUnsupportedClaims: true
    },
    modelConfig
  });
  const trace: QueryTrace = {
    id: makeDeterministicTraceId("pg-trace", input.question),
    query: input.question,
    normalizedQuery,
    candidates,
    selectedChunkIds: selectedContext.map((item) => item.chunk.id),
    rejected,
    generation
  };

  if (input.persistTrace && shouldPersistTraceSample(trace.id, input.traceSampleRate ?? 1)) {
    const traceSql = buildQueryTraceUpsertSql(trace);
    await input.queryExecutor.query(traceSql.text, traceSql.values);
  }

  return {
    query: input.question,
    selectedContext,
    generation,
    trace
  };
}

export async function runPostgresRagPipelineWithExecutorFromEnv(
  question: string,
  queryExecutor: QueryExecutor,
  env: PostgresRagRuntimeEnv = process.env
): Promise<PostgresRagPipelineResult> {
  const providerConfig = resolveProviderConfig(env, "live");

  const embeddingProvider = new OpenAIEmbeddingClient(loadOpenAIEmbeddingConfigFromEnv(env));
  const llmProvider = createLiveLLMProvider(providerConfig, env);
  return runPostgresRagPipeline({
    question,
    embeddingProvider,
    llmProvider,
    modelConfig: {
      provider: providerConfig.llmProvider,
      model: providerConfig.chatModel
    },
    queryExecutor,
    persistTrace: true,
    topK: DEFAULT_TOP_K
  });
}

interface GroundedContextSelectionInput {
  candidates: RetrievalResult[];
  rejected: QueryTrace["rejected"];
  topK: number;
}

function selectContextForGroundedAnswer(input: GroundedContextSelectionInput): RetrievalResult[] {
  const rejectedChunkIds = new Set(input.rejected.map((rejection) => rejection.chunkId));

  return input.candidates
    .filter((candidate) => isEligibleForGroundedAnswer(candidate, rejectedChunkIds))
    .slice(0, input.topK);
}

function isEligibleForGroundedAnswer(candidate: RetrievalResult, rejectedChunkIds: ReadonlySet<string>): boolean {
  return (
    answerGateScore(candidate) >= MINIMUM_ANSWER_GATE_SCORE &&
    (candidate.score.rerankScore ?? candidate.score.retrievalScore) >= MINIMUM_RERANK_SCORE &&
    candidate.score.trustScore >= MINIMUM_TRUST_SCORE &&
    !rejectedChunkIds.has(candidate.chunk.id)
  );
}

function normalizeRankForLocalAnswerGate(candidate: RetrievalResult, index: number): RetrievalResult {
  return {
    ...candidate,
    score: {
      ...candidate.score,
      fusedRank: index + 1,
      // PostgreSQL RRF is a rank-combination score, not calibrated confidence.
      // The local answer gate uses rank order as a deterministic proxy until
      // eval-driven score calibration exists.
      answerGateScore: Math.max(0, 0.99 - index * 0.1)
    }
  };
}

function answerGateScore(candidate: RetrievalResult): number {
  return candidate.score.answerGateScore ?? candidate.score.retrievalScore;
}

function resolveDefaultModelConfig(provider: LLMProvider): GenerateAnswerInput["modelConfig"] {
  if (provider.name === "openai-compatible" || provider.name === "anthropic" || provider.name === "fake") {
    return {
      provider: provider.name,
      model: provider.name
    };
  }

  return {
    provider: "fake",
    model: provider.name
  };
}
