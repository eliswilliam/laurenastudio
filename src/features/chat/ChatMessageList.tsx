import React, { memo } from "react";
import { cn } from "@/lib/utils";
import { ChatBubble } from "@/features/chat/message/ChatBubble";
import type { NovidadeMessage } from "@/lib/novidadeApi";

interface Props {
  messages: NovidadeMessage[];
  isBotThinking: boolean;
  sessionLoading: boolean;
  status: "idle" | "submitting" | "submitted" | "streaming";
}

export const ChatMessageList = memo(function ChatMessageList({
  messages,
  isBotThinking,
  sessionLoading,
  status,
}: Props) {
  const sorted = React.useMemo(
    () =>
      [...messages].sort(
        (a, b) =>
          new Date(a.createdAt ?? 0).getTime() -
          new Date(b.createdAt ?? 0).getTime()
      ),
    [messages]
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/80">
      {sessionLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-[1px]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {sorted.map((msg) => {
          return (
            <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[92%] rounded-xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border/70 bg-background text-foreground"
                )}
              >
                {msg.role === "assistant" ? (
                  <ChatBubble raw={msg.content || ""} />
                ) : (
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                )}
              </div>
            </div>
          );
        })}

        {isBotThinking && (
          <div className="px-1 text-xs text-muted-foreground">
            {status === "streaming" ? "gerando resposta..." : "preparando resposta..."}
          </div>
        )}
      </div>
    </div>
  );
});
