import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface MessageReasoningProps {
  isLoading: boolean;
  reasoning: string;
}

export function MessageReasoning({ isLoading, reasoning }: MessageReasoningProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="flex flex-col text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <div className="font-medium">{isLoading ? "Reasoning..." : "Reasoned for a few seconds"}</div>
        <button
          data-testid="message-reasoning-toggle"
          type="button"
          className="cursor-pointer"
          onClick={() => {
            setIsExpanded(!isExpanded);
          }}
        >
          <ChevronDown className={isExpanded ? "rotate-180 transition-transform" : "transition-transform"} />
        </button>
      </div>

      {isExpanded && (
        <div
          data-testid="message-reasoning"
          className="mt-3 flex flex-col gap-4 border-l pl-4 text-muted-foreground"
        >
          {reasoning}
        </div>
      )}
    </div>
  );
}
