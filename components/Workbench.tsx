"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import SqlHighlight from "./SqlHighlight";
import { ChartRenderer } from "./charts/ChartRenderer";
import { initDb, runQuery } from "@/lib/db";
import { inferChart, alternativeCharts, prettify } from "@/lib/chart-infer";
import { QUESTIONS } from "@/lib/questions";
import type { QueryResult, ChartSpec, ChartKind, DashboardTile, SavedQuestion } from "@/lib/types";

type Mode = "ask" | "sql";
type ResultTab = "viz" | "table" | "api";

const CHART_LABELS: Record<ChartKind, string> = {
  kpi: "Metric", bar: "Bar", line: "Line", area: "Area", donut: "Donut", table: "Table",
};

export default function Workbench({ hasKey }: { hasKey: boolean }) {
  const [view, setView] = useState<"explore" | "dashboard">("explore");
  const [mode, setMode] = useState<Mode>("ask");
  const [nlInput, setNlInput] = useState("");
  const [sqlInput, setSqlInput] = useState(QUESTIONS[0].sql);
  const [busy, setBusy] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<QueryResult | null>(null);
  const [spec, setSpec] = useState<ChartSpec | null>(null);
  const [chartKind, setChartKind] = useState<ChartKind>("bar");
  const [resultTab, setResultTab] = useState<ResultTab>("viz");
  const [sourceTag, setSourceTag] = useState<string | null>(null);

  const [tiles, setTiles] = useState<DashboardTile[]>([]);
  const [justPinned, setJustPinned] = useState(false);

  // init db + run a first query so the page is never empty
  useEffect(() => {
    (async () => {
      await initDb();
      setDbReady(true);
      await execute(QUESTIONS[0].sql, QUESTIONS[0].label);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const execute = useCallback(async (sql: string, tag?: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await runQuery(sql);
      const inferred = inferChart(res);
      setResult(res);
      setSpec(inferred);
      setChartKind(inferred.kind);
      setSqlInput(sql);
      setSourceTag(tag ?? null);
      setResultTab("viz");
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }, []);

  const askNl = useCallback(async () => {
    const q = nlInput.trim();
    if (!q) return;
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch("/api/nl2sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Could not translate question");
      await execute(data.sql, data.source === "model" ? "AI · model" : data.matched ? `matched: ${data.matched}` : "local parser");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }, [nlInput, execute]);

  const pickQuestion = useCallback((q: SavedQuestion) => {
    setNlInput(q.label);
    setMode("ask");
    execute(q.sql, q.label);
  }, [execute]);

  const pinToDashboard = useCallback(() => {
    if (!result || !spec) return;
    const tile: DashboardTile = {
      id: `tile-${Date.now()}`,
      title: spec.title,
      sql: result.sql,
      chart: { ...spec, kind: chartKind },
      result,
    };
    setTiles((t) => [tile, ...t]);
    setJustPinned(true);
    setTimeout(() => setJustPinned(false), 1600);
  }, [result, spec, chartKind]);

  const removeTile = (id: string) => setTiles((t) => t.filter((x) => x.id !== id));

  const altCharts = result ? alternativeCharts(result, chartKind) : [];

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar onPick={pickQuestion} />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 shrink-0 border-b border-border bg-surface flex items-center justify-between px-5">
          <div className="flex items-center gap-1">
            <button className={`tab ${view === "explore" ? "tab-active" : ""}`} onClick={() => setView("explore")}>
              Explore
            </button>
            <button className={`tab ${view === "dashboard" ? "tab-active" : ""}`} onClick={() => setView("dashboard")}>
              Dashboard {tiles.length > 0 && <span className="pill ml-1" style={{ fontSize: 10, padding: "0 6px" }}>{tiles.length}</span>}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className={`pill ${hasKey ? "pill-primary" : ""}`}>
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: hasKey ? "var(--primary)" : "var(--good)" }} />
              {hasKey ? "AI translation live" : "Local engine"}
            </span>
            <a href="https://github.com/mneha05" target="_blank" rel="noreferrer" className="text-muted hover:text-ink transition-colors" title="Source">
              <GithubIcon />
            </a>
          </div>
        </header>

        {view === "explore" ? (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-[920px] mx-auto px-6 py-6">
              {/* Query composer */}
              <div className="card p-4 mb-5">
                <div className="flex items-center gap-1 mb-3">
                  <button className={`tab ${mode === "ask" ? "tab-active" : ""}`} onClick={() => setMode("ask")}>
                    Ask a question
                  </button>
                  <button className={`tab ${mode === "sql" ? "tab-active" : ""}`} onClick={() => setMode("sql")}>
                    SQL
                  </button>
                </div>

                {mode === "ask" ? (
                  <div className="flex gap-2">
                    <input
                      className="input flex-1"
                      placeholder='e.g. "revenue by region", "top 10 products", "monthly revenue trend"'
                      value={nlInput}
                      onChange={(e) => setNlInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && askNl()}
                    />
                    <button className="btn btn-primary" onClick={askNl} disabled={busy || !dbReady}>
                      {busy ? <Spinner /> : <SparkIcon />} Run
                    </button>
                  </div>
                ) : (
                  <div>
                    <textarea
                      className="codearea"
                      rows={5}
                      value={sqlInput}
                      onChange={(e) => setSqlInput(e.target.value)}
                      spellCheck={false}
                    />
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[11px] text-faint mono">SELECT-only · runs in-browser via AlaSQL</span>
                      <button className="btn btn-primary" onClick={() => execute(sqlInput, "manual SQL")} disabled={busy || !dbReady}>
                        {busy ? <Spinner /> : <PlayIcon />} Execute
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className="card p-4 mb-5 border-l-2" style={{ borderLeftColor: "var(--bad)" }}>
                  <div className="text-[13px] text-bad font-medium mb-0.5">Query error</div>
                  <div className="text-[13px] text-muted mono">{error}</div>
                </div>
              )}

              {!dbReady && !error && <LoadingCard />}

              {result && spec && dbReady && (
                <div className="card overflow-hidden fade-up">
                  {/* Result header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <div className="min-w-0">
                      <div className="font-semibold text-[15px] truncate">{spec.title}</div>
                      <div className="text-[11.5px] text-faint mt-0.5">
                        {result.rowCount} row{result.rowCount === 1 ? "" : "s"} · {result.elapsedMs.toFixed(1)} ms
                        {sourceTag && <> · <span className="text-muted">{sourceTag}</span></>}
                      </div>
                    </div>
                    <button className="btn" onClick={pinToDashboard} disabled={justPinned}>
                      {justPinned ? <><CheckIcon /> Pinned</> : <><PinIcon /> Pin to dashboard</>}
                    </button>
                  </div>

                  {/* Tabs */}
                  <div className="flex items-center justify-between px-4 border-b border-border">
                    <div className="flex gap-3">
                      {(["viz", "table", "api"] as ResultTab[]).map((t) => (
                        <button key={t} className={`tab ${resultTab === t ? "tab-active" : ""}`} onClick={() => setResultTab(t)}>
                          {t === "viz" ? "Visualization" : t === "table" ? "Table" : "API"}
                        </button>
                      ))}
                    </div>
                    {resultTab === "viz" && altCharts.length > 0 && (
                      <div className="flex items-center gap-1.5 py-1.5">
                        <span className="text-[11px] text-faint mr-1">Chart:</span>
                        <button className="pill pill-primary" style={{ cursor: "default" }}>{CHART_LABELS[chartKind]}</button>
                        {altCharts.map((k) => (
                          <button key={k} className="pill hover:text-ink" onClick={() => setChartKind(k)}>
                            {CHART_LABELS[k]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-4">
                    {resultTab === "viz" && (
                      <>
                        <ChartRenderer result={result} spec={spec} kind={chartKind} />
                        <div className="text-[11.5px] text-faint mt-3 flex items-start gap-1.5">
                          <InfoIcon />
                          <span>{spec.reason}</span>
                        </div>
                      </>
                    )}
                    {resultTab === "table" && <ChartRenderer result={result} spec={spec} kind="table" />}
                    {resultTab === "api" && <ApiView sql={result.sql} result={result} />}
                  </div>
                </div>
              )}

              {/* Generated SQL (always visible for transparency) */}
              {result && dbReady && (
                <div className="card mt-4 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                    <span className="label">Generated SQL</span>
                    <CopyBtn text={result.sql} />
                  </div>
                  <div className="px-4 py-3 bg-[#0E1116] rounded-b-xl">
                    <SqlHighlight sql={result.sql} />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <DashboardView tiles={tiles} onRemove={removeTile} onGoExplore={() => setView("explore")} />
        )}
      </main>
    </div>
  );
}

// ── API tab ───────────────────────────────────────────────────────────────
function ApiView({ sql, result }: { sql: string; result: QueryResult }) {
  const endpoint = "POST /api/v1/query";
  const reqBody = JSON.stringify({ sql: sql.replace(/\s+/g, " ").trim() }, null, 2);
  const respBody = JSON.stringify(
    { columns: result.columns, row_count: result.rowCount, elapsed_ms: +result.elapsedMs.toFixed(2), rows: result.rows.slice(0, 3) },
    null, 2,
  );
  return (
    <div className="space-y-3">
      <div className="text-[12px] text-muted">
        Every query in MERIDIAN is also a versioned REST endpoint — the same self-service result, consumable by any downstream service. This is the API-management surface.
      </div>
      <div className="flex items-center gap-2">
        <span className="pill pill-primary mono">{endpoint}</span>
        <span className="pill mono">200 OK</span>
        <span className="pill mono">{result.elapsedMs.toFixed(1)} ms</span>
      </div>
      <ApiBlock title="Request" body={reqBody} />
      <ApiBlock title="Response (truncated)" body={respBody} />
    </div>
  );
}
function ApiBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg overflow-hidden border border-border">
      <div className="px-3 py-1.5 bg-surface2 border-b border-border flex items-center justify-between">
        <span className="label">{title}</span>
        <CopyBtn text={body} />
      </div>
      <pre className="mono text-[12px] leading-relaxed p-3 m-0 overflow-x-auto bg-[#0E1116]" style={{ color: "#E6E9EF" }}>{body}</pre>
    </div>
  );
}

// ── Dashboard ───────────────────────────────────────────────────────────────
function DashboardView({
  tiles, onRemove, onGoExplore,
}: { tiles: DashboardTile[]; onRemove: (id: string) => void; onGoExplore: () => void }) {
  if (tiles.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-primary-soft flex items-center justify-center" style={{ background: "var(--primary-soft)" }}>
            <GridIcon />
          </div>
          <div className="font-semibold text-[16px] mb-1">Your dashboard is empty</div>
          <div className="text-[13.5px] text-muted mb-4">Pin any query result from the Explore tab to compose a live dashboard. Tiles re-run against the in-browser engine.</div>
          <button className="btn btn-primary mx-auto" onClick={onGoExplore}><SparkIcon /> Explore data</button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {tiles.map((tile) => (
            <div key={tile.id} className="card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                <span className="font-semibold text-[13.5px] truncate">{tile.title}</span>
                <button className="btn-ghost btn" style={{ height: 28, padding: "0 8px" }} onClick={() => onRemove(tile.id)} title="Remove">
                  <XIcon />
                </button>
              </div>
              <div className="p-3">
                <ChartRenderer result={tile.result} spec={tile.chart} kind={tile.chart.kind} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── small bits ──────────────────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className="text-[11px] text-faint hover:text-ink transition-colors flex items-center gap-1"
      onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); }}>
      {done ? <CheckIcon /> : <CopyIcon />} {done ? "Copied" : "Copy"}
    </button>
  );
}
function LoadingCard() {
  return (
    <div className="card p-4">
      <div className="shimmer h-5 w-48 rounded mb-4" />
      <div className="shimmer h-[300px] w-full rounded" />
    </div>
  );
}
function Spinner() { return <span className="spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />; }

// icons
function SparkIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7L12 3z" fill="currentColor"/></svg>; }
function PlayIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>; }
function PinIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 17v5M9 3h6l-1 7 3 2v2H7v-2l3-2-1-7z"/></svg>; }
function CheckIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M20 6L9 17l-5-5"/></svg>; }
function CopyIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>; }
function XIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>; }
function InfoIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>; }
function GridIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>; }
function GithubIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.6 2 12.2c0 4.5 2.9 8.3 6.8 9.6.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.4-3.4-1.4-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.4 9.4 0 015 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5 3.9-1.3 6.8-5.1 6.8-9.6C22 6.6 17.5 2 12 2z"/></svg>; }
