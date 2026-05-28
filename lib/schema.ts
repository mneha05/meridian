import type { TableDef } from "./types";

// A classic enterprise retail/SaaS star schema. One fact table, four dimensions.
// This is what the schema browser renders and what the NL->SQL layer is told about.

export const SCHEMA: TableDef[] = [
  {
    name: "fact_sales",
    kind: "fact",
    description: "One row per line item on an order. Grain: order line.",
    rowCount: 12000,
    columns: [
      { name: "sale_id", type: "int", description: "Surrogate key for the order line" },
      { name: "date_key", type: "int", description: "FK → dim_date.date_key (YYYYMMDD)" },
      { name: "product_id", type: "int", description: "FK → dim_product.product_id" },
      { name: "region_id", type: "int", description: "FK → dim_region.region_id" },
      { name: "customer_id", type: "int", description: "FK → dim_customer.customer_id" },
      { name: "quantity", type: "int", description: "Units sold on this line" },
      { name: "revenue", type: "money", description: "Gross revenue for the line (USD)" },
      { name: "cost", type: "money", description: "Total cost of goods for the line (USD)" },
      { name: "discount", type: "float", description: "Discount fraction applied (0–1)" },
    ],
  },
  {
    name: "dim_date",
    kind: "dimension",
    description: "Calendar dimension, daily grain across the observation window.",
    rowCount: 730,
    columns: [
      { name: "date_key", type: "int", description: "YYYYMMDD primary key" },
      { name: "date", type: "date", description: "ISO date" },
      { name: "year", type: "int", description: "Calendar year" },
      { name: "quarter", type: "string", description: "Q1–Q4" },
      { name: "month", type: "int", description: "Month number 1–12" },
      { name: "month_name", type: "string", description: "Jan–Dec" },
      { name: "weekday", type: "string", description: "Mon–Sun" },
    ],
  },
  {
    name: "dim_product",
    kind: "dimension",
    description: "Product catalog with category hierarchy and pricing.",
    rowCount: 40,
    columns: [
      { name: "product_id", type: "int", description: "Primary key" },
      { name: "product_name", type: "string", description: "Display name" },
      { name: "category", type: "string", description: "Top-level category" },
      { name: "subcategory", type: "string", description: "Second-level category" },
      { name: "unit_price", type: "money", description: "List price per unit (USD)" },
      { name: "unit_cost", type: "money", description: "Unit cost of goods (USD)" },
    ],
  },
  {
    name: "dim_region",
    kind: "dimension",
    description: "Sales territory hierarchy.",
    rowCount: 12,
    columns: [
      { name: "region_id", type: "int", description: "Primary key" },
      { name: "region", type: "string", description: "Region name" },
      { name: "country", type: "string", description: "Country" },
      { name: "sales_rep", type: "string", description: "Assigned account executive" },
    ],
  },
  {
    name: "dim_customer",
    kind: "dimension",
    description: "Customer master with segment and industry.",
    rowCount: 300,
    columns: [
      { name: "customer_id", type: "int", description: "Primary key" },
      { name: "customer_name", type: "string", description: "Account name" },
      { name: "segment", type: "string", description: "Enterprise / Mid-Market / SMB" },
      { name: "industry", type: "string", description: "Industry vertical" },
    ],
  },
];

// Compact schema string for the NL->SQL model prompt.
export function schemaForPrompt(): string {
  return SCHEMA.map((t) => {
    const cols = t.columns.map((c) => `${c.name} ${c.type}`).join(", ");
    return `${t.name} (${cols})`;
  }).join("\n");
}
