import React, { useEffect, useRef } from "react";
import { ChatMessageList } from "@/features/chat/ChatMessageList";
import { PromptInput } from "@/components/PromptInput";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useChatPanel } from "./useChatPanel";
import type { NovidadeMessage } from "@/lib/novidadeApi";

type Props = {
  initialMessages: NovidadeMessage[];
  initialProjectId: string | null;
  onProjectIdChange?: (id: string) => void;
  autoSendText?: string | null;
  autoSendImage?: string | null;
  onAutoSendConsumed?: () => void;
};

export function ChatPanel({
  initialMessages,
  initialProjectId,
  onProjectIdChange,
  autoSendText,
  autoSendImage,
  onAutoSendConsumed,
}: Props) {
  const chat = useChatPanel(initialMessages, initialProjectId, onProjectIdChange);
  const lastAutoSentRef = useRef<string | null>(null);

  useEffect(() => {
    if (chat.projectId) {
      onProjectIdChange?.(chat.projectId);
    }
  }, [chat.projectId, onProjectIdChange]);

  useEffect(() => {
    const text = (autoSendText || "").trim();
    if (!text) return;
    if (chat.isLoading) return;
    if (lastAutoSentRef.current === text) return;

    lastAutoSentRef.current = text;

    void chat.send(autoSendImage || undefined, text).finally(() => {
      onAutoSendConsumed?.();
    });
  }, [autoSendImage, autoSendText, chat, onAutoSendConsumed]);

  return (
    <>
      <div className="flex h-full flex-col gap-2">
        <ChatMessageList
          messages={chat.messages}
          isBotThinking={chat.isBotThinking}
          sessionLoading={false}
          status={chat.status}
        />

        <PromptInput
          onSendMessage={({ content: { text, image } }) => {
            chat.setInput(text);
            void chat.send(image, text);
          }}
          generating={chat.isLoading}
          onError={chat.clearError}
          input={chat.input}
          handleInputChange={chat.handleInputChange}
          setInput={chat.setInput}
          stop={chat.stop}
          onAttachments={(files) => chat.setAttachments(files)}
        />

        {chat.error && <p className="mt-1 text-sm text-destructive">{chat.error}</p>}
      </div>

      <Dialog open={chat.creditModalOpen} onOpenChange={chat.closeCreditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insufficient Credits</DialogTitle>
            <DialogDescription>You have run out of credits. Purchase more to continue chatting.</DialogDescription>
            <DialogDescription>10 credits for $5 USD.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-center">
            <Button size="lg" onClick={() => window.open("https://buy.stripe.com/7sI9Bi6wP9O13NScMO", "_blank")}>
              Purchase Credits
            </Button>
          </div>
          <DialogFooter>
            <div className="text-xs text-muted-foreground">Payments processed by Stripe. Credits added automatically.</div>
            <Button variant="ghost" onClick={chat.closeCreditModal}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
