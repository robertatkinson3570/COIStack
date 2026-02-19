"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function ComplianceSummary() {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function generateSummary() {
    setLoading(true);
    try {
      const res = await fetch("/api/compliance/summary");
      if (!res.ok) throw new Error("Failed to generate summary");
      const data = await res.json();
      setSummary(data.summary);
    } catch {
      toast.error("Failed to generate compliance summary");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" />
          AI Compliance Summary
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={generateSummary}
          disabled={loading}
          className="h-7"
        >
          <RefreshCw className={`size-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          {summary ? "Refresh" : "Generate"}
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : summary ? (
          <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Click &quot;Generate&quot; to get an AI-powered summary of your portfolio&apos;s compliance status.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
