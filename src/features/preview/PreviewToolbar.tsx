import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export function PreviewToolbar({ host, onRefresh }: { host: string; onRefresh: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex select-none items-center gap-2 border-b border-[#e7c0aa] bg-white/90 px-4 py-2 text-sm">
      <button className="rounded-md p-1" disabled>
        <ArrowLeft className="h-4 w-4 text-muted-foreground/80" />
      </button>
      <button className="rounded-md p-1" disabled>
        <ArrowRight className="h-4 w-4 text-muted-foreground/80" />
      </button>
      <div className="flex-1 truncate rounded-md border border-[#f0d3c3] bg-[#fffaf6] px-3 py-1 text-center text-muted-foreground">
        {host}
      </div>
      <button
        className="rounded-md p-1 transition-colors hover:bg-[#fff0e6]"
        onClick={onRefresh}
        title={t("pages.previewToolbar.refreshTitle")}
      >
        <RefreshCw className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}
