const Card = ({ title, value }: { title: string; value: string }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md flex flex-col items-start">
      <h3 className="text-gray-500 text-sm">{title}</h3>
      <p className="text-3xl font-semibold mt-2">{value}</p>
    </div>
  );
};

export default Card;