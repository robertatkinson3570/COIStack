"use client";

import { useRef, useEffect } from "react";
import { useAiChat } from "@/hooks/use-ai-chat";
import { useUser } from "@/hooks/use-user";
import { AiChatSidebar } from "./ai-chat-sidebar";
import { AiChatMessage } from "./ai-chat-message";
import { AiChatInput } from "./ai-chat-input";
import { AiChatEmpty } from "./ai-chat-empty";
import { AiChatLocked } from "./ai-chat-locked";
import { AiChatUsage } from "./ai-chat-usage";
import { AiEscalateDialog } from "./ai-escalate-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export function AiChat() {
  const { org } = useUser();
  const chat = useAiChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Plan gating — Starter / trialing-starter users can't access AI chat
  const planTier = org?.plan_tier;
  const isLocked = !planTier || planTier === "starter";

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages]);

  async function handleSend(content: string) {
    try {
      await chat.sendMessage(content);
    } catch (err) {
      toast.error((err as Error).message || "Failed to send message");
    }
  }

  async function handleSelectQuestion(question: string) {
    // Create session if none is active, then send
    if (!chat.activeSessionId) {
      const session = await chat.createSession();
      if (!session) {
        toast.error("Failed to create conversation");
        return;
      }
      // Wait for state to settle then send — useEffect in sendMessage will pick up the new session
      // Instead, we'll call sendMessage after the state is set
      setTimeout(async () => {
        try {
          await chat.sendMessage(question);
        } catch (err) {
          toast.error((err as Error).message || "Failed to send message");
        }
      }, 100);
      return;
    }
    handleSend(question);
  }

  if (isLocked) {
    return <AiChatLocked />;
  }

  return (
    <div className="flex h-[600px] overflow-hidden rounded-lg border">
      {/* Sidebar */}
      <AiChatSidebar
        sessions={chat.sessions}
        activeSessionId={chat.activeSessionId}
        loading={chat.sessionsLoading}
        onSelect={(id) => chat.loadSession(id)}
        onCreate={async () => {
          await chat.createSession();
        }}
        onDelete={(id) => chat.deleteSession(id)}
      />

      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        {chat.activeSessionId && (
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="text-sm font-medium">
              {chat.sessions.find((s) => s.id === chat.activeSessionId)?.title ||
                "New conversation"}
            </span>
            <AiEscalateDialog
              onEscalate={chat.escalateToTicket}
              disabled={chat.messages.length === 0}
            />
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {!chat.activeSessionId ? (
            <AiChatEmpty onSelectQuestion={handleSelectQuestion} />
          ) : chat.loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="size-8 rounded-full" />
                  <Skeleton className="h-16 flex-1 rounded-lg" />
                </div>
              ))}
            </div>
          ) : chat.messages.length === 0 ? (
            <AiChatEmpty onSelectQuestion={handleSelectQuestion} />
          ) : (
            <div className="space-y-4">
              {chat.messages.map((msg, i) => (
                <AiChatMessage
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  isStreaming={
                    chat.streaming &&
                    i === chat.messages.length - 1 &&
                    msg.role === "assistant"
                  }
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Usage bar */}
        <AiChatUsage usage={chat.usage} />

        {/* Input */}
        {chat.activeSessionId && (
          <AiChatInput
            onSend={handleSend}
            onStop={chat.stopStreaming}
            streaming={chat.streaming}
            disabled={
              chat.usage !== null &&
              chat.usage.limit !== -1 &&
              chat.usage.used >= chat.usage.limit
            }
          />
        )}
      </div>
    </div>
  );
}
