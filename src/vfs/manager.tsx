import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { formatFile, sortFilesByImportance } from "./codebase_utils";

interface FileManagerContextType {
  files: Record<string, string>;
  setFiles: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  isFileSystemSafe: () => boolean;
  extractCodebase: (maxFiles?: number) => string;
  createFilesBulk: (incomingFiles: Record<string, string>) => Record<string, string>;
  resetFilesToDefault: () => void;
}

const DEFAULT_FILES: Record<string, string> = {
  "/index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New Site</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <main>
      <h1>Start your prompt to generate this site</h1>
    </main>
    <script src="app.js"></script>
  </body>
</html>
`,
  "/styles.css": `:root { font-family: system-ui, sans-serif; }\nbody { margin: 0; padding: 2rem; }\n`,
  "/app.js": "console.log('Novidade ready');\n",
};

const FileManagerContext = createContext<FileManagerContextType | undefined>(undefined);

const MAX_TOTAL_SIZE = 10 * 1024 * 1024;
const MAX_FILE_COUNT = 300;
const MAX_FILE_SIZE = 100 * 1024;

interface FileManagerProviderProps {
  children: ReactNode;
}

export const useFileManager = () => {
  const context = useContext(FileManagerContext);
  if (!context) {
    throw new Error("useFileManager must be used within a FileManagerProvider");
  }
  return context;
};

function normalizeFilesMap(files: Record<string, string>): Record<string, string> {
  return Object.entries(files).reduce<Record<string, string>>((acc, [key, value]) => {
    const normalizedKey = key.startsWith("/") ? key : `/${key}`;
    acc[normalizedKey] = value;
    return acc;
  }, {});
}

export const FileManagerProvider = ({ children }: FileManagerProviderProps) => {
  const [files, setFiles] = useState<Record<string, string>>(DEFAULT_FILES);
  const filesRef = useRef<Record<string, string>>(DEFAULT_FILES);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  const contextValue = useMemo<FileManagerContextType>(() => {
    const isFileSystemSafe = (): boolean => {
      const totalSize = Object.values(files).reduce((acc, content) => acc + content.length, 0);
      return Object.keys(files).length <= MAX_FILE_COUNT && totalSize <= MAX_TOTAL_SIZE;
    };

    const extractCodebase = (maxFiles = 30): string => {
      let output = "";
      const filePaths = Object.keys(files);

      const filteredFilePaths = filePaths.filter((fp) => {
        const content = files[fp] ?? "";
        return content.length <= MAX_FILE_SIZE;
      });

      const sortedFilePaths = sortFilesByImportance(filteredFilePaths, "/").slice(0, maxFiles);

      for (const fp of sortedFilePaths) {
        output += formatFile(fp, "/", files[fp] ?? "");
      }

      return output;
    };

    const createFilesBulk = (incomingFiles: Record<string, string>) => {
      const normalizedIncoming = normalizeFilesMap(incomingFiles);
      const merged = { ...filesRef.current, ...normalizedIncoming };

      const totalSize = Object.values(merged).reduce((acc, content) => acc + content.length, 0);
      const fileCount = Object.keys(merged).length;
      if (fileCount > MAX_FILE_COUNT || totalSize > MAX_TOTAL_SIZE) {
        throw new Error("File limit exceeded");
      }

      filesRef.current = merged;
      setFiles(merged);
      return merged;
    };

    const resetFilesToDefault = () => {
      setFiles(DEFAULT_FILES);
    };

    return {
      files,
      setFiles,
      isFileSystemSafe,
      extractCodebase,
      createFilesBulk,
      resetFilesToDefault,
    };
  }, [files]);

  return <FileManagerContext.Provider value={contextValue}>{children}</FileManagerContext.Provider>;
};
