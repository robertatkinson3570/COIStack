"use client";

import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function AiChatLocked() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="rounded-full bg-muted p-4">
        <Lock className="size-8 text-muted-foreground" />
      </div>
      <div>
        <h3 className="font-serif text-lg font-semibold">AI Helpdesk</h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">
          AI-powered support is available on Growth plans and above. Upgrade to
          get instant answers about COIStack and insurance compliance.
        </p>
      </div>
      <Button asChild>
        <Link href="/settings/billing">Upgrade Plan</Link>
      </Button>
    </div>
  );
}
