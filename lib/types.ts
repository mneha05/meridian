export interface ColumnDef {
  name: string;
  type: "int" | "float" | "string" | "date" | "money";
  description: string;
}

export interface TableDef {
  name: string;
  kind: "fact" | "dimension";
  description: string;
  columns: ColumnDef[];
  rowCount: number;
}

export type Row = Record<string, string | number>;

export interface QueryResult {
  columns: string[];
  rows: Row[];
  sql: string;
  elapsedMs: number;
  rowCount: number;
}

export type ChartKind = "kpi" | "bar" | "line" | "area" | "donut" | "table";

export interface ChartSpec {
  kind: ChartKind;
  // column roles
  labelKey?: string;     // categorical / x axis
  valueKeys?: string[];  // numeric series
  title: string;
  reason: string;        // why this chart was chosen (transparency)
}

export interface SavedQuestion {
  id: string;
  label: string;
  category: string;
  sql: string;
}

export interface DashboardTile {
  id: string;
  title: string;
  sql: string;
  chart: ChartSpec;
  result: QueryResult;
}

export interface NlToSqlResponse {
  sql: string;
  source: "model" | "local";
  explanation?: string;
  matched?: string; // which local pattern matched
}
