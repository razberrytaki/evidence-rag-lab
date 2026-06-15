import { AlertTriangle, CheckCircle2, Loader2, Search, Send, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  buildTraceRows,
  fetchLatestTraceDeduped,
  getConfiguredApiBaseUrl,
  runQuery,
  sampleTrace,
  summarizeTrace,
  type LoadedTrace,
  type QueryRunSummary
} from "./queryTrace";

type QueryRunState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; summary: QueryRunSummary }
  | { status: "error"; message: string };

export function App() {
  const apiBaseUrl = useMemo(() => getConfiguredApiBaseUrl(), []);
  const [loadedTrace, setLoadedTrace] = useState<LoadedTrace>({
    source: "sample",
    trace: sampleTrace
  });
  const [question, setQuestion] = useState(sampleTrace.query);
  const [queryRun, setQueryRun] = useState<QueryRunState>({ status: "idle" });

  useEffect(() => {
    let active = true;

    void fetchLatestTraceDeduped(apiBaseUrl).then((result) => {
      if (active) {
        setLoadedTrace(result);
      }
    });

    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  const traceRows = useMemo(() => buildTraceRows(loadedTrace.trace), [loadedTrace.trace]);
  const summary = useMemo(() => summarizeTrace(loadedTrace.trace), [loadedTrace.trace]);

  async function handleQuerySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (trimmedQuestion === "") {
      return;
    }

    setQueryRun({ status: "loading" });
    try {
      const querySummary = await runQuery(apiBaseUrl, trimmedQuestion);
      setQueryRun({ status: "success", summary: querySummary });
      setLoadedTrace(await fetchLatestTraceDeduped(apiBaseUrl));
    } catch (error) {
      setQueryRun({
        status: "error",
        message: error instanceof Error ? error.message : "query request failed"
      });
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1>EvidenceRAG Lab</h1>
          <p>검색 경로, 인용 범위, 근거 부족 거절을 함께 확인하는 RAG 검증 화면.</p>
        </div>
        <div className="status">
          <ShieldCheck size={18} aria-hidden="true" />
          {loadedTrace.source === "api" ? "최근 추적 기록" : "샘플 추적 기록"}
        </div>
      </header>

      <section className="queryPanel" aria-label="질의 실행">
        <form className="queryForm" onSubmit={handleQuerySubmit}>
          <label htmlFor="query-input" className="queryLabel">
            질의
          </label>
          <div className="queryComposer">
            <Search size={18} aria-hidden="true" />
            <textarea
              id="query-input"
              value={question}
              rows={2}
              maxLength={500}
              onChange={(event) => setQuestion(event.target.value)}
              disabled={queryRun.status === "loading"}
            />
            <button
              className="runButton"
              type="submit"
              disabled={queryRun.status === "loading" || question.trim() === ""}
            >
              {queryRun.status === "loading" ? (
                <Loader2 className="spin" size={16} aria-hidden="true" />
              ) : (
                <Send size={16} aria-hidden="true" />
              )}
              실행
            </button>
          </div>
        </form>
        <QueryResultPanel state={queryRun} />
      </section>

      <section className="summaryGrid" aria-label="평가 요약">
        <Metric icon={<CheckCircle2 size={18} />} label="인용 범위" value={summary.citationCoverage} />
        <Metric icon={<AlertTriangle size={18} />} label="근거 없는 주장" value={summary.unsupportedClaimPolicy} />
        <Metric icon={<ShieldCheck size={18} />} label="추적 기록" value={summary.traceSanitize} />
      </section>

      <section className="traceSection" aria-label="추적 기록 표">
        <div className="sectionHeader">
          <h2>질의 추적 기록</h2>
          <span>{formatTraceSource(loadedTrace)}</span>
        </div>
        <div className="traceQuery">
          <span>추적 질의</span>
          <strong>{loadedTrace.trace.query}</strong>
        </div>
        <table>
          <thead>
            <tr>
              <th>단계</th>
              <th>후보</th>
              <th>점수</th>
              <th>판정</th>
            </tr>
          </thead>
          <tbody>
            {traceRows.map((row) => (
              <tr key={`${row.stage}-${row.candidate}`}>
                <td data-label="단계">{row.stage}</td>
                <td data-label="후보">{row.candidate}</td>
                <td data-label="점수">{row.score}</td>
                <td data-label="판정">
                  <span className={`pill ${row.decision}`}>
                    {formatDecision(row.decision)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function QueryResultPanel(props: { state: QueryRunState }) {
  if (props.state.status === "idle") {
    return null;
  }

  if (props.state.status === "loading") {
    return (
      <div className="answerPanel muted" aria-live="polite">
        <Loader2 className="spin" size={16} aria-hidden="true" />
        검색과 답변 생성을 실행 중
      </div>
    );
  }

  if (props.state.status === "error") {
    return (
      <div className="answerPanel error" role="alert">
        <strong>질의 실패</strong>
        <span>{props.state.message}</span>
      </div>
    );
  }

  const { summary } = props.state;
  return (
    <div className="answerPanel" aria-live="polite">
      <div className="answerHeader">
        <div>
          <h2>제공자 응답</h2>
          <span className={`answerStatus ${summary.status}`}>{formatGenerationStatus(summary.status)}</span>
        </div>
        <div className="answerMeta">
          <span>주장 {summary.claimCount}개</span>
          <span>인용 {summary.citationCount}개</span>
        </div>
      </div>
      <p className="answerText">{summary.responseText}</p>
      {summary.status === "rejected" ? (
        <div className="rejectionReason">{summary.rejectionReason}</div>
      ) : null}
      <div className="chunkList" aria-label="선택된 청크">
        {summary.selectedChunkIds.length === 0 ? (
          <span>선택된 청크 없음</span>
        ) : (
          summary.selectedChunkIds.map((chunkId) => <span key={chunkId}>{chunkId}</span>)
        )}
      </div>
    </div>
  );
}

function Metric(props: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metricIcon">{props.icon}</div>
      <div>
        <div className="metricLabel">{props.label}</div>
        <div className="metricValue">{props.value}</div>
      </div>
    </div>
  );
}

function formatTraceSource(loadedTrace: LoadedTrace): string {
  const prefix = loadedTrace.source === "api" ? "최근 저장됨" : "정리된 샘플";
  return `${prefix} · ${new Date(loadedTrace.trace.createdAt).toLocaleString()}`;
}

function formatDecision(decision: "selected" | "rejected" | "candidate"): string {
  switch (decision) {
    case "selected":
      return "선택";
    case "rejected":
      return "거절";
    case "candidate":
      return "후보";
  }
}

function formatGenerationStatus(status: QueryRunSummary["status"]): string {
  switch (status) {
    case "answered":
      return "답변";
    case "conflict":
      return "충돌";
    case "rejected":
      return "거절";
  }
}
