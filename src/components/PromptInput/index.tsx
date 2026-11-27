import React, { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

type PromptOutgoingMessage = {
  role: "user";
  content: {
    text: string;
    image: string;
  };
};

interface PromptInputProps {
  onSendMessage?: (message: PromptOutgoingMessage) => void;
  generating?: boolean;
  onError?: (error: string) => void;
  input?: string;
  handleInputChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  setInput?: (input: string) => void;
  stop?: () => void;
  height?: number;
  onAttachments?: (files: FileList) => void;
  variant?: "default" | "landing";
  placeholder?: string;
}

export function PromptInput({
  onSendMessage = () => {},
  generating = false,
  height = 42,
  onError = (err: string) => console.error(err),
  input,
  handleInputChange,
  setInput,
  stop,
  onAttachments,
  variant = "default",
  placeholder,
}: PromptInputProps) {
  const { t } = useTranslation();
  const [isDragActive, setIsDragActive] = useState(false);
  const [imageData, setImageData] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resolvedPlaceholder = placeholder ?? t("pages.promptInput.defaultPlaceholder");

  const handleSend = async () => {
    try {
      const textContent = (input || "").trim();
      if (!textContent && !imageData) return;

      const msg: PromptOutgoingMessage = {
        role: "user",
        content: {
          text: textContent,
          image: imageData || "",
        },
      };

      setInput?.("");
      setImageData(null);
      onSendMessage(msg);
    } catch (e) {
      onError(e instanceof Error ? e.message : t("pages.promptInput.sendError"));
    }
  };

  const readSelectedImage = (file: File) => {
    if (!file.type.startsWith("image/")) {
      onError(t("pages.promptInput.imageOnly"));
      return;
    }
    setUploadingImage(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setImageData(result);
      }
      setUploadingImage(false);
    };
    reader.onerror = () => {
      setUploadingImage(false);
      onError(t("pages.promptInput.imageReadError"));
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    onAttachments?.(files);
    readSelectedImage(files[0]);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!input?.trim() && !imageData) return;
        void handleSend();
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragActive(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragActive(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragActive(false);
        const dropped = e.dataTransfer.files?.[0];
        if (!dropped) return;
        if (e.dataTransfer.files) {
          onAttachments?.(e.dataTransfer.files);
        }
        readSelectedImage(dropped);
      }}
      className={cn(
        "relative group flex w-full flex-col gap-2 p-2 pb-3 text-base transition-all duration-150",
        variant === "landing"
          ? "rounded-2xl border border-[#e8b79a] bg-white/95 text-foreground shadow-[0_10px_28px_rgba(207,101,55,0.14)] focus-within:border-primary/60 hover:border-primary/45"
          : "rounded-2xl border border-[#e7c0aa]/80 bg-white/85 backdrop-blur-sm focus-within:border-primary/50 hover:border-primary/35"
      )}
    >
      {isDragActive && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-background/85">
          <span className="text-sm text-muted-foreground">{t("pages.promptInput.dropImage")}</span>
        </div>
      )}

      {imageData && (
        <div className="mb-1">
          <img src={imageData} alt="Preview" className="max-h-24 rounded-md border" />
        </div>
      )}

      <div className="relative flex items-center">
        <Textarea
          id="chatinput"
          placeholder={resolvedPlaceholder}
          value={input}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          autoFocus
          style={{ minHeight: height, height }}
          className={cn(
            "w-full resize-none rounded-md border-transparent bg-transparent px-2 py-2 text-[16px] leading-snug",
            variant === "landing"
              ? "text-foreground placeholder:text-muted-foreground focus-visible:ring-0"
              : "placeholder:text-muted-foreground focus-visible:ring-0"
          )}
          disabled={generating || uploadingImage}
        />
      </div>

      <div className="flex h-[30px] flex-wrap items-center gap-1 pl-0.5">
        <Button
          variant="ghost"
          type="button"
          className={cn(
            "h-fit gap-1 px-1 py-0.5 text-sm",
            variant === "landing" ? "text-primary hover:bg-primary/10 hover:text-primary" : ""
          )}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingImage}
        >
          <Upload className={cn("h-4 w-4 shrink-0", variant === "landing" ? "text-primary/80" : "text-muted-foreground")} /> {t("pages.promptInput.attach")}
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp"
          className="hidden"
          onChange={handleFileSelect}
          multiple
        />

        <div className="flex flex-grow items-center justify-end gap-2">
          {generating && stop && (
            <Button type="button" variant="destructive" onClick={stop} className="h-6 px-2 py-1 text-xs">
              {t("pages.promptInput.stop")}
            </Button>
          )}

          <button
            type="submit"
            className={cn(
              "ml-2 flex h-8 w-8 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-50",
              variant === "landing"
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "bg-primary text-primary-foreground hover:opacity-90"
            )}
            disabled={generating || uploadingImage}
            aria-label={t("pages.promptInput.sendAria")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </form>
  );
}
