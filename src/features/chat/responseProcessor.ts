export const getWriteTags = (
  fullResponse: string
): {
  path: string;
  content: string;
  description?: string;
}[] => {
  const ideashipActionRegex = /<ideashipAction\b([^>]*)>([\s\S]*?)<\/ideashipAction>/gi;

  let match: RegExpExecArray | null;
  const tags: { path: string; content: string; description?: string }[] = [];

  while ((match = ideashipActionRegex.exec(fullResponse)) !== null) {
    const attributesString = match[1] || "";
    let content = (match[2] || "").trim();

    const attrs: Record<string, string> = {};
    attributesString.replace(/(\w+)\s*=\s*("([^"]*)"|'([^']*)')/g, (_, key, _raw, doubleQ, singleQ) => {
      attrs[key] = (doubleQ ?? singleQ ?? "").trim();
      return "";
    });

    const type = (attrs.type || "").toLowerCase();
    const path = attrs.filePath || attrs.path || "";
    const description = attrs.description;

    if (type === "file" && path) {

      const contentLines = content.split("\n");
      if (contentLines[0]?.startsWith("```")) contentLines.shift();
      if (contentLines[contentLines.length - 1]?.startsWith("```")) contentLines.pop();
      content = contentLines.join("\n");

      tags.push({ path, content, description });
    }
  }

  return tags;
};

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&");

const getWriteTagsFromMarkdown = (fullResponse: string) => {
  const tags: { path: string; content: string; description?: string }[] = [];
  const regex = /(?:^|\n)\s*(?:File|Arquivo|Path|filePath)\s*[:\-]\s*([^\n]+)\s*\n```[^\n]*\n([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(fullResponse)) !== null) {
    const path = (match[1] || "").trim().replace(/^['"]|['"]$/g, "");
    const content = (match[2] || "").replace(/\s+$/, "");
    if (!path || !content) continue;
    tags.push({ path, content });
  }

  return tags;
};

const getWriteTagsFromCodeBlocks = (fullResponse: string) => {
  const tags: { path: string; content: string; description?: string }[] = [];

  const htmlRegex = /```(?:html)?\s*\n([\s\S]*?)```/gi;
  const cssRegex = /```(?:css)\s*\n([\s\S]*?)```/gi;
  const jsRegex = /```(?:javascript|js|typescript|ts)\s*\n([\s\S]*?)```/gi;

  const htmlMatch = htmlRegex.exec(fullResponse);
  if (htmlMatch?.[1]?.trim()) {
    tags.push({ path: "index.html", content: htmlMatch[1].trim() });
  }

  const cssMatch = cssRegex.exec(fullResponse);
  if (cssMatch?.[1]?.trim()) {
    tags.push({ path: "styles.css", content: cssMatch[1].trim() });
  }

  const jsMatch = jsRegex.exec(fullResponse);
  if (jsMatch?.[1]?.trim()) {
    tags.push({ path: "app.js", content: jsMatch[1].trim() });
  }

  return tags;
};

export const processResponse = (
  fullResponse: string,
  options?: { preferredImageUrls?: string[] }
) => {
  let writeTags = getWriteTags(fullResponse);
  if (writeTags.length === 0) {
    writeTags = getWriteTags(decodeHtmlEntities(fullResponse));
  }
  if (writeTags.length === 0) {
    writeTags = getWriteTagsFromMarkdown(fullResponse);
  }
  if (writeTags.length === 0) {
    writeTags = getWriteTagsFromMarkdown(decodeHtmlEntities(fullResponse));
  }
  if (writeTags.length === 0) {
    writeTags = getWriteTagsFromCodeBlocks(fullResponse);
  }

  const filesToCreate: Record<string, string> = {};
  const preferredImageUrls = (options?.preferredImageUrls || []).filter(Boolean);

  const toRenderableImageUrl = (raw: string, index: number) => {
    const src = raw.trim();
    if (!src) {
      return preferredImageUrls[0] || `https://picsum.photos/seed/novidade-${index + 1}/1280/720`;
    }

    if (src.startsWith("//")) {
      return `https:${src}`;
    }

    if (src.startsWith("data:image/") || src.startsWith("blob:")) {
      return src;
    }

    if (src.startsWith("http://") || src.startsWith("https://")) {
      return src;
    }

    if (src.startsWith("/uploads/") || src.startsWith("/api/") || src.startsWith("/assets/")) {
      return src;
    }

    if (src.startsWith("uploads/")) {
      return `/${src}`;
    }

    if (src.startsWith("#")) {
      return src;
    }

    return preferredImageUrls[0] || `https://picsum.photos/seed/novidade-${index + 1}/1280/720`;
  };

  const normalizeHtmlImages = (html: string) => {
    let imageIndex = 0;
    return html.replace(/(<img\b[^>]*\bsrc\s*=\s*)(["'])([^"']*)(\2)/gi, (_m, prefix, quote, src, suffix) => {
      const normalized = toRenderableImageUrl(src, imageIndex);
      imageIndex += 1;
      return `${prefix}${quote}${normalized}${suffix}`;
    });
  };

  for (const tag of writeTags) {
    const normalizedPath = tag.path.startsWith("/") ? tag.path.slice(1) : tag.path;
    const content = normalizedPath.toLowerCase().endsWith(".html")
      ? normalizeHtmlImages(tag.content)
      : tag.content;
    filesToCreate[normalizedPath] = content;
  }

  return { filesToCreate };
};
