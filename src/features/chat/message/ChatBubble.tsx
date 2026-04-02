import React, { memo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CircleCheck } from "lucide-react";
import { Segment, parseStreaming } from "./parseArtifacts";

const Narrative = memo(function Narrative({ text }: { text: string }) {
  return text.trim() ? <div className="mb-2 whitespace-pre-wrap">{text.trim()}</div> : null;
});

const RenderAction = memo(function RenderAction({
  segment,
}: {
  segment: Extract<Segment, { type: "action" }>;
}) {
  const { attrs, loading } = segment;
  return (
    <div className="flex items-center">
      {loading ? (
        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      ) : (
        <CircleCheck className="mr-2 text-emerald-500" />
      )}
      <span className="text-sm">{attrs.description ?? attrs.filePath}</span>
    </div>
  );
});

function containsIdeashipAction(str: string) {
  return str.includes("<ideashipAction");
}

const RenderArtifact = memo(function RenderArtifact({
  segment,
}: {
  segment: Extract<Segment, { type: "artifact" }>;
}) {
  const { content, attrs, loading } = segment;
  const title = attrs.title || attrs.id || "Artifact";
  const [parsedContent, setParsedContent] = React.useState<React.ReactNode>(null);

  useEffect(() => {
    if (!content) return;

    if (containsIdeashipAction(content)) {
      const segments = parseStreaming(content);
      const actions = segments.filter((s) => s.type === "action");
      const texts = segments.filter((s) => s.type === "text");

      setParsedContent(
        <>
          {texts.map((s, i) => s.type === "text" && <Narrative key={`t-${i}`} text={s.content} />)}

          {actions.length > 0 && (
            <ul className="mt-2 list-none space-y-2 pl-0">
              {actions.map(
                (s, i) =>
                  s.type === "action" && (
                    <li key={`a-${i}`} className="ml-0 pl-0">
                      <RenderAction segment={s} />
                    </li>
                  )
              )}
            </ul>
          )}
        </>
      );
    } else {
      setParsedContent(<ChatBubble raw={content} />);
    }
  }, [content]);

  return (
    <Card className="mb-2 border-border/70 bg-background/70 p-2 shadow-sm">
      <CardHeader className="p-2">
        <CardTitle className="text-base text-foreground">
          {title} {loading && "(Loading...)"}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-2">{parsedContent}</CardContent>
    </Card>
  );
});

export const ChatBubble = memo(function ChatBubble({ raw }: { raw: string }) {
  const segments = React.useMemo(() => parseStreaming(raw), [raw]);

  return (
    <div className="group/message relative origin-bottom-left break-words rounded-lg bg-muted p-3 text-sm text-foreground duration-300 animate-in fade-in-0 zoom-in-75">
      {segments.map((seg, i) => {
        if (seg.type === "text") return <Narrative key={i} text={seg.content} />;
        if (seg.type === "artifact") return <RenderArtifact key={i} segment={seg} />;
        if (seg.type === "action") return <RenderAction key={i} segment={seg} />;
        return null;
      })}
    </div>
  );
});
