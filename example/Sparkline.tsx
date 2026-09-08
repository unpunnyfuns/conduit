import { useFakeSeries } from "./useFakeSeries.js";

/** An inline sparkline with a live value: proves the slot, without picking a chart library. */
export const Sparkline = ({ source, unit }: { source: string; unit: string }) => {
  const series = useFakeSeries(source);
  const max = Math.max(...series, 1);
  const points = series
    .map((value, index) => `${(index / (series.length - 1)) * 100},${100 - (value / max) * 100}`)
    .join(" ");
  const last = series[series.length - 1] ?? 0;

  return (
    <div className="flex h-full flex-col gap-1">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="min-h-0 flex-1 w-full"
        aria-hidden
      >
        <polyline
          points={points}
          className="fill-none stroke-lens-positive stroke-[2]"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between font-mono text-[10px] text-lens-muted">
        <span>{source}</span>
        <span className="text-lens-fg">{`${Math.round(last * 120)} ${unit}`}</span>
      </div>
    </div>
  );
};
