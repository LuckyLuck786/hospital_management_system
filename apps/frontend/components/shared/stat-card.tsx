import { LucideIcon } from 'lucide-react';

const colorMap: Record<string, string> = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
  teal: 'bg-teal-500',
  yellow: 'bg-yellow-500',
};

export function StatCard({
  label,
  value,
  icon: Icon,
  color = 'blue',
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  color?: string;
  hint?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 ${colorMap[color] || 'bg-blue-500'} rounded-lg flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 truncate">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
