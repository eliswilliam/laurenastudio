import { formatApiError } from "@/lib/api";

export type NovidadeMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

export type GenerateCodeBody = {
  id?: string | null;
  messages: Array<Pick<NovidadeMessage, "role" | "content">>;
  codebaseInfo: string;
  attachments?: NovidadeAttachment[];
};

export type NovidadeAttachment = {
  url: string;
  contentType?: string;
  name?: string;
  size?: number;
};

export type DbSaveResponse = {
  success: boolean;
  id: string;
  queued: boolean;
};

export type SnapshotItem = {
  id: string;
  projectId: string;
  commitHash: string;
  message?: string | null;
  createdAt: string;
  fileCount: number;
};

function authHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function authOnlyHeaders(): HeadersInit {
  return {
    Accept: "application/json",
  };
}

export async function streamGenerateCode(
  body: GenerateCodeBody,
  handlers: {
    onDelta: (delta: string) => void;
    onDone?: (fullMessage: string) => void;
  }
): Promise<void> {
  const response = await fetch("/api/v1/generate-code", {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    const errText = await response.text();
    throw new Error(errText || "Failed to stream generation");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let splitIndex = buffer.indexOf("\n\n");
    while (splitIndex !== -1) {
      const rawEvent = buffer.slice(0, splitIndex);
      buffer = buffer.slice(splitIndex + 2);

      const dataLines = rawEvent
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      if (dataLines.length) {
        const data = dataLines.join("\n");
        try {
          const parsed = JSON.parse(data) as
            | { type: "text-delta"; delta: string }
            | { type: "done"; message?: { content?: string } }
            | { type: "error"; error?: string };

          if (parsed.type === "text-delta") {
            full += parsed.delta || "";
            handlers.onDelta(parsed.delta || "");
          } else if (parsed.type === "done") {
            const serverMessage = parsed.message?.content || full;
            full = serverMessage;
            handlers.onDone?.(serverMessage);
          } else if (parsed.type === "error") {
            throw new Error(parsed.error || "AI stream error");
          }
        } catch (e) {
          if (e instanceof Error) throw e;
        }
      }

      splitIndex = buffer.indexOf("\n\n");
    }
  }

  handlers.onDone?.(full);
}

export async function saveNovidadeChat(payload: {
  id?: string | null;
  messages: Array<{ role: "user" | "assistant"; content: string; createdAt?: string }>;
  files: Record<string, string>;
}): Promise<DbSaveResponse> {
  const response = await fetch("/api/v1/chat/db-save", {
    method: "POST",
    headers: authHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(txt || "Failed to save chat");
  }

  return (await response.json()) as DbSaveResponse;
}

export async function getNovidadeProject(projectId: string): Promise<{
  projectId: string;
  name: string;
  messages: NovidadeMessage[];
  files: Record<string, string>;
  previewUrl?: string | null;
}> {
  const response = await fetch(`/api/v1/chat/projects/${projectId}`, {
    method: "GET",
    headers: authHeaders(),
    credentials: "include",
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(txt || "Failed to load project");
  }

  return (await response.json()) as {
    projectId: string;
    name: string;
    messages: NovidadeMessage[];
    files: Record<string, string>;
    previewUrl?: string | null;
  };
}

export async function getGitSnapshots(projectId: string): Promise<SnapshotItem[]> {
  const response = await fetch(`/api/v1/git/snapshots/${projectId}`, {
    method: "GET",
    headers: authHeaders(),
    credentials: "include",
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(formatApiError(new Error(txt)));
  }

  return (await response.json()) as SnapshotItem[];
}

export async function uploadNovidadeImage(file: File): Promise<NovidadeAttachment> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch("/api/v1/media/upload", {
    method: "POST",
    headers: authOnlyHeaders(),
    credentials: "include",
    body: form,
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(txt || "Failed to upload image");
  }

  const data = (await response.json()) as {
    url: string;
    type?: string;
    filename?: string;
    size?: number;
  };

  return {
    url: data.url,
    contentType: data.type,
    name: data.filename,
    size: data.size,
  };
}
