import type { SavedQuestion } from "./types";

// Curated question library. Every entry has hand-verified SQL that runs against
// the seeded star schema. These power the suggested-questions UI and the
// deterministic NL fallback, so the product is fully functional with no API key.

export const QUESTIONS: SavedQuestion[] = [
  {
    id: "rev-by-region",
    label: "Total revenue by region",
    category: "Revenue",
    sql: `SELECT r.region AS region, ROUND(SUM(f.revenue)) AS revenue
FROM fact_sales f JOIN dim_region r ON f.region_id = r.region_id
GROUP BY r.region ORDER BY revenue DESC`,
  },
  {
    id: "rev-trend",
    label: "Monthly revenue trend",
    category: "Trends",
    sql: `SELECT d.year AS year, d.month AS month, d.month_name AS month_name,
       ROUND(SUM(f.revenue)) AS revenue
FROM fact_sales f JOIN dim_date d ON f.date_key = d.date_key
GROUP BY d.year, d.month, d.month_name
ORDER BY d.year, d.month`,
  },
  {
    id: "top-products",
    label: "Top 10 products by revenue",
    category: "Products",
    sql: `SELECT p.product_name AS product, ROUND(SUM(f.revenue)) AS revenue
FROM fact_sales f JOIN dim_product p ON f.product_id = p.product_id
GROUP BY p.product_name ORDER BY revenue DESC LIMIT 10`,
  },
  {
    id: "rev-by-segment",
    label: "Revenue by customer segment",
    category: "Customers",
    sql: `SELECT c.segment AS segment, ROUND(SUM(f.revenue)) AS revenue
FROM fact_sales f JOIN dim_customer c ON f.customer_id = c.customer_id
GROUP BY c.segment ORDER BY revenue DESC`,
  },
  {
    id: "rev-by-category",
    label: "Revenue by product category",
    category: "Products",
    sql: `SELECT p.category AS category, ROUND(SUM(f.revenue)) AS revenue
FROM fact_sales f JOIN dim_product p ON f.product_id = p.product_id
GROUP BY p.category ORDER BY revenue DESC`,
  },
  {
    id: "margin-by-category",
    label: "Profit margin by category",
    category: "Profitability",
    sql: `SELECT p.category AS category,
       ROUND(SUM(f.revenue)) AS revenue,
       ROUND(SUM(f.revenue) - SUM(f.cost)) AS profit,
       ROUND(100.0 * (SUM(f.revenue) - SUM(f.cost)) / SUM(f.revenue), 1) AS margin_pct
FROM fact_sales f JOIN dim_product p ON f.product_id = p.product_id
GROUP BY p.category ORDER BY profit DESC`,
  },
  {
    id: "total-revenue",
    label: "Total company revenue",
    category: "Revenue",
    sql: `SELECT ROUND(SUM(revenue)) AS total_revenue FROM fact_sales`,
  },
  {
    id: "rev-by-country",
    label: "Revenue by country",
    category: "Revenue",
    sql: `SELECT r.country AS country, ROUND(SUM(f.revenue)) AS revenue
FROM fact_sales f JOIN dim_region r ON f.region_id = r.region_id
GROUP BY r.country ORDER BY revenue DESC`,
  },
  {
    id: "top-reps",
    label: "Top sales reps by revenue",
    category: "Sales Team",
    sql: `SELECT r.sales_rep AS sales_rep, ROUND(SUM(f.revenue)) AS revenue
FROM fact_sales f JOIN dim_region r ON f.region_id = r.region_id
GROUP BY r.sales_rep ORDER BY revenue DESC LIMIT 10`,
  },
  {
    id: "rev-by-industry",
    label: "Revenue by industry",
    category: "Customers",
    sql: `SELECT c.industry AS industry, ROUND(SUM(f.revenue)) AS revenue
FROM fact_sales f JOIN dim_customer c ON f.customer_id = c.customer_id
GROUP BY c.industry ORDER BY revenue DESC`,
  },
  {
    id: "quarterly-revenue",
    label: "Revenue by quarter",
    category: "Trends",
    sql: `SELECT d.year AS year, d.quarter AS quarter, ROUND(SUM(f.revenue)) AS revenue
FROM fact_sales f JOIN dim_date d ON f.date_key = d.date_key
GROUP BY d.year, d.quarter ORDER BY d.year, d.quarter`,
  },
  {
    id: "units-by-category",
    label: "Units sold by category",
    category: "Products",
    sql: `SELECT p.category AS category, SUM(f.quantity) AS units
FROM fact_sales f JOIN dim_product p ON f.product_id = p.product_id
GROUP BY p.category ORDER BY units DESC`,
  },
];

export function questionsByCategory(): Record<string, SavedQuestion[]> {
  const out: Record<string, SavedQuestion[]> = {};
  for (const q of QUESTIONS) {
    (out[q.category] ??= []).push(q);
  }
  return out;
}
