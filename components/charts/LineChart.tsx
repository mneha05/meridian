"use client";

import type { QueryResult, ChartSpec } from "@/lib/types";
import { formatValue, prettify } from "@/lib/chart-infer";

const SERIES_COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)"];

export default function LineChart({
  result, spec, area = false,
}: { result: QueryResult; spec: ChartSpec; area?: boolean }) {
  const labelKey = spec.labelKey ?? result.columns[0];
  const valueKeys = (spec.valueKeys ?? []).slice(0, 4);
  if (valueKeys.length === 0) return null;

  const rows = result.rows;
  const W = 720, H = 340, padL = 56, padR = 18, padT = 16, padB = 52;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxVal = Math.max(...rows.flatMap((r) => valueKeys.map((k) => Number(r[k]) || 0)), 1);
  const minVal = Math.min(...rows.flatMap((r) => valueKeys.map((k) => Number(r[k]) || 0)), 0);
  const span = maxVal - minVal || 1;

  const xFor = (i: number) => padL + (plotW * i) / Math.max(rows.length - 1, 1);
  const yFor = (v: number) => padT + plotH * (1 - (v - minVal) / span);
  const ticks = 4;

  const labelFor = (row: QueryResult["rows"][number]) => {
    if (row.month_name) return String(row.month_name);
    if (row.quarter) return `${row.quarter}`;
    return String(row[labelKey]);
  };

  const step = Math.ceil(rows.length / 12);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          {valueKeys.map((k, j) => (
            <linearGradient key={k} id={`grad-${j}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES_COLORS[j]} stopOpacity={0.22} />
              <stop offset="100%" stopColor={SERIES_COLORS[j]} stopOpacity={0.01} />
            </linearGradient>
          ))}
        </defs>

        {Array.from({ length: ticks + 1 }).map((_, i) => {
          const v = minVal + (span / ticks) * i;
          const y = yFor(v);
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--border)" strokeWidth={1} />
              <text x={padL - 8} y={y + 4} textAnchor="end" fontSize={10.5} fill="var(--faint)" fontFamily="var(--font-mono)">
                {formatValue(Math.round(v), valueKeys[0])}
              </text>
            </g>
          );
        })}

        {valueKeys.map((k, j) => {
          const pts = rows.map((r, i) => `${xFor(i)},${yFor(Number(r[k]) || 0)}`).join(" ");
          const areaPath =
            `M ${xFor(0)},${yFor(Number(rows[0][k]) || 0)} ` +
            rows.map((r, i) => `L ${xFor(i)},${yFor(Number(r[k]) || 0)}`).join(" ") +
            ` L ${xFor(rows.length - 1)},${padT + plotH} L ${xFor(0)},${padT + plotH} Z`;
          return (
            <g key={k}>
              {area && <path d={areaPath} fill={`url(#grad-${j})`} />}
              <polyline points={pts} fill="none" stroke={SERIES_COLORS[j]} strokeWidth={2}
                strokeLinejoin="round" strokeLinecap="round" />
              {rows.map((r, i) => (
                <circle key={i} cx={xFor(i)} cy={yFor(Number(r[k]) || 0)} r={rows.length > 24 ? 0 : 2.6}
                  fill="var(--surface)" stroke={SERIES_COLORS[j]} strokeWidth={1.6}>
                  <title>{`${labelFor(r)} · ${prettify(k)}: ${formatValue(Number(r[k]) || 0, k)}`}</title>
                </circle>
              ))}
            </g>
          );
        })}

        {rows.map((r, i) =>
          i % step === 0 ? (
            <text key={i} x={xFor(i)} y={H - padB + 18} textAnchor="middle" fontSize={10.5} fill="var(--muted)">
              {truncate(labelFor(r), 10)}
            </text>
          ) : null,
        )}
      </svg>
      {valueKeys.length > 1 && (
        <div className="flex flex-wrap gap-4 justify-center mt-1">
          {valueKeys.map((k, j) => (
            <div key={k} className="flex items-center gap-1.5 text-xs text-muted">
              <span className="inline-block w-3 h-0.5 rounded" style={{ background: SERIES_COLORS[j] }} />
              {prettify(k)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
