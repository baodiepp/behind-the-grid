import { FaTachometerAlt, FaCar, FaChartLine } from 'react-icons/fa';

const Sidebar = () => {
  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col p-6">
      <h1 className="text-2xl font-bold mb-10 tracking-tight">Telemetry Dash</h1>
      <nav className="space-y-3 text-gray-300">
        <a href="/" className="flex items-center gap-3 hover:bg-gray-800 hover:text-white p-2 rounded-md transition">
          <FaTachometerAlt /> Dashboard
        </a>
        <a href="/laps" className="flex items-center gap-3 hover:bg-gray-800 hover:text-white p-2 rounded-md transition">
          <FaCar /> Laps
        </a>
        <a href="/telemetry" className="flex items-center gap-3 hover:bg-gray-800 hover:text-white p-2 rounded-md transition">
          <FaChartLine /> Telemetry
        </a>
      </nav>
    </aside>
  );
};

export default Sidebar;
