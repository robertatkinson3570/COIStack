"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Share2, Copy, Check, Twitter, Linkedin } from "lucide-react";
import { toast } from "sonner";
import type { GraderGrade } from "@/lib/grader/types";

interface ShareResultsProps {
  grade: GraderGrade;
  passCount: number;
  total: number;
  token: string;
}

export function ShareResults({ grade, passCount, total, token }: ShareResultsProps) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(`${window.location.origin}/coi-grader/results/${token}`);
  }, [token]);

  const gradeLabel = grade === "COMPLIANT" ? "Compliant" : grade === "AT_RISK" ? "At Risk" : "Non-Compliant";
  const shareText = `My COI scored "${gradeLabel}" (${passCount}/${total} checks passed) on COIStack's free COI Grader!`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  }

  function shareTwitter() {
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
    window.open(tweetUrl, "_blank", "noopener,noreferrer");
  }

  function shareLinkedin() {
    const liUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    window.open(liUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      <span className="text-xs text-muted-foreground mr-1">
        <Share2 className="inline size-3 mr-1" />
        Share:
      </span>
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={copyLink}>
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </Button>
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={shareTwitter}>
        <Twitter className="size-3.5" />
      </Button>
      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={shareLinkedin}>
        <Linkedin className="size-3.5" />
      </Button>
    </div>
  );
}
