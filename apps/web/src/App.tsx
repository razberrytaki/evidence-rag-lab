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
          <p>Traceable retrieval, citation coverage, and explicit rejection.</p>
        </div>
        <div className="status">
          <ShieldCheck size={18} aria-hidden="true" />
          {loadedTrace.source === "api" ? "Live trace loaded" : "Sample trace loaded"}
        </div>
      </header>

      <section className="queryPanel" aria-label="Run query">
        <form className="queryForm" onSubmit={handleQuerySubmit}>
          <label htmlFor="query-input" className="queryLabel">
            Question
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
              Run
            </button>
          </div>
        </form>
        <QueryResultPanel state={queryRun} />
      </section>

      <section className="summaryGrid" aria-label="Evaluation summary">
        <Metric icon={<CheckCircle2 size={18} />} label="citation coverage" value={summary.citationCoverage} />
        <Metric icon={<AlertTriangle size={18} />} label="unsupported claim" value={summary.unsupportedClaimPolicy} />
        <Metric icon={<ShieldCheck size={18} />} label="trace sanitize" value={summary.traceSanitize} />
      </section>

      <section className="traceSection" aria-label="Trace table">
        <div className="sectionHeader">
          <h2>Query Trace</h2>
          <span>{formatTraceSource(loadedTrace)}</span>
        </div>
        <div className="traceQuery">
          <span>Trace query</span>
          <strong>{loadedTrace.trace.query}</strong>
        </div>
        <table>
          <thead>
            <tr>
              <th>Stage</th>
              <th>Candidate</th>
              <th>Score</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {traceRows.map((row) => (
              <tr key={`${row.stage}-${row.candidate}`}>
                <td>{row.stage}</td>
                <td>{row.candidate}</td>
                <td>{row.score}</td>
                <td>
                  <span className={`pill ${row.decision}`}>
                    {row.decision}
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
        Running retrieval and generation
      </div>
    );
  }

  if (props.state.status === "error") {
    return (
      <div className="answerPanel error" role="alert">
        <strong>Query failed</strong>
        <span>{props.state.message}</span>
      </div>
    );
  }

  const { summary } = props.state;
  return (
    <div className="answerPanel" aria-live="polite">
      <div className="answerHeader">
        <div>
          <h2>Provider Response</h2>
          <span className={`answerStatus ${summary.status}`}>{summary.status}</span>
        </div>
        <div className="answerMeta">
          <span>{summary.claimCount} claims</span>
          <span>{summary.citationCount} citations</span>
        </div>
      </div>
      <p className="answerText">{summary.responseText}</p>
      {summary.status === "rejected" ? (
        <div className="rejectionReason">{summary.rejectionReason}</div>
      ) : null}
      <div className="chunkList" aria-label="Selected chunks">
        {summary.selectedChunkIds.length === 0 ? (
          <span>No selected chunks</span>
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
  const prefix = loadedTrace.source === "api" ? "latest persisted" : "sanitized sample";
  return `${prefix} · ${new Date(loadedTrace.trace.createdAt).toLocaleString()}`;
}
