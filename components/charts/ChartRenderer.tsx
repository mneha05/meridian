"use client";

import type { QueryResult, ChartSpec, ChartKind } from "@/lib/types";
import { formatValue, prettify } from "@/lib/chart-infer";
import BarChart from "./BarChart";
import LineChart from "./LineChart";
import { DonutChart, KpiCards } from "./DonutKpi";

export function ResultTable({ result }: { result: QueryResult }) {
  const { columns, rows } = result;
  return (
    <div className="overflow-auto max-h-[420px] rounded-lg border border-border">
      <table className="dtable">
        <thead>
          <tr>
            {columns.map((c) => <th key={c}>{prettify(c)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 200).map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c} className={typeof r[c] === "number" ? "num" : ""}>
                  {typeof r[c] === "number" ? formatValue(r[c], c) : String(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChartRenderer({
  result, spec, kind,
}: { result: QueryResult; spec: ChartSpec; kind: ChartKind }) {
  const effectiveSpec: ChartSpec = { ...spec, kind };
  switch (kind) {
    case "kpi":   return <KpiCards result={result} spec={effectiveSpec} />;
    case "bar":   return <BarChart result={result} spec={effectiveSpec} />;
    case "line":  return <LineChart result={result} spec={effectiveSpec} />;
    case "area":  return <LineChart result={result} spec={effectiveSpec} area />;
    case "donut": return <DonutChart result={result} spec={effectiveSpec} />;
    case "table": return <ResultTable result={result} />;
    default:      return <ResultTable result={result} />;
  }
}
