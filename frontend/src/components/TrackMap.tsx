import type { TelemetryRow } from "../types";

type Props = { data: TelemetryRow[] };

export default function TrackMap({ data }: Props) {
  const pts = data.filter((d): d is TelemetryRow & { x: number; y: number } => d.x != null && d.y != null);
  if (!pts.length) return <div className="border rounded-xl p-3 text-sm text-gray-500">No XY telemetry for this session.</div>;

  // Normalize to viewBox
  const xs = pts.map(p => p.x);
  const ys = pts.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 10;
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;

  const path = pts.map(p => {
    const x = (p.x - minX) * (1000 / w);
    const y = (p.y - minY) * (600 / h);
    // flip y for SVG
    return `${x.toFixed(1)},${(600 - y).toFixed(1)}`;
  }).join(" ");

  return (
    <div className="h-[300px] border rounded-xl p-3">
      <div className="text-sm font-medium mb-1">Track Map (XY)</div>
      <svg viewBox={`-${pad} -${pad} ${1000 + 2*pad} ${600 + 2*pad}`} className="w-full h-[250px]">
        <polyline points={path} fill="none" stroke="currentColor" strokeWidth={2}/>
      </svg>
    </div>
  );
}
