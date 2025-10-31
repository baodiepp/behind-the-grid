import type { LapRow } from "../types";

type Props = {
  laps: LapRow[];
  activeLap?: number | null;
  referenceLap?: number | null;
  onPick: (lap: number | null) => void;
  onReference?: (lap: number) => void;
};

export default function LapTable({ laps, activeLap, referenceLap, onPick, onReference }: Props) {
  return (
    <div className="overflow-auto h-64 border rounded-xl">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-gray-50">
          <tr>
            <th className="text-left p-2">Lap</th>
            <th className="text-right p-2">Lap Time (ms)</th>
            <th className="text-right p-2">S1</th>
            <th className="text-right p-2">S2</th>
            <th className="text-right p-2">S3</th>
            <th className="text-center p-2">Cmpd</th>
            <th className="text-center p-2">Pit</th>
            <th className="text-center p-2">Ref</th>
          </tr>
        </thead>
        <tbody>
          {laps.map(r => {
            const sel = activeLap === r.lap;
            const isRef = referenceLap === r.lap;
            const lapLabel = `${r.lap}${r.is_best ? " ★" : ""}`;
            return (
              <tr
                key={r.lap}
                onClick={() => onPick(sel ? null : r.lap)}
                className={`cursor-pointer hover:bg-gray-50 ${sel ? "bg-indigo-50" : ""}`}
              >
                <td className={`p-2 ${isRef ? "font-semibold text-indigo-600" : ""}`}>{lapLabel}</td>
                <td className="p-2 text-right tabular-nums">{r.lap_ms}</td>
                <td className="p-2 text-right tabular-nums">{r.s1}</td>
                <td className="p-2 text-right tabular-nums">{r.s2}</td>
                <td className="p-2 text-right tabular-nums">{r.s3}</td>
                <td className="p-2 text-center">{r.compound ?? "-"}</td>
                <td className="p-2 text-center">{r.is_pit ? "🅿︎" : ""}</td>
                <td className="p-2 text-center">
                  {onReference && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onReference(r.lap);
                      }}
                      className={`text-xs font-medium ${isRef ? "text-slate-400" : "text-indigo-500 hover:text-indigo-600"}`}
                      disabled={isRef}
                    >
                      {isRef ? "Active" : "Set"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
