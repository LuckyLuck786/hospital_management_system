import { cn } from '@/lib/utils';

const statusStyles: Record<string, string> = {
  // Appointments
  PENDING: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
  CONFIRMED: 'bg-blue-50 text-blue-700 ring-blue-200',
  IN_PROGRESS: 'bg-purple-50 text-purple-700 ring-purple-200',
  COMPLETED: 'bg-green-50 text-green-700 ring-green-200',
  CANCELLED: 'bg-red-50 text-red-700 ring-red-200',
  NO_SHOW: 'bg-gray-100 text-gray-600 ring-gray-200',
  EMERGENCY: 'bg-red-50 text-red-700 ring-red-300',
  // Invoices
  DRAFT: 'bg-gray-100 text-gray-600 ring-gray-200',
  FINALIZED: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  PAID: 'bg-green-50 text-green-700 ring-green-200',
  PARTIALLY_PAID: 'bg-amber-50 text-amber-700 ring-amber-200',
  OVERDUE: 'bg-red-50 text-red-700 ring-red-200',
  // Lab orders
  ORDERED: 'bg-blue-50 text-blue-700 ring-blue-200',
  SAMPLE_COLLECTED: 'bg-purple-50 text-purple-700 ring-purple-200',
  PROCESSING: 'bg-amber-50 text-amber-700 ring-amber-200',
  RESULT_UPLOADED: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  APPROVED: 'bg-green-50 text-green-700 ring-green-200',
  REJECTED: 'bg-red-50 text-red-700 ring-red-200',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset whitespace-nowrap',
        statusStyles[status] || 'bg-gray-100 text-gray-600 ring-gray-200',
        className,
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
