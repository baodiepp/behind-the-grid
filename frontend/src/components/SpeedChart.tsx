import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import type { TelemetryRow } from "../types";

type Props = { data: TelemetryRow[] };
export default function SpeedChart({ data }: Props) {
  return (
    <div className="h-56 border rounded-xl p-3">
      <div className="text-sm font-medium mb-1">Speed (kph)</div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="ts" tickFormatter={(t) => (t as number).toFixed(1)} />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="speed" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
