import type { GraderGrade } from "@/lib/grader/types";

interface BenchmarkBarProps {
  grade: GraderGrade;
}

const BENCHMARK_DATA: Record<GraderGrade, { percentile: number; description: string }> = {
  COMPLIANT: { percentile: 85, description: "Top 15% — meets all requirements" },
  AT_RISK: { percentile: 45, description: "Some issues to address before expiry" },
  NON_COMPLIANT: { percentile: 10, description: "Significant compliance gaps detected" },
};

const GRADE_COLORS: Record<GraderGrade, string> = {
  COMPLIANT: "bg-green-500",
  AT_RISK: "bg-yellow-500",
  NON_COMPLIANT: "bg-red-500",
};

const GRADE_LABELS: Record<GraderGrade, string> = {
  COMPLIANT: "Compliant",
  AT_RISK: "At Risk",
  NON_COMPLIANT: "Non-Compliant",
};

export function BenchmarkBar({ grade }: BenchmarkBarProps) {
  const data = BENCHMARK_DATA[grade];

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Industry Benchmark</span>
        <span className="text-muted-foreground">{data.description}</span>
      </div>
      <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${GRADE_COLORS[grade]}`}
          style={{ width: `${data.percentile}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Non-Compliant</span>
        <span className="font-medium text-foreground">{GRADE_LABELS[grade]}</span>
        <span>Compliant</span>
      </div>
    </div>
  );
}
