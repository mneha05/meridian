"use client";

import type { QueryResult, ChartSpec } from "@/lib/types";
import { formatValue, prettify } from "@/lib/chart-infer";

const SERIES_COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)"];

export default function BarChart({ result, spec }: { result: QueryResult; spec: ChartSpec }) {
  const labelKey = spec.labelKey ?? result.columns[0];
  const valueKeys = (spec.valueKeys ?? []).slice(0, 3);
  if (valueKeys.length === 0) return null;

  const rows = result.rows.slice(0, 16);
  const W = 720, H = 340, padL = 56, padR = 16, padT = 16, padB = 64;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const maxVal = Math.max(
    ...rows.flatMap((r) => valueKeys.map((k) => Number(r[k]) || 0)),
    1,
  );
  const groupW = plotW / rows.length;
  const barW = Math.min(46, (groupW * 0.7) / valueKeys.length);
  const groupInner = barW * valueKeys.length;

  const ticks = 4;
  const yFor = (v: number) => padT + plotH * (1 - v / maxVal);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: rows.length > 8 ? 720 : "auto" }}>
        {/* gridlines */}
        {Array.from({ length: ticks + 1 }).map((_, i) => {
          const v = (maxVal / ticks) * i;
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

        {rows.map((row, i) => {
          const gx = padL + groupW * i + (groupW - groupInner) / 2;
          return (
            <g key={i}>
              {valueKeys.map((k, j) => {
                const v = Number(row[k]) || 0;
                const h = (v / maxVal) * plotH;
                const x = gx + j * barW;
                return (
                  <rect key={k} x={x} y={padT + plotH - h} width={barW - 3} height={Math.max(0, h)}
                    rx={3} fill={SERIES_COLORS[j]}>
                    <title>{`${row[labelKey]} · ${prettify(k)}: ${formatValue(v, k)}`}</title>
                  </rect>
                );
              })}
              <text x={gx + groupInner / 2} y={H - padB + 16} textAnchor="middle" fontSize={10.5}
                fill="var(--muted)" transform={rows.length > 6 ? `rotate(28 ${gx + groupInner / 2} ${H - padB + 16})` : undefined}>
                {truncate(String(row[labelKey]), rows.length > 6 ? 12 : 16)}
              </text>
            </g>
          );
        })}
      </svg>
      {valueKeys.length > 1 && <Legend keys={valueKeys} />}
    </div>
  );
}

function Legend({ keys }: { keys: string[] }) {
  return (
    <div className="flex flex-wrap gap-4 justify-center mt-1">
      {keys.map((k, j) => (
        <div key={k} className="flex items-center gap-1.5 text-xs text-muted">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: SERIES_COLORS[j] }} />
          {prettify(k)}
        </div>
      ))}
    </div>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
