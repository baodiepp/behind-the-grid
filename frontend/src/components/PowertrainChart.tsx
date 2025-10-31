import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import type { TelemetryRow } from "../types";

type Props = { data: TelemetryRow[] };
export default function PowertrainChart({ data }: Props) {
  return (
    <div className="h-56 border rounded-xl p-3">
      <div className="text-sm font-medium mb-1">RPM + Gear</div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="ts" tickFormatter={(t) => (t as number).toFixed(1)} />
          <YAxis yAxisId="rpm" />
          <YAxis yAxisId="gear" orientation="right" domain={[0, 9]} />
          <Tooltip />
          <Line yAxisId="rpm" type="monotone" dataKey="rpm" dot={false} />
          <Line yAxisId="gear" type="stepAfter" dataKey="gear" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
