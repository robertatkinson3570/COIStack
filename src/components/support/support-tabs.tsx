"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, MessageSquare } from "lucide-react";
import { AiChat } from "./ai-chat";
import type { ReactNode } from "react";

interface SupportTabsProps {
  ticketsContent: ReactNode;
}

export function SupportTabs({ ticketsContent }: SupportTabsProps) {
  return (
    <Tabs defaultValue="ai" className="space-y-4" data-testid="support-tabs">
      <TabsList>
        <TabsTrigger value="ai" className="gap-2" data-testid="tab-ai">
          <Bot className="size-4" />
          AI Chat
        </TabsTrigger>
        <TabsTrigger value="tickets" className="gap-2" data-testid="tab-tickets">
          <MessageSquare className="size-4" />
          Tickets
        </TabsTrigger>
      </TabsList>
      <TabsContent value="ai">
        <AiChat />
      </TabsContent>
      <TabsContent value="tickets">{ticketsContent}</TabsContent>
    </Tabs>
  );
}
