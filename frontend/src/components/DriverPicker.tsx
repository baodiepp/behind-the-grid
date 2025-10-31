const CODES = [
  "VER","PER","LEC","SAI","HAM","RUS","NOR","PIA","ALO","STR",
  "GAS","OCO","ALB","SAR","HUL","MAG","BOT","ZHO","TSU","RIC"
];

type Props = { value: string; onChange: (c: string) => void };
export default function DriverPicker({ value, onChange }: Props) {
  return (
    <select
      className="border rounded-lg px-3 py-2 text-sm"
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {CODES.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}