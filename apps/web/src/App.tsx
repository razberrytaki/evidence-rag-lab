import { AlertTriangle, CheckCircle2, Search, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  buildTraceRows,
  fetchLatestTrace,
  getConfiguredApiBaseUrl,
  sampleTrace,
  summarizeTrace,
  type LoadedTrace
} from "./queryTrace";

export function App() {
  const [loadedTrace, setLoadedTrace] = useState<LoadedTrace>({
    source: "sample",
    trace: sampleTrace
  });

  useEffect(() => {
    let active = true;

    void fetchLatestTrace(getConfiguredApiBaseUrl()).then((result) => {
      if (active) {
        setLoadedTrace(result);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const traceRows = useMemo(() => buildTraceRows(loadedTrace.trace), [loadedTrace.trace]);
  const summary = useMemo(() => summarizeTrace(loadedTrace.trace), [loadedTrace.trace]);

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

      <section className="queryPanel" aria-label="Query">
        <div id="query-label" className="queryLabel">
          Query
        </div>
        <div className="queryInput" aria-labelledby="query-label">
          <Search size={18} aria-hidden="true" />
          <div className="queryValue">{loadedTrace.trace.query}</div>
        </div>
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
