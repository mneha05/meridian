import type { NlToSqlResponse } from "./types";
import { QUESTIONS } from "./questions";

// Deterministic natural-language → SQL. No model required. Handles the common
// analytical phrasings over the star schema by recognizing (a) a measure,
// (b) a grouping dimension, and (c) optional ordering/limit. Falls back to a
// fuzzy match against the curated question library.
//
// This guarantees the product works for every visitor with zero API key.

interface Dimension { keys: string[]; sql: { select: string; join: string; group: string }; }
interface Measure { keys: string[]; expr: string; alias: string; }

const DIMENSIONS: Dimension[] = [
  { keys: ["region", "territory"], sql: { select: "r.region AS region", join: "JOIN dim_region r ON f.region_id = r.region_id", group: "r.region" } },
  { keys: ["country", "countries"], sql: { select: "r.country AS country", join: "JOIN dim_region r ON f.region_id = r.region_id", group: "r.country" } },
  { keys: ["sales rep", "rep", "salesperson", "account exec"], sql: { select: "r.sales_rep AS sales_rep", join: "JOIN dim_region r ON f.region_id = r.region_id", group: "r.sales_rep" } },
  { keys: ["category", "categories"], sql: { select: "p.category AS category", join: "JOIN dim_product p ON f.product_id = p.product_id", group: "p.category" } },
  { keys: ["subcategory", "sub-category"], sql: { select: "p.subcategory AS subcategory", join: "JOIN dim_product p ON f.product_id = p.product_id", group: "p.subcategory" } },
  { keys: ["product", "products"], sql: { select: "p.product_name AS product", join: "JOIN dim_product p ON f.product_id = p.product_id", group: "p.product_name" } },
  { keys: ["segment", "segments"], sql: { select: "c.segment AS segment", join: "JOIN dim_customer c ON f.customer_id = c.customer_id", group: "c.segment" } },
  { keys: ["industry", "industries", "vertical"], sql: { select: "c.industry AS industry", join: "JOIN dim_customer c ON f.customer_id = c.customer_id", group: "c.industry" } },
  { keys: ["customer", "customers", "account"], sql: { select: "c.customer_name AS customer", join: "JOIN dim_customer c ON f.customer_id = c.customer_id", group: "c.customer_name" } },
  { keys: ["month", "monthly"], sql: { select: "d.year AS year, d.month AS month, d.month_name AS month_name", join: "JOIN dim_date d ON f.date_key = d.date_key", group: "d.year, d.month, d.month_name" } },
  { keys: ["quarter", "quarterly"], sql: { select: "d.year AS year, d.quarter AS quarter", join: "JOIN dim_date d ON f.date_key = d.date_key", group: "d.year, d.quarter" } },
  { keys: ["year", "yearly", "annual"], sql: { select: "d.year AS year", join: "JOIN dim_date d ON f.date_key = d.date_key", group: "d.year" } },
  { keys: ["weekday", "day of week"], sql: { select: "d.weekday AS weekday", join: "JOIN dim_date d ON f.date_key = d.date_key", group: "d.weekday" } },
];

const MEASURES: Measure[] = [
  { keys: ["profit", "margin", "profitability"], expr: "ROUND(SUM(f.revenue) - SUM(f.cost))", alias: "profit" },
  { keys: ["revenue", "sales", "income", "earnings", "money"], expr: "ROUND(SUM(f.revenue))", alias: "revenue" },
  { keys: ["cost", "costs", "cogs"], expr: "ROUND(SUM(f.cost))", alias: "cost" },
  { keys: ["units", "quantity", "volume", "count of units"], expr: "SUM(f.quantity)", alias: "units" },
  { keys: ["orders", "transactions", "deals", "count", "number of"], expr: "COUNT(*)", alias: "orders" },
  { keys: ["average order", "avg order", "average revenue", "avg revenue"], expr: "ROUND(AVG(f.revenue))", alias: "avg_revenue" },
  { keys: ["discount"], expr: "ROUND(AVG(f.discount), 3)", alias: "avg_discount" },
];

function findFirst<T extends { keys: string[] }>(items: T[], text: string): T | null {
  for (const it of items) {
    for (const k of it.keys) {
      if (text.includes(k)) return it;
    }
  }
  return null;
}

export function localNlToSql(question: string): NlToSqlResponse | null {
  const q = question.toLowerCase().trim();

  // 1) Direct/fuzzy match to a curated question
  const direct = QUESTIONS.find((x) => q === x.label.toLowerCase());
  if (direct) return { sql: direct.sql, source: "local", matched: direct.label };

  const fuzzy = bestFuzzy(q);
  if (fuzzy && fuzzy.score >= 0.55) {
    return { sql: fuzzy.question.sql, source: "local", matched: fuzzy.question.label };
  }

  // 2) Compositional parse: measure + dimension (+ limit/order)
  const measure = findFirst(MEASURES, q) ?? MEASURES.find((m) => m.alias === "revenue")!;
  const dim = findFirst(DIMENSIONS, q);

  // total (no dimension)
  if (!dim) {
    if (/\btotal\b|\boverall\b|\bcompany\b|\ball\b/.test(q) || !/\bby\b|\bper\b|\bacross\b/.test(q)) {
      return {
        sql: `SELECT ${measure.expr} AS total_${measure.alias} FROM fact_sales`,
        source: "local",
        explanation: `Aggregate ${measure.alias} with no grouping dimension.`,
      };
    }
    return null;
  }

  // Determine ordering / limit
  const topMatch = q.match(/top\s+(\d+)/);
  const limit = topMatch ? parseInt(topMatch[1], 10) : isTimeDim(dim) ? 0 : 0;
  const isTime = isTimeDim(dim);

  const orderClause = isTime
    ? `ORDER BY ${dim.sql.group}`
    : `ORDER BY ${measure.alias} DESC`;
  const limitClause = limit > 0 ? ` LIMIT ${limit}` : (!isTime && /top|best|highest|largest/.test(q) ? " LIMIT 10" : "");

  // include margin_pct when profit/margin asked with a dimension
  const extraSelect =
    measure.alias === "profit"
      ? `, ROUND(SUM(f.revenue)) AS revenue, ROUND(100.0 * (SUM(f.revenue) - SUM(f.cost)) / SUM(f.revenue), 1) AS margin_pct`
      : "";

  const sql =
    `SELECT ${dim.sql.select}, ${measure.expr} AS ${measure.alias}${extraSelect}\n` +
    `FROM fact_sales f ${dim.sql.join}\n` +
    `GROUP BY ${dim.sql.group} ${orderClause}${limitClause}`;

  return {
    sql,
    source: "local",
    explanation: `Recognized measure "${measure.alias}" grouped by "${dim.keys[0]}".`,
  };
}

function isTimeDim(d: Dimension): boolean {
  return ["month", "quarter", "year", "weekday"].some((t) => d.keys[0].includes(t));
}

function bestFuzzy(q: string): { question: (typeof QUESTIONS)[number]; score: number } | null {
  const qTokens = new Set(tokenize(q));
  let best: { question: (typeof QUESTIONS)[number]; score: number } | null = null;
  for (const cand of QUESTIONS) {
    const cTokens = tokenize(cand.label.toLowerCase());
    let hit = 0;
    for (const t of cTokens) if (qTokens.has(t)) hit++;
    const score = hit / Math.max(cTokens.length, 1);
    if (!best || score > best.score) best = { question: cand, score };
  }
  return best;
}

function tokenize(s: string): string[] {
  return s.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t));
}
const STOP = new Set(["the", "and", "for", "show", "what", "list", "give", "are", "our", "all", "with", "how", "many", "much", "per"]);
