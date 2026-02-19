"use client";

import { MessageSquare } from "lucide-react";

const SUGGESTED_QUESTIONS = [
  "How do I upload a COI?",
  "What does a RED compliance status mean?",
  "How do I invite a team member?",
  "What is Additional Insured vs Certificate Holder?",
  "How do I set up compliance templates?",
  "How do I export an audit report?",
];

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
}

export function SuggestedQuestions({ onSelect }: SuggestedQuestionsProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {SUGGESTED_QUESTIONS.map((q) => (
        <button
          key={q}
          onClick={() => onSelect(q)}
          className="flex items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted"
        >
          <MessageSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>{q}</span>
        </button>
      ))}
    </div>
  );
}
