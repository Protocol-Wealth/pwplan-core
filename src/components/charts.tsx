/**
 * charts — shared, dependency-free chart components built on the pure geometry
 * helpers in results-viz.ts. Presentation only; no quant logic. Hand-rolled SVG
 * keeps the bundle lean (no chart library), per CLAUDE.md.
 */

import { seriesGeometry } from "./results-viz";

export function ChartHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-stone-500">
      {children}
    </h3>
  );
}

/**
 * A line + faint area chart for a numeric series. `forcedMax` pins the top of
 * the Y domain (e.g. 1 for a 0–1 weight); omit it to scale to the data's max.
 * `footer` renders up to three small labels (left / center / right) beneath.
 */
export function LineChart({
  values,
  ariaLabel,
  footer,
  forcedMax,
}: {
  values: number[];
  ariaLabel: string;
  footer?: { left?: string; center?: string; right?: string };
  forcedMax?: number;
}) {
  if (values.length === 0) return null;

  const W = 300;
  const H = 120;
  const geo = seriesGeometry(values, W, H, forcedMax);

  return (
    <div className="border border-stone-200 p-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
      >
        <path d={geo.areaPath} fill="#1c1917" fillOpacity={0.06} />
        <polyline
          points={geo.polyline}
          fill="none"
          stroke="#1c1917"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {footer && (
        <div className="mt-2 flex justify-between font-mono text-[0.6rem] tabular-nums text-stone-400">
          <span>{footer.left}</span>
          <span>{footer.center}</span>
          <span>{footer.right}</span>
        </div>
      )}
    </div>
  );
}
