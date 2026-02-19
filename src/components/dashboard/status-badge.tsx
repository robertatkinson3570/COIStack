import { Badge } from '@/components/ui/badge';

const statusConfig: Record<string, { label: string; className: string }> = {
  green: { label: 'GREEN', className: 'bg-green-500 hover:bg-green-500 text-white border-transparent' },
  yellow: { label: 'YELLOW', className: 'bg-yellow-500 hover:bg-yellow-500 text-white border-transparent' },
  red: { label: 'RED', className: 'bg-red-500 hover:bg-red-500 text-white border-transparent' },
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.red;
  return <Badge className={config.className}>{config.label}</Badge>;
}
