"use client";

import { Progress } from "@/components/ui/progress";
import type { AiUsage } from "@/hooks/use-ai-chat";

interface AiChatUsageProps {
  usage: AiUsage | null;
}

export function AiChatUsage({ usage }: AiChatUsageProps) {
  if (!usage) return null;

  const isUnlimited = usage.limit === -1;
  const percent = isUnlimited ? 0 : Math.min((usage.used / usage.limit) * 100, 100);
  const isNearLimit = !isUnlimited && usage.used >= usage.limit * 0.8;

  return (
    <div className="border-t px-3 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {isUnlimited
            ? `${usage.used} messages today`
            : `${usage.used} / ${usage.limit} messages today`}
        </span>
        <span className="capitalize">{usage.plan} plan</span>
      </div>
      {!isUnlimited && (
        <Progress
          value={percent}
          className={`mt-1 h-1.5 ${isNearLimit ? "[&>div]:bg-destructive" : ""}`}
        />
      )}
    </div>
  );
}
