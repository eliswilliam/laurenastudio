import { useCallback, useMemo, useRef, useState } from "react";
import { processResponse } from "@/features/chat/responseProcessor";
import {
  saveNovidadeChat,
  streamGenerateCode,
  type NovidadeAttachment,
  type NovidadeMessage,
  uploadNovidadeImage,
} from "@/lib/novidadeApi";
import { useFileManager } from "@/vfs/manager";
import i18n from "@/i18n";

export interface UseChatPanel {
  messages: NovidadeMessage[];
  input: string;
  status: "idle" | "submitting" | "submitted" | "streaming";
  isBotThinking: boolean;
  isLoading: boolean;
  credits: number;
  error: string | null;
  attachments: FileList | undefined;
  projectId: string | null;
  setInput: (t: string) => void;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  send: (imageUrl?: string, textOverride?: string) => Promise<void>;
  stop: () => void;
  setAttachments: (f: FileList | undefined) => void;
  clearError: () => void;
  closeCreditModal: () => void;
  creditModalOpen: boolean;
}

const ID = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

async function dataUrlToFile(dataUrl: string): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const ext = (blob.type.split("/")[1] || "png").toLowerCase();
  return new File([blob], `novidade-upload-${Date.now()}.${ext}`, { type: blob.type || "image/png" });
}

export function useChatPanel(
  initialMessages: NovidadeMessage[],
  initialProjectId: string | null,
  onProjectIdChange?: (id: string) => void
): UseChatPanel {
  const { files, extractCodebase, createFilesBulk } = useFileManager();

  const [messages, setMessages] = useState<NovidadeMessage[]>(initialMessages);
  const [projectId, setProjectId] = useState<string | null>(initialProjectId);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted" | "streaming">("idle");
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<FileList | undefined>(undefined);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const streamApplyRef = useRef<{ signature: string; lastAt: number }>({ signature: "", lastAt: 0 });

  const send = useCallback(
    async (imageUrl?: string, textOverride?: string) => {
      const text = (textOverride ?? input).trim();

      const attachmentFiles = Array.from(attachments ?? []).filter((file) => file.type.startsWith("image/"));
      const uploadedAttachments: NovidadeAttachment[] = [];

      if (attachmentFiles.length > 0) {
        for (const file of attachmentFiles.slice(0, 6)) {
          uploadedAttachments.push(await uploadNovidadeImage(file));
        }
      } else if (imageUrl?.startsWith("data:image/")) {
        const imageFile = await dataUrlToFile(imageUrl);
        uploadedAttachments.push(await uploadNovidadeImage(imageFile));
      } else if (imageUrl?.startsWith("/uploads/") || imageUrl?.startsWith("http://") || imageUrl?.startsWith("https://")) {
        uploadedAttachments.push({ url: imageUrl, contentType: "image/*" });
      }

      if (!text && uploadedAttachments.length === 0) return;

      const messageContent = text || i18n.t("pages.chatPanel.imageReferenceFallback");

      const userMessage: NovidadeMessage = {
        id: ID(),
        role: "user",
        content: messageContent,
        createdAt: new Date().toISOString(),
      };
      const assistantId = ID();
      const assistantMessage: NovidadeMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };

      const nextMessages = [...messages, userMessage, assistantMessage];
      setMessages(nextMessages);
      setInput("");
      setAttachments(undefined);
      setStatus("submitting");
      setError(null);

      try {
        streamApplyRef.current = { signature: "", lastAt: 0 };

        const preferredImageUrls = [
          ...uploadedImageUrls,
          ...uploadedAttachments.map((a) => a.url).filter(Boolean),
        ].filter((url, idx, arr) => arr.indexOf(url) === idx);

        if (preferredImageUrls.length > 0) {
          setUploadedImageUrls(preferredImageUrls);
        }

        let finalAssistant = "";

        const applyGeneratedFiles = (force = false) => {
          const now = Date.now();
          if (!force && now - streamApplyRef.current.lastAt < 300) {
            return;
          }
          streamApplyRef.current.lastAt = now;

          const { filesToCreate } = processResponse(finalAssistant, {
            preferredImageUrls,
          });

          if (!Object.keys(filesToCreate).length) {
            return;
          }

          const signature = JSON.stringify(filesToCreate);
          if (!force && signature === streamApplyRef.current.signature) {
            return;
          }

          createFilesBulk(filesToCreate);
          streamApplyRef.current.signature = signature;
        };

        await streamGenerateCode(
          {
            id: projectId,
            messages: [...messages, userMessage].map((m) => ({ role: m.role, content: m.content })),
            codebaseInfo: extractCodebase(),
            attachments: uploadedAttachments,
          },
          {
            onDelta: (delta) => {
              setStatus("streaming");
              finalAssistant += delta;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: `${m.content}${delta}` } : m))
              );
              applyGeneratedFiles(false);
            },
            onDone: (fullMessage) => {
              finalAssistant = fullMessage || finalAssistant;
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: finalAssistant } : m))
              );
              applyGeneratedFiles(true);
            },
          }
        );

        const { filesToCreate } = processResponse(finalAssistant, {
          preferredImageUrls,
        });
        const mergedFiles = createFilesBulk(filesToCreate);

        const persistedMessages = [...messages, userMessage, { ...assistantMessage, content: finalAssistant }];
        const saveResult = await saveNovidadeChat({
          id: projectId,
          messages: persistedMessages.map((m) => ({
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
          })),
          files: mergedFiles,
        });

        if (!projectId) {
          setProjectId(saveResult.id);
          onProjectIdChange?.(saveResult.id);
        }

        setStatus("idle");
      } catch (e) {
        setStatus("idle");
        setError(e instanceof Error ? e.message : i18n.t("pages.chatPanel.errorGeneric"));
      }
    },
      [input, attachments, messages, projectId, extractCodebase, createFilesBulk, onProjectIdChange, uploadedImageUrls]
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInput(e.target.value);
  }, []);

  const stop = useCallback(() => {
    setStatus("idle");
  }, []);

  const isLoading = status === "submitting" || status === "streaming";

  return useMemo(
    () => ({
      messages,
      input,
      status,
      isBotThinking: status === "submitted" || status === "streaming" || status === "submitting",
      isLoading,
      credits: 999,
      error,
      attachments,
      projectId,
      setInput,
      handleInputChange,
      send,
      stop,
      setAttachments,
      clearError: () => setError(null),
      creditModalOpen,
      closeCreditModal: () => setCreditModalOpen(false),
    }),
    [
      messages,
      input,
      status,
      isLoading,
      error,
      attachments,
      projectId,
      handleInputChange,
      send,
      stop,
      creditModalOpen,
    ]
  );
}
