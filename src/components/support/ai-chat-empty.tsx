"use client";

import { Bot } from "lucide-react";
import { SuggestedQuestions } from "./suggested-questions";

interface AiChatEmptyProps {
  onSelectQuestion: (question: string) => void;
}

export function AiChatEmpty({ onSelectQuestion }: AiChatEmptyProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <div className="rounded-full bg-primary/10 p-4">
        <Bot className="size-8 text-primary" />
      </div>
      <div className="text-center">
        <h3 className="font-serif text-lg font-semibold">COIStack AI Support</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Ask me anything about COIStack, COI compliance, or insurance concepts.
          I&apos;m here to help you get the most out of the platform.
        </p>
      </div>
      <div className="w-full max-w-lg">
        <SuggestedQuestions onSelect={onSelectQuestion} />
      </div>
    </div>
  );
}
