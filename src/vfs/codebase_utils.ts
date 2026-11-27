const ALWAYS_INCLUDE_FILES = ["package.json", "index.html"];

export function sortFilesByImportance(files: string[], baseDir: string): string[] {
  const highPriorityPatterns = [
    new RegExp(`(^|/)${ALWAYS_INCLUDE_FILES[0]}$`),
    new RegExp(`(^|/)${ALWAYS_INCLUDE_FILES[1]}$`),
    /tsconfig\.json$/,
    /README\.md$/i,
    /index\.(ts|js)x?$/i,
    /main\.(ts|js)x?$/i,
    /app\.(ts|js)x?$/i,
  ];

  const base = baseDir.endsWith("/") ? baseDir : `${baseDir}/`;

  return [...files].sort((a, b) => {
    const relativeA = a.startsWith(base) ? a.slice(base.length) : a;
    const relativeB = b.startsWith(base) ? b.slice(base.length) : b;

    const aIsHighPriority = highPriorityPatterns.some((p) => p.test(relativeA));
    const bIsHighPriority = highPriorityPatterns.some((p) => p.test(relativeB));

    if (aIsHighPriority && !bIsHighPriority) return -1;
    if (!aIsHighPriority && bIsHighPriority) return 1;

    return relativeA.localeCompare(relativeB);
  });
}

export function formatFile(filePath: string, baseDir: string, content: string): string {
  try {
    const base = baseDir.endsWith("/") ? baseDir : `${baseDir}/`;
    const relativePath = filePath.startsWith(base) ? filePath.slice(base.length) : filePath;

    const redactedPatterns = [
      "src/components/ui/",
      "eslint.config",
      "tsconfig.json",
      "package-lock.json",
      ".env",
      "bun.lockb",
    ];

    const shouldRedact = redactedPatterns.some((pattern) => relativePath.includes(pattern));

    if (shouldRedact) {
      return `<laurena-file path="${relativePath}">\n// Contents omitted for brevity\n</laurena-file>\n\n`;
    }

    return `<laurena-file path="${relativePath}">\n${content}\n</laurena-file>\n\n`;
  } catch (error) {
    return `<laurena-file path="${filePath}">\n// Error reading file: ${String(error)}\n</laurena-file>\n\n`;
  }
}
