export type Segment =
  | { type: "text"; content: string }
  | { type: "artifact"; content: string; attrs: Record<string, string>; loading?: boolean }
  | { type: "action"; content: string; attrs: Record<string, string>; loading?: boolean };

const TAGS = {
  ARTIFACT: { OPEN: "<ideashipArtifact", CLOSE: "</ideashipArtifact>" },
  ACTION: { OPEN: "<ideashipAction", CLOSE: "</ideashipAction>" },
} as const;

function parseAttributes(raw: string) {
  const out: Record<string, string> = {};
  raw.replace(/(\w+)="([^"]*)"/g, (_, k, v) => ((out[k] = v), ""));
  return out;
}

function findNextTag(src: string, from: number) {
  const idx = (tag: string) => src.indexOf(tag, from);

  const atOpen = idx(TAGS.ARTIFACT.OPEN);
  const atClose = idx(TAGS.ARTIFACT.CLOSE);
  const acOpen = idx(TAGS.ACTION.OPEN);
  const acClose = idx(TAGS.ACTION.CLOSE);

  const all = [
    { index: atOpen, type: "artifact-open" as const },
    { index: atClose, type: "artifact-close" as const },
    { index: acOpen, type: "action-open" as const },
    { index: acClose, type: "action-close" as const },
  ].filter(({ index }) => index !== -1);

  if (all.length === 0) return { index: Infinity, type: "none" as const };
  return all.reduce((a, b) => (b.index < a.index ? b : a));
}

export function parseStreaming(raw: string): Segment[] {
  const segments: Segment[] = [];
  const stack: number[] = [];
  let pos = 0;

  while (pos < raw.length) {
    if (stack.length) {
      const current = segments[stack[stack.length - 1]] as Extract<Segment, { type: "artifact" }>;
      const closeIdx = raw.indexOf(TAGS.ARTIFACT.CLOSE, pos);

      if (closeIdx === -1) {
        current.content += raw.slice(pos);
        current.loading = true;
        return segments;
      }

      current.content += raw.slice(pos, closeIdx);
      current.loading = false;
      stack.pop();
      pos = closeIdx + TAGS.ARTIFACT.CLOSE.length;
      continue;
    }

    const { index: next, type } = findNextTag(raw, pos);

    if (next === Infinity) {
      segments.push({ type: "text", content: raw.slice(pos) });
      break;
    }

    if (next > pos) {
      segments.push({ type: "text", content: raw.slice(pos, next) });
      pos = next;
    }

    switch (type) {
      case "artifact-open": {
        const afterOpen = pos + TAGS.ARTIFACT.OPEN.length;
        const gt = raw.indexOf(">", afterOpen);
        if (gt === -1) {
          segments.push({ type: "text", content: raw.slice(pos) });
          return segments;
        }

        const attrs = parseAttributes(raw.slice(afterOpen, gt));
        segments.push({ type: "artifact", content: "", attrs, loading: true });
        stack.push(segments.length - 1);
        pos = gt + 1;
        break;
      }

      case "action-open": {
        const afterOpen = pos + TAGS.ACTION.OPEN.length;
        const gt = raw.indexOf(">", afterOpen);
        if (gt === -1) {
          segments.push({ type: "text", content: raw.slice(pos) });
          return segments;
        }

        const attrs = parseAttributes(raw.slice(afterOpen, gt));
        const closeIdx = raw.indexOf(TAGS.ACTION.CLOSE, gt + 1);

        const content = closeIdx !== -1 ? raw.slice(gt + 1, closeIdx) : "";
        const loading = closeIdx === -1;

        segments.push({ type: "action", content, attrs, loading });
        pos = closeIdx !== -1 ? closeIdx + TAGS.ACTION.CLOSE.length : raw.length;
        break;
      }

      case "action-close":
      case "artifact-close":
      default:
        pos += type === "action-close" ? TAGS.ACTION.CLOSE.length : TAGS.ARTIFACT.CLOSE.length;
    }
  }

  return segments;
}
