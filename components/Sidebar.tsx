"use client";

import { useState } from "react";
import { SCHEMA } from "@/lib/schema";
import { questionsByCategory } from "@/lib/questions";
import type { SavedQuestion } from "@/lib/types";

const TYPE_COLOR: Record<string, string> = {
  int: "var(--c1)", float: "var(--c5)", money: "var(--c2)", string: "var(--c3)", date: "var(--c4)",
};

export default function Sidebar({
  onPick,
}: {
  onPick: (q: SavedQuestion) => void;
}) {
  const [tab, setTab] = useState<"questions" | "schema">("questions");
  const byCat = questionsByCategory();

  return (
    <aside className="w-[286px] shrink-0 border-r border-border bg-surface flex flex-col h-full">
      <div className="px-4 pt-4 pb-2 flex items-center gap-2">
        <Logo />
        <div>
          <div className="font-semibold text-[15px] leading-none">MERIDIAN</div>
          <div className="text-[11px] text-muted leading-none mt-1">Self-Service Analytics</div>
        </div>
      </div>

      <div className="flex gap-1 px-3 pt-2 border-b border-border">
        <button className={`tab flex-1 ${tab === "questions" ? "tab-active" : ""}`} onClick={() => setTab("questions")}>
          Questions
        </button>
        <button className={`tab flex-1 ${tab === "schema" ? "tab-active" : ""}`} onClick={() => setTab("schema")}>
          Schema
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {tab === "questions" ? (
          <div className="space-y-4">
            {Object.entries(byCat).map(([cat, qs]) => (
              <div key={cat}>
                <div className="label px-1 mb-1.5">{cat}</div>
                <div className="space-y-0.5">
                  {qs.map((q) => (
                    <button key={q.id} onClick={() => onPick(q)}
                      className="w-full text-left px-2.5 py-1.5 rounded-md text-[13px] text-ink2 hover:bg-surface2 hover:text-ink transition-colors">
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {SCHEMA.map((t) => (
              <TableCard key={t.name} table={t} />
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-border text-[11px] text-faint leading-relaxed">
        12,000 sales rows · 5 tables · in-browser SQL engine
      </div>
    </aside>
  );
}

function TableCard({ table }: { table: (typeof SCHEMA)[number] }) {
  const [open, setOpen] = useState(table.kind === "fact");
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-surface2 hover:bg-surface transition-colors">
        <div className="flex items-center gap-2">
          <span className={`pill ${table.kind === "fact" ? "pill-primary" : ""}`} style={{ fontSize: 9.5, padding: "1px 6px" }}>
            {table.kind === "fact" ? "FACT" : "DIM"}
          </span>
          <span className="mono text-[12.5px] text-ink">{table.name}</span>
        </div>
        <span className="text-faint text-xs">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="px-2 py-1.5">
          {table.columns.map((c) => (
            <div key={c.name} className="flex items-center justify-between px-1.5 py-1 group" title={c.description}>
              <span className="mono text-[12px] text-ink2">{c.name}</span>
              <span className="mono text-[10px]" style={{ color: TYPE_COLOR[c.type] }}>{c.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" className="shrink-0">
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#fff" strokeWidth="1.6" opacity="0.5" />
      <line x1="16" y1="7" x2="16" y2="25" stroke="#fff" strokeWidth="1.6" />
      <line x1="7" y1="16" x2="25" y2="16" stroke="#fff" strokeWidth="1.6" opacity="0.5" />
      <circle cx="16" cy="16" r="2.4" fill="#fff" />
    </svg>
  );
}
