"use client";

import type { QueryResult, Row } from "./types";
import { getSeedData } from "./seed";

// In-browser SQL engine. AlaSQL runs real SQL (SELECT, JOIN, GROUP BY, WHERE,
// ORDER BY, aggregates, expressions) against the seeded star schema entirely
// client-side — no server, no external database, works for every visitor.

let _ready = false;
let _alasql: any = null;

export async function initDb(): Promise<void> {
  if (_ready) return;
  // Resolved to the browser build via the webpack alias in next.config.mjs.
  const mod = await import("alasql");
  _alasql = (mod as any).default ?? mod;

  const data = getSeedData();

  // Drop if re-init (hot reload)
  for (const t of ["fact_sales", "dim_date", "dim_product", "dim_region", "dim_customer"]) {
    try { _alasql(`DROP TABLE IF EXISTS ${t}`); } catch {}
  }

  _alasql("CREATE TABLE dim_date");
  _alasql("CREATE TABLE dim_product");
  _alasql("CREATE TABLE dim_region");
  _alasql("CREATE TABLE dim_customer");
  _alasql("CREATE TABLE fact_sales");

  _alasql.tables.dim_date.data = data.dim_date;
  _alasql.tables.dim_product.data = data.dim_product;
  _alasql.tables.dim_region.data = data.dim_region;
  _alasql.tables.dim_customer.data = data.dim_customer;
  _alasql.tables.fact_sales.data = data.fact_sales;

  _ready = true;
}

export function isDbReady(): boolean {
  return _ready;
}

export async function runQuery(sql: string): Promise<QueryResult> {
  if (!_ready) await initDb();
  const cleaned = sql.trim().replace(/;\s*$/, "");
  if (!/^\s*select/i.test(cleaned) && !/^\s*with/i.test(cleaned)) {
    throw new Error("Only SELECT queries are permitted in this analytics sandbox.");
  }
  const t0 = performance.now();
  let rows: Row[];
  try {
    rows = _alasql(cleaned) as Row[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`SQL error: ${msg}`);
  }
  const elapsedMs = performance.now() - t0;

  if (!Array.isArray(rows)) rows = [];

  // Defensive chronological ordering. AlaSQL's ORDER BY on joined+grouped
  // dimension columns is unreliable; for time-series shapes (year + month/quarter)
  // chronological order is always what's wanted, so we enforce it in JS.
  rows = sortChronologically(rows);

  // Normalize: derive column order from first row
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  // Round floats for display sanity
  for (const r of rows) {
    for (const k of columns) {
      const v = r[k];
      if (typeof v === "number" && !Number.isInteger(v)) {
        r[k] = Math.round(v * 100) / 100;
      }
    }
  }

  return { columns, rows, sql: cleaned, elapsedMs, rowCount: rows.length };
}

// Enforce chronological order when the result is a time series. Only kicks in
// when the columns indicate a calendar shape, so it never disturbs measure-ranked
// results (e.g. "top products by revenue DESC").
function sortChronologically(rows: Row[]): Row[] {
  if (rows.length < 2) return rows;
  const cols = Object.keys(rows[0]);
  const has = (n: string) => cols.includes(n);
  const QORD: Record<string, number> = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };

  const keyer = (() => {
    if (has("year") && has("month")) return (r: Row) => Number(r.year) * 100 + Number(r.month);
    if (has("year") && has("quarter")) return (r: Row) => Number(r.year) * 10 + (QORD[String(r.quarter)] ?? 0);
    if (has("month") && !has("year")) return (r: Row) => Number(r.month);
    return null;
  })();

  if (!keyer) return rows;
  return [...rows].sort((a, b) => keyer(a) - keyer(b));
}
