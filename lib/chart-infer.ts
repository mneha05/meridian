import type { QueryResult, ChartSpec, ChartKind } from "./types";

// Heuristic auto-visualization: given a query result, infer the most useful
// chart. This is the "self-service analytics" magic — the user asks a question,
// MERIDIAN picks the right way to show it. Users can override the choice.

const TIME_HINTS = ["date", "month", "month_name", "quarter", "year", "weekday", "day", "period"];
const isTimeKey = (k: string) => TIME_HINTS.some((h) => k.toLowerCase().includes(h));

function isNumeric(result: QueryResult, key: string): boolean {
  return result.rows.length > 0 && typeof result.rows[0][key] === "number";
}

export function inferChart(result: QueryResult): ChartSpec {
  const { columns, rows } = result;
  const numericCols = columns.filter((c) => isNumeric(result, c) && !isIdColumn(c));
  const categoricalCols = columns.filter((c) => !isNumeric(result, c));
  const timeCol = columns.find((c) => isTimeKey(c));

  // Single scalar → KPI
  if (rows.length === 1 && numericCols.length >= 1 && categoricalCols.length === 0) {
    return {
      kind: "kpi",
      valueKeys: numericCols,
      title: prettify(numericCols[0]),
      reason: "A single aggregate value is best shown as a KPI metric.",
    };
  }

  // Time series → line/area
  if (timeCol && numericCols.length >= 1 && rows.length > 2) {
    return {
      kind: numericCols.length === 1 ? "area" : "line",
      labelKey: timeCol,
      valueKeys: numericCols,
      title: `${numericCols.map(prettify).join(", ")} over ${prettify(timeCol)}`,
      reason: `A ${prettify(timeCol)} column with ${numericCols.length} measure(s) indicates a trend over time.`,
    };
  }

  // Few categories + one measure → donut (composition)
  if (
    categoricalCols.length === 1 &&
    numericCols.length === 1 &&
    rows.length >= 2 &&
    rows.length <= 6
  ) {
    return {
      kind: "donut",
      labelKey: categoricalCols[0],
      valueKeys: numericCols,
      title: `${prettify(numericCols[0])} by ${prettify(categoricalCols[0])}`,
      reason: `${rows.length} categories with one measure — a composition view reads well as a donut.`,
    };
  }

  // Category + measure(s) → bar
  if (categoricalCols.length >= 1 && numericCols.length >= 1) {
    return {
      kind: "bar",
      labelKey: categoricalCols[0],
      valueKeys: numericCols.slice(0, 3),
      title: `${numericCols.slice(0, 3).map(prettify).join(", ")} by ${prettify(categoricalCols[0])}`,
      reason: `Categorical breakdown with measure(s) — a bar chart compares categories directly.`,
    };
  }

  // Fallback → table
  return {
    kind: "table",
    title: "Query result",
    reason: "No clear categorical/measure split — showing the raw result table.",
  };
}

export function alternativeCharts(result: QueryResult, current: ChartKind): ChartKind[] {
  const { columns, rows } = result;
  const numericCols = columns.filter((c) => isNumeric(result, c) && !isIdColumn(c));
  const categoricalCols = columns.filter((c) => !isNumeric(result, c));
  const options = new Set<ChartKind>(["table"]);

  if (rows.length === 1 && numericCols.length >= 1) options.add("kpi");
  if (categoricalCols.length >= 1 && numericCols.length >= 1) {
    options.add("bar");
    options.add("line");
    options.add("area");
    if (rows.length <= 8 && numericCols.length === 1) options.add("donut");
  }
  options.delete(current);
  return Array.from(options);
}

function isIdColumn(c: string): boolean {
  const l = c.toLowerCase();
  return l.endsWith("_id") || l.endsWith("_key") || l === "id";
}

export function prettify(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .replace(/\bId\b/, "ID");
}

export function formatValue(v: string | number, key?: string): string {
  if (typeof v === "number") {
    const isMoney = key && /revenue|cost|price|profit|sales|amount|margin/i.test(key);
    if (isMoney) {
      if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
      if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
      return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    }
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
    if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(2);
  }
  return String(v);
}
