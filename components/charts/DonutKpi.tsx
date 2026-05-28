"use client";

import type { QueryResult, ChartSpec } from "@/lib/types";
import { formatValue, prettify } from "@/lib/chart-infer";

const COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)", "var(--c7)", "var(--c8)"];

export function DonutChart({ result, spec }: { result: QueryResult; spec: ChartSpec }) {
  const labelKey = spec.labelKey ?? result.columns[0];
  const valueKey = (spec.valueKeys ?? [])[0] ?? result.columns[1];
  const rows = result.rows.slice(0, 8);
  const total = rows.reduce((s, r) => s + (Number(r[valueKey]) || 0), 0) || 1;

  const R = 120, r = 74, cx = 150, cy = 150;
  let angle = -Math.PI / 2;
  const segs = rows.map((row, i) => {
    const val = Number(row[valueKey]) || 0;
    const frac = val / total;
    const a0 = angle;
    const a1 = angle + frac * Math.PI * 2;
    angle = a1;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0);
    const x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
    const xi0 = cx + r * Math.cos(a0), yi0 = cy + r * Math.sin(a0);
    const xi1 = cx + r * Math.cos(a1), yi1 = cy + r * Math.sin(a1);
    const d = `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${r} ${r} 0 ${large} 0 ${xi0} ${yi0} Z`;
    return { d, color: COLORS[i % COLORS.length], label: String(row[labelKey]), val, frac };
  });

  return (
    <div className="flex flex-col md:flex-row items-center gap-8 justify-center py-2">
      <svg viewBox="0 0 300 300" className="w-[260px] h-[260px] shrink-0">
        {segs.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} stroke="var(--surface)" strokeWidth={2}>
            <title>{`${s.label}: ${formatValue(s.val, valueKey)} (${(s.frac * 100).toFixed(1)}%)`}</title>
          </path>
        ))}
        <text x={150} y={144} textAnchor="middle" fontSize={13} fill="var(--muted)">Total</text>
        <text x={150} y={168} textAnchor="middle" fontSize={20} fontWeight={700} fill="var(--ink)"
          fontFamily="var(--font-mono)">
          {formatValue(total, valueKey)}
        </text>
      </svg>
      <div className="space-y-2 min-w-[180px]">
        {segs.map((s, i) => (
          <div key={i} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
              <span className="text-ink2">{s.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="mono tnum text-ink">{formatValue(s.val, valueKey)}</span>
              <span className="text-faint tnum text-xs w-10 text-right">{(s.frac * 100).toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function KpiCards({ result, spec }: { result: QueryResult; spec: ChartSpec }) {
  const keys = spec.valueKeys ?? result.columns;
  const row = result.rows[0] ?? {};
  return (
    <div className="grid gap-4 py-4" style={{ gridTemplateColumns: `repeat(${Math.min(keys.length, 3)}, minmax(0,1fr))` }}>
      {keys.map((k) => (
        <div key={k} className="rounded-xl border border-border bg-surface2 px-5 py-6 text-center">
          <div className="label mb-2">{prettify(k)}</div>
          <div className="mono tnum text-ink" style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em" }}>
            {formatValue(Number(row[k]) || 0, k)}
          </div>
        </div>
      ))}
    </div>
  );
}
