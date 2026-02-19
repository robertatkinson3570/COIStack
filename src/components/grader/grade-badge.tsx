'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, AlertTriangle, XCircle } from 'lucide-react';
import type { GraderGrade } from '@/lib/grader/types';
import { cn } from '@/lib/utils';

const gradeConfig: Record<
  GraderGrade,
  { label: string; icon: typeof ShieldCheck; bg: string; text: string; ring: string }
> = {
  COMPLIANT: {
    label: 'Compliant',
    icon: ShieldCheck,
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-400',
    ring: 'ring-green-200 dark:ring-green-800',
  },
  AT_RISK: {
    label: 'At Risk',
    icon: AlertTriangle,
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-400',
    ring: 'ring-yellow-200 dark:ring-yellow-800',
  },
  NON_COMPLIANT: {
    label: 'Non-Compliant',
    icon: XCircle,
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
    ring: 'ring-red-200 dark:ring-red-800',
  },
};

interface GradeBadgeProps {
  grade: GraderGrade;
  className?: string;
}

export function GradeBadge({ grade, className }: GradeBadgeProps) {
  const config = gradeConfig[grade];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className={cn(
        'inline-flex items-center gap-3 rounded-2xl px-6 py-4 ring-2',
        config.bg,
        config.ring,
        className
      )}
    >
      <Icon className={cn('size-8', config.text)} />
      <span className={cn('font-serif text-2xl font-semibold', config.text)}>
        {config.label}
      </span>
    </motion.div>
  );
}
