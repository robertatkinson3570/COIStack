"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AiUsage {
  used: number;
  limit: number; // -1 means unlimited
  plan: string;
}

export function useAiChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  // Load sessions
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch("/api/support/ai/sessions");
      if (res.ok) {
        const json = await res.json();
        setSessions(json.data || []);
      }
    } catch {
      /* ignore */
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  // Load usage
  const loadUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/support/ai/usage");
      if (res.ok) {
        const json = await res.json();
        setUsage(json);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Load session messages
  const loadSession = useCallback(async (sessionId: string) => {
    setLoading(true);
    setActiveSessionId(sessionId);
    try {
      const res = await fetch(`/api/support/ai/sessions/${sessionId}`);
      if (res.ok) {
        const json = await res.json();
        setMessages(
          (json.data?.messages || []).map((m: ChatMessage) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            created_at: m.created_at,
          }))
        );
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  // Create new session
  const createSession = useCallback(async () => {
    try {
      const res = await fetch("/api/support/ai/sessions", { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        const newSession = json.data as ChatSession;
        setSessions((prev) => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
        setMessages([]);
        return newSession;
      }
    } catch {
      /* ignore */
    }
    return null;
  }, []);

  // Delete session
  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        const res = await fetch(`/api/support/ai/sessions/${sessionId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setSessions((prev) => prev.filter((s) => s.id !== sessionId));
          if (activeSessionId === sessionId) {
            setActiveSessionId(null);
            setMessages([]);
          }
        }
      } catch {
        /* ignore */
      }
    },
    [activeSessionId]
  );

  // Send message with streaming
  const sendMessage = useCallback(
    async (content: string) => {
      if (!activeSessionId || streaming) return;

      // Optimistic user message
      const userMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: "user",
        content,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Placeholder for assistant response
      const assistantMsg: ChatMessage = {
        id: `temp-assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/support/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: activeSessionId, message: content }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || "Failed to send message");
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;

            try {
              const parsed = JSON.parse(payload);
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.text) {
                accumulated += parsed.text;
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last.role === "assistant") {
                    updated[updated.length - 1] = { ...last, content: accumulated };
                  }
                  return updated;
                });
              }
            } catch {
              /* skip malformed chunks */
            }
          }
        }

        // Update session title in sidebar if it was auto-titled
        loadSessions();
        loadUsage();
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        // Remove the empty assistant message on error
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last.role === "assistant" && !last.content) {
            return prev.slice(0, -1);
          }
          return prev;
        });
        throw err;
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [activeSessionId, streaming, loadSessions, loadUsage]
  );

  // Stop streaming
  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  // Escalate to ticket
  const escalateToTicket = useCallback(
    async (subject: string, priority: string) => {
      if (!activeSessionId) return null;
      try {
        const res = await fetch("/api/support/ai/escalate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: activeSessionId, subject, priority }),
        });
        if (res.ok) {
          const json = await res.json();
          return json.data?.ticketId || null;
        }
      } catch {
        /* ignore */
      }
      return null;
    },
    [activeSessionId]
  );

  // Load sessions and usage on mount
  useEffect(() => {
    loadSessions();
    loadUsage();
  }, [loadSessions, loadUsage]);

  return {
    sessions,
    activeSessionId,
    messages,
    usage,
    loading,
    streaming,
    sessionsLoading,
    loadSession,
    createSession,
    deleteSession,
    sendMessage,
    stopStreaming,
    escalateToTicket,
    loadUsage,
  };
}
