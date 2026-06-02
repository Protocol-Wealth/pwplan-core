// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Protocol Wealth, LLC

/**
 * MatrixTable — a compact, read-only square-matrix renderer shared by the tools
 * that return a `Record<id, Record<id, number>>` (correlation matrices, the
 * regime transition matrix). Presentation only; no logic of substance.
 */

export function MatrixTable({
  ids,
  matrix,
  corner = "",
  caption,
  fractionDigits = 2,
  dimDiagonal = true,
}: {
  /** Row/column order; limited to ids the matrix actually carries. */
  ids: string[];
  matrix: Record<string, Record<string, number>>;
  /** Top-left corner label (e.g. "ρ"). */
  corner?: string;
  /** Screen-reader caption. */
  caption?: string;
  fractionDigits?: number;
  /** Dim the diagonal (true for correlations where it is trivially 1). */
  dimDiagonal?: boolean;
}) {
  const cols = ids.filter((id) => id && matrix[id]);
  if (cols.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse font-mono text-[0.6rem] tabular-nums text-stone-600">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            <th className="px-1.5 py-1 text-left font-normal text-stone-400">
              {corner}
            </th>
            {cols.map((id) => (
              <th
                key={id}
                scope="col"
                className="px-1.5 py-1 text-right font-normal text-stone-500"
              >
                {id}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cols.map((row) => (
            <tr key={row}>
              <th
                scope="row"
                className="px-1.5 py-1 text-left font-normal text-stone-500"
              >
                {row}
              </th>
              {cols.map((col) => {
                const v = matrix[row]?.[col];
                return (
                  <td
                    key={col}
                    className={`px-1.5 py-1 text-right ${
                      dimDiagonal && row === col
                        ? "text-stone-400"
                        : "text-stone-700"
                    }`}
                  >
                    {typeof v === "number" ? v.toFixed(fractionDigits) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
