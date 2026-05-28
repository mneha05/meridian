# MERIDIAN — Self-Service Analytics & Reporting Platform

**Live demo:** **Live demo:** [meridian-omega-two.vercel.app](https://meridian-omega-two.vercel.app/)· **Source:** github.com/mneha05/meridian

Ask a question in plain English or write SQL, get an instant, correctly-chosen
visualization, and pin results into a live dashboard — over a 12,000-row
enterprise data warehouse that runs **entirely in your browser**. No backend
database, no login, no API key required.

---

## Why this exists

This is a working model of a self-service business-intelligence tool: the kind
of system that lets non-technical staff answer their own data questions instead
of filing a ticket and waiting on an analyst. It covers the full path from
**question → query → result → visualization → shareable dashboard → API**, which
is the core loop of any enterprise reporting platform.

## What it does

- **Natural-language querying.** Type "revenue by region" or "profit by
  industry" and MERIDIAN translates it to SQL, runs it, and visualizes the
  answer. The generated SQL is always shown — nothing is hidden.
- **Full SQL editor.** Drop into raw SQL for anything the NL layer doesn't
  cover. Queries execute against a real in-browser SQL engine.
- **Automatic visualization.** A heuristic engine inspects the result shape
  (single scalar → KPI, time column → line/area, few categories → donut,
  categorical breakdown → bar) and picks the most useful chart. You can override
  the choice; every chart is hand-built SVG.
- **Dashboards.** Pin any result to a dashboard and compose a multi-tile view.
- **API surface.** Every query is also expressed as a versioned REST call
  (`POST /api/v1/query`) with request/response bodies — the integration surface
  a downstream service would consume.
- **Schema browser.** Explore the star schema (one fact table, four dimensions)
  with column types and descriptions.

## The data

A deterministic synthetic dataset modelling two years of B2B SaaS sales:

```
fact_sales (12,000 rows)  →  dim_date, dim_product, dim_region, dim_customer
```

Total revenue ≈ $72.8M. The generator embeds real, discoverable signals — a
~1.8%/month growth trend, a Q4 seasonal lift, and an Enterprise-segment skew —
so the analytics surface meaningful patterns rather than noise. Same seed every
load, so demos are reproducible.

## Architecture — why it works for everyone with no key

The product is **local-first by design**:

- **SQL execution** runs client-side via an in-browser SQL engine over the
  seeded star schema. Real joins, aggregates, `GROUP BY`, `ORDER BY` — no server
  round-trip, no database to provision.
- **Natural-language → SQL** has two paths. With no API key, a deterministic
  parser recognizes the measure (revenue / profit / units / orders…), the
  grouping dimension (region / category / segment / month…), and ordering, and
  assembles correct SQL. It also fuzzy-matches a curated question library. With
  an `ANTHROPIC_API_KEY` set, free-form questions are translated by the model,
  and the local parser remains the fallback if the model is unavailable.

This means the deployed demo is **fully functional for any visitor**, and the AI
path is a graceful enhancement rather than a hard dependency — the same reason
no secret is ever shipped in the bundle.



## Maps to the EBII charter

Enterprise BI and Integration delivers *self-service analytics, full-lifecycle
API management, and enterprise reporting/visualization.* MERIDIAN is the
self-service analytics + reporting pillar: NL and SQL querying, COTS-style
reporting and visualizations, and a REST API surface for every result.

## Tech

Next.js 14 (App Router) · TypeScript · Tailwind · in-browser SQL engine
(AlaSQL) · hand-rolled SVG charts (no charting library) · optional Anthropic SDK.

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000
```

Optional — enable free-form natural-language questions:

```bash
cp .env.example .env
# add ANTHROPIC_API_KEY=sk-ant-...
```

Verify the data + every curated query:

```bash
node test-queries.js
```

## Deploy

Push to GitHub and import into Vercel. No environment variables are required —
it works out of the box. Add `ANTHROPIC_API_KEY` in Vercel project settings only
if you want model-powered free-form questions.
