import { NextRequest, NextResponse } from "next/server";
import { schemaForPrompt } from "@/lib/schema";
import { localNlToSql } from "@/lib/nl2sql-local";
import type { NlToSqlResponse } from "@/lib/types";

export const runtime = "nodejs";

const SYSTEM = `You translate natural-language analytics questions into a single SQL SELECT statement for an in-browser AlaSQL engine over this star schema:

%SCHEMA%

Rules:
- Output ONLY the SQL. No prose, no markdown fences, no semicolon.
- SELECT statements only. Never INSERT/UPDATE/DELETE/DROP.
- Always alias aggregates with readable snake_case (e.g. AS revenue, AS profit).
- Join fact_sales (alias f) to dimensions as needed. revenue and cost live on fact_sales.
- For "profit" use ROUND(SUM(f.revenue) - SUM(f.cost)). For "margin_pct" use ROUND(100.0*(SUM(f.revenue)-SUM(f.cost))/SUM(f.revenue),1).
- Round money aggregates with ROUND(...).
- For time trends, group by year then month (or quarter) and ORDER BY chronologically.
- For "top N", add ORDER BY <measure> DESC LIMIT N.
- Keep result sets reasonable (use LIMIT for product/customer/rep breakdowns).`;

export async function POST(req: NextRequest) {
  let question = "";
  try {
    const body = await req.json();
    question = String(body.question ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!question) {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  // No key → deterministic local parser
  if (!apiKey) {
    const local = localNlToSql(question);
    if (local) return NextResponse.json(local satisfies NlToSqlResponse);
    return NextResponse.json(
      {
        error:
          "Couldn't translate that one locally. Try a phrasing like “revenue by region”, “top 10 products”, “monthly revenue trend”, or add an API key for free-form questions.",
      },
      { status: 422 },
    );
  }

  // Key present → model translation, with local as a safety net
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 600,
      system: SYSTEM.replace("%SCHEMA%", schemaForPrompt()),
      messages: [{ role: "user", content: question }],
    });
    const text = resp.content.find((b) => b.type === "text");
    let sql = text && text.type === "text" ? text.text.trim() : "";
    sql = sql.replace(/^```(?:sql)?/i, "").replace(/```$/i, "").replace(/;\s*$/, "").trim();
    if (!/^\s*select/i.test(sql) && !/^\s*with/i.test(sql)) {
      const local = localNlToSql(question);
      if (local) return NextResponse.json(local);
      return NextResponse.json({ error: "Model did not return a SELECT statement." }, { status: 422 });
    }
    return NextResponse.json({ sql, source: "model" } satisfies NlToSqlResponse);
  } catch (err) {
    // On any model error, gracefully fall back to local
    const local = localNlToSql(question);
    if (local) return NextResponse.json(local);
    const msg = err instanceof Error ? err.message : "Translation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
