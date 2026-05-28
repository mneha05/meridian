// Verify the seed data and every curated SQL query against alasql (node build).
const alasql = require("alasql");

// Inline a CommonJS port of the seed generator (mirror of lib/seed.ts logic).
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const CATEGORIES = {
  "Cloud Platform": { subs: ["Compute", "Storage", "Networking"], base: 1200 },
  "Analytics Suite": { subs: ["BI", "Data Pipeline", "ML Ops"], base: 900 },
  "Security": { subs: ["Identity", "Threat Detection", "Compliance"], base: 1500 },
  "Developer Tools": { subs: ["CI/CD", "Monitoring", "APIs"], base: 600 },
  "Support Plans": { subs: ["Standard", "Premium", "Enterprise"], base: 400 },
};
const REGIONS = [
  ["Northeast","USA","A. Whitfield"],["Southeast","USA","M. Okafor"],["Midwest","USA","J. Petrov"],
  ["West","USA","S. Nakamura"],["Pacific Northwest","USA","L. Bergström"],["Southwest","USA","R. Delgado"],
  ["Ontario","Canada","C. Tremblay"],["British Columbia","Canada","D. Singh"],["Greater London","UK","H. Patel"],
  ["Bavaria","Germany","K. Müller"],["Île-de-France","France","É. Laurent"],["New South Wales","Australia","T. Williams"],
];
const SEGMENTS = ["Enterprise","Mid-Market","SMB"];
const SEGMENT_WEIGHT = { Enterprise: 3.4, "Mid-Market": 1.6, SMB: 0.7 };
const INDUSTRIES = ["Financial Services","Healthcare","Manufacturing","Retail","Technology","Energy","Public Sector","Telecom","Media","Education"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function weightedPick(rng, w){const r=rng();let a=0;for(let i=0;i<w.length;i++){a+=w[i];if(r<=a)return i;}return w.length-1;}

function seed() {
  const rng = mulberry32(424242);
  const dim_date = [];
  const start = Date.UTC(2023,0,1);
  for (let i=0;i<730;i++){const d=new Date(start+i*86400000);const y=d.getUTCFullYear();const m=d.getUTCMonth();
    dim_date.push({date_key:y*10000+(m+1)*100+d.getUTCDate(),date:d.toISOString().slice(0,10),year:y,quarter:`Q${Math.floor(m/3)+1}`,month:m+1,month_name:MONTH_NAMES[m],weekday:WEEKDAYS[d.getUTCDay()]});}
  const dim_product=[];let pid=1;
  for(const [cat,info] of Object.entries(CATEGORIES)){for(const sub of info.subs){const n=2+Math.floor(rng()*2);
    for(let k=0;k<n;k++){const price=Math.round((info.base*(0.6+rng()*0.9))/10)*10;const cost=Math.round(price*(0.35+rng()*0.25));
      dim_product.push({product_id:pid,product_name:`${sub} ${["Core","Plus","Pro","Edge","Max"][k%5]}`,category:cat,subcategory:sub,unit_price:price,unit_cost:cost});pid++;}}}
  const dim_region=REGIONS.map((r,i)=>({region_id:i+1,region:r[0],country:r[1],sales_rep:r[2]}));
  const dim_customer=[];const PRE=["North","Summit","Vertex","Apex","Cobalt","Helio","Aster","Orion","Pioneer","Meridian","Crest","Atlas","Nova","Quanta","Lumen"];const SUF=["Systems","Industries","Holdings","Labs","Dynamics","Group","Networks","Partners","Logic","Works"];
  for(let i=1;i<=300;i++){const seg=SEGMENTS[weightedPick(rng,[0.22,0.38,0.40])];
    dim_customer.push({customer_id:i,customer_name:`${PRE[Math.floor(rng()*PRE.length)]} ${SUF[Math.floor(rng()*SUF.length)]}`,segment:seg,industry:INDUSTRIES[Math.floor(rng()*INDUSTRIES.length)]});}
  const fact_sales=[];let sid=1;
  for(let i=0;i<12000;i++){const dr=dim_date[Math.floor(rng()*dim_date.length)];const p=dim_product[Math.floor(rng()*dim_product.length)];
    const rg=dim_region[Math.floor(rng()*dim_region.length)];const cu=dim_customer[Math.floor(rng()*dim_customer.length)];
    const monthIdx=(dr.year-2023)*12+(dr.month-1);const growth=Math.pow(1.018,monthIdx);const q4=dr.month>=10?1.28:1.0;const segMult=SEGMENT_WEIGHT[cu.segment];
    const baseQty=1+Math.floor(rng()*6*segMult);const quantity=Math.max(1,Math.round(baseQty*(0.7+rng()*0.6)));
    const discount=+(rng()<0.4?rng()*0.22:0).toFixed(3);
    const revenue=+(quantity*p.unit_price*(1-discount)*growth*q4).toFixed(2);const cost=+(quantity*p.unit_cost*growth).toFixed(2);
    fact_sales.push({sale_id:sid++,date_key:dr.date_key,product_id:p.product_id,region_id:rg.region_id,customer_id:cu.customer_id,quantity,revenue,cost,discount});}
  return {dim_date,dim_product,dim_region,dim_customer,fact_sales};
}

const data = seed();
for (const t of ["dim_date","dim_product","dim_region","dim_customer","fact_sales"]) {
  alasql(`CREATE TABLE ${t}`);
  alasql.tables[t].data = data[t];
}

console.log("Row counts:");
console.log("  fact_sales:", data.fact_sales.length, "| products:", data.dim_product.length, "| customers:", data.dim_customer.length, "| regions:", data.dim_region.length, "| dates:", data.dim_date.length);

// Load the curated SQL by reading questions.ts and extracting sql fields
const fs = require("fs");
const qsrc = fs.readFileSync("./lib/questions.ts", "utf8");
const sqlMatches = [...qsrc.matchAll(/sql:\s*`([\s\S]*?)`/g)].map((m) => m[1]);
const labelMatches = [...qsrc.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);

let pass = 0, fail = 0;
sqlMatches.forEach((sql, i) => {
  try {
    const rows = alasql(sql.replace(/;\s*$/, ""));
    const sample = rows[0] ? JSON.stringify(rows[0]) : "(empty)";
    console.log(`✓ [${labelMatches[i] || i}] → ${rows.length} rows | ${sample.slice(0, 90)}`);
    pass++;
  } catch (e) {
    console.log(`✗ [${labelMatches[i] || i}] FAILED: ${e.message}`);
    fail++;
  }
});
console.log(`\n${pass} passed, ${fail} failed`);

// Spot-check the embedded signals
const totalRev = alasql("SELECT ROUND(SUM(revenue)) AS r FROM fact_sales")[0].r;
const byMonth = alasql(`SELECT d.year AS y, d.month AS m, ROUND(SUM(f.revenue)) AS r FROM fact_sales f JOIN dim_date d ON f.date_key=d.date_key GROUP BY d.year,d.month ORDER BY d.year,d.month`);
const ent = alasql(`SELECT c.segment AS s, ROUND(SUM(f.revenue)) AS r FROM fact_sales f JOIN dim_customer c ON f.customer_id=c.customer_id GROUP BY c.segment ORDER BY r DESC`);
console.log("\nSignal checks:");
console.log("  total revenue:", totalRev.toLocaleString());
console.log("  first month:", byMonth[0].r.toLocaleString(), "→ last month:", byMonth[byMonth.length-1].r.toLocaleString(), "(growth trend expected)");
console.log("  top segment:", ent[0].s, "(Enterprise expected)");
