import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Lap 1', speed: 290 },
  { name: 'Lap 2', speed: 300 },
  { name: 'Lap 3', speed: 310 },
  { name: 'Lap 4', speed: 305 },
];

const Chart = () => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">Average Speed per Lap</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis domain={[250, 320]} />
          <Tooltip />
          <Line type="monotone" dataKey="speed" stroke="#4F46E5" strokeWidth={3} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default Chart;
