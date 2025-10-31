import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import type { TelemetryRow } from "../types";

type Props = { data: TelemetryRow[] };
export default function PedalsChart({ data }: Props) {
  return (
    <div className="h-56 border rounded-xl p-3">
      <div className="text-sm font-medium mb-1">Throttle / Brake (%)</div>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="ts" tickFormatter={(t) => (t as number).toFixed(1)} />
          <YAxis domain={[0, 100]} />
          <Tooltip />
          <Area type="monotone" dataKey="throttle" fillOpacity={0.2} />
          <Area type="monotone" dataKey="brake" fillOpacity={0.2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
