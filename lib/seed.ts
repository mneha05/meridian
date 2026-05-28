import type { Row } from "./types";

// Deterministic synthetic data generator for the enterprise star schema.
// Same seed → identical data every load, so demos are reproducible and the
// "ground truth" patterns (growth trend, Q4 seasonality, Enterprise skew) are stable.

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATEGORIES: Record<string, { subs: string[]; base: number }> = {
  "Cloud Platform": { subs: ["Compute", "Storage", "Networking"], base: 1200 },
  "Analytics Suite": { subs: ["BI", "Data Pipeline", "ML Ops"], base: 900 },
  "Security": { subs: ["Identity", "Threat Detection", "Compliance"], base: 1500 },
  "Developer Tools": { subs: ["CI/CD", "Monitoring", "APIs"], base: 600 },
  "Support Plans": { subs: ["Standard", "Premium", "Enterprise"], base: 400 },
};

const REGIONS = [
  { region: "Northeast", country: "USA", rep: "A. Whitfield" },
  { region: "Southeast", country: "USA", rep: "M. Okafor" },
  { region: "Midwest", country: "USA", rep: "J. Petrov" },
  { region: "West", country: "USA", rep: "S. Nakamura" },
  { region: "Pacific Northwest", country: "USA", rep: "L. Bergström" },
  { region: "Southwest", country: "USA", rep: "R. Delgado" },
  { region: "Ontario", country: "Canada", rep: "C. Tremblay" },
  { region: "British Columbia", country: "Canada", rep: "D. Singh" },
  { region: "Greater London", country: "UK", rep: "H. Patel" },
  { region: "Bavaria", country: "Germany", rep: "K. Müller" },
  { region: "Île-de-France", country: "France", rep: "É. Laurent" },
  { region: "New South Wales", country: "Australia", rep: "T. Williams" },
];

const SEGMENTS = ["Enterprise", "Mid-Market", "SMB"];
const SEGMENT_WEIGHT: Record<string, number> = { Enterprise: 3.4, "Mid-Market": 1.6, SMB: 0.7 };
const INDUSTRIES = [
  "Financial Services", "Healthcare", "Manufacturing", "Retail", "Technology",
  "Energy", "Public Sector", "Telecom", "Media", "Education",
];

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface SeededData {
  dim_date: Row[];
  dim_product: Row[];
  dim_region: Row[];
  dim_customer: Row[];
  fact_sales: Row[];
}

let _cache: SeededData | null = null;

export function getSeedData(): SeededData {
  if (_cache) return _cache;
  const rng = mulberry32(424242);

  // ── dim_date: 2 years daily ──────────────────────────────────────────────
  const dim_date: Row[] = [];
  const start = new Date(Date.UTC(2023, 0, 1));
  for (let i = 0; i < 730; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const dateKey = y * 10000 + (m + 1) * 100 + d.getUTCDate();
    dim_date.push({
      date_key: dateKey,
      date: d.toISOString().slice(0, 10),
      year: y,
      quarter: `Q${Math.floor(m / 3) + 1}`,
      month: m + 1,
      month_name: MONTH_NAMES[m],
      weekday: WEEKDAYS[d.getUTCDay()],
    });
  }

  // ── dim_product ───────────────────────────────────────────────────────────
  const dim_product: Row[] = [];
  let pid = 1;
  for (const [cat, info] of Object.entries(CATEGORIES)) {
    for (const sub of info.subs) {
      // 2-3 products per subcategory
      const n = 2 + Math.floor(rng() * 2);
      for (let k = 0; k < n; k++) {
        const price = Math.round((info.base * (0.6 + rng() * 0.9)) / 10) * 10;
        const cost = Math.round(price * (0.35 + rng() * 0.25));
        dim_product.push({
          product_id: pid,
          product_name: `${sub} ${["Core", "Plus", "Pro", "Edge", "Max"][k % 5]}`,
          category: cat,
          subcategory: sub,
          unit_price: price,
          unit_cost: cost,
        });
        pid++;
      }
    }
  }

  // ── dim_region ──────────────────────────────────────────────────────────
  const dim_region: Row[] = REGIONS.map((r, i) => ({
    region_id: i + 1,
    region: r.region,
    country: r.country,
    sales_rep: r.rep,
  }));

  // ── dim_customer ──────────────────────────────────────────────────────────
  const dim_customer: Row[] = [];
  const COMPANY_PREFIX = ["North", "Summit", "Vertex", "Apex", "Cobalt", "Helio", "Aster", "Orion", "Pioneer", "Meridian", "Crest", "Atlas", "Nova", "Quanta", "Lumen"];
  const COMPANY_SUFFIX = ["Systems", "Industries", "Holdings", "Labs", "Dynamics", "Group", "Networks", "Partners", "Logic", "Works"];
  for (let i = 1; i <= 300; i++) {
    const seg = SEGMENTS[weightedPick(rng, [0.22, 0.38, 0.40])];
    dim_customer.push({
      customer_id: i,
      customer_name: `${COMPANY_PREFIX[Math.floor(rng() * COMPANY_PREFIX.length)]} ${COMPANY_SUFFIX[Math.floor(rng() * COMPANY_SUFFIX.length)]}`,
      segment: seg,
      industry: INDUSTRIES[Math.floor(rng() * INDUSTRIES.length)],
    });
  }

  // ── fact_sales ──────────────────────────────────────────────────────────
  // Embed signal: month-over-month growth (~1.8%/mo), Q4 seasonal lift,
  // Enterprise segment buys larger quantities, Security category premium.
  const fact_sales: Row[] = [];
  let sid = 1;
  const N = 12000;
  for (let i = 0; i < N; i++) {
    const dateRow = dim_date[Math.floor(rng() * dim_date.length)];
    const product = dim_product[Math.floor(rng() * dim_product.length)];
    const region = dim_region[Math.floor(rng() * dim_region.length)];
    const customer = dim_customer[Math.floor(rng() * dim_customer.length)];

    const monthIdx =
      ((dateRow.year as number) - 2023) * 12 + ((dateRow.month as number) - 1);
    const growth = Math.pow(1.018, monthIdx); // compounding monthly growth
    const q4 = (dateRow.month as number) >= 10 ? 1.28 : 1.0; // seasonal lift
    const segMult = SEGMENT_WEIGHT[customer.segment as string];

    const baseQty = 1 + Math.floor(rng() * 6 * segMult);
    const quantity = Math.max(1, Math.round(baseQty * (0.7 + rng() * 0.6)));
    const discount = +(rng() < 0.4 ? rng() * 0.22 : 0).toFixed(3);
    const unitPrice = product.unit_price as number;
    const unitCost = product.unit_cost as number;
    const revenue = +(quantity * unitPrice * (1 - discount) * growth * q4).toFixed(2);
    const cost = +(quantity * unitCost * growth).toFixed(2);

    fact_sales.push({
      sale_id: sid++,
      date_key: dateRow.date_key as number,
      product_id: product.product_id as number,
      region_id: region.region_id as number,
      customer_id: customer.customer_id as number,
      quantity,
      revenue,
      cost,
      discount,
    });
  }

  _cache = { dim_date, dim_product, dim_region, dim_customer, fact_sales };
  return _cache;
}

function weightedPick(rng: () => number, weights: number[]): number {
  const r = rng();
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (r <= acc) return i;
  }
  return weights.length - 1;
}
