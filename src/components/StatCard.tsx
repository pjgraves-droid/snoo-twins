interface StatCardProps {
  label: string;
  value: string;
  subtext?: string;
  color?: string;
}

export default function StatCard({ label, value, subtext, color = "blue" }: StatCardProps) {
  const borderColor = color === "blue" ? "border-blue-500/30" : "border-pink-500/30";
  const valueColor = color === "blue" ? "text-blue-400" : "text-pink-400";

  return (
    <div className={`bg-zinc-900/50 border ${borderColor} rounded-xl p-2.5 sm:p-4`}>
      <p className="text-zinc-500 text-[9px] sm:text-xs font-medium uppercase tracking-wider leading-tight">
        {label}
      </p>
      <p className={`text-lg sm:text-2xl font-bold ${valueColor} mt-0.5 sm:mt-1`}>{value}</p>
      {subtext && (
        <p className="text-zinc-500 text-[9px] sm:text-xs mt-0.5 sm:mt-1">{subtext}</p>
      )}
    </div>
  );
}
