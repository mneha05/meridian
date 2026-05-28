"use client";

import React from "react";

const KEYWORDS = /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|JOIN|LEFT|RIGHT|INNER|ON|AS|AND|OR|NOT|LIMIT|DESC|ASC|HAVING|WITH|IN|BETWEEN|LIKE|DISTINCT|CASE|WHEN|THEN|ELSE|END)\b/gi;
const FUNCS = /\b(SUM|COUNT|AVG|MIN|MAX|ROUND|ABS|COALESCE|CAST)\b/gi;

export default function SqlHighlight({ sql }: { sql: string }) {
  // Tokenize lightly: split on strings/numbers/words and color
  const lines = sql.split("\n");
  return (
    <pre className="mono text-[12.5px] leading-relaxed overflow-x-auto m-0" style={{ color: "#E6E9EF" }}>
      {lines.map((line, i) => (
        <div key={i}>{highlight(line)}</div>
      ))}
    </pre>
  );
}

function highlight(line: string): React.ReactNode[] {
  // Split into tokens preserving delimiters
  const parts = line.split(/(\s+|,|\(|\)|'[^']*'|\b\d+\.?\d*\b)/g).filter((p) => p !== "");
  return parts.map((tok, i) => {
    if (/^'[^']*'$/.test(tok)) return <span key={i} className="sql-str">{tok}</span>;
    if (/^\d+\.?\d*$/.test(tok)) return <span key={i} className="sql-num">{tok}</span>;
    if (tok === "," || tok === "(" || tok === ")") return <span key={i} className="sql-punc">{tok}</span>;
    if (KEYWORDS.test(tok)) { KEYWORDS.lastIndex = 0; return <span key={i} className="sql-kw">{tok}</span>; }
    if (FUNCS.test(tok)) { FUNCS.lastIndex = 0; return <span key={i} className="sql-fn">{tok}</span>; }
    return <span key={i}>{tok}</span>;
  });
}
