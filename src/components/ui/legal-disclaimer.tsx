import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface LegalDisclaimerProps {
  variant: "compliance" | "extraction";
  className?: string;
}

const messages: Record<string, string> = {
  compliance:
    "Compliance scores are informational and do not constitute legal or insurance advice. Always verify coverage with your insurance broker or legal counsel.",
  extraction:
    "AI-extracted data should be verified against the original document. COIStack is not liable for extraction inaccuracies.",
};

export function LegalDisclaimer({ variant, className }: LegalDisclaimerProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border border-muted bg-muted/30 px-3 py-2 text-xs text-muted-foreground",
        className
      )}
    >
      <Info className="mt-0.5 size-3.5 shrink-0" />
      <p>{messages[variant]}</p>
    </div>
  );
}
