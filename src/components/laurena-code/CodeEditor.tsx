import { useState, useEffect, useRef, useCallback } from 'react';
import Editor, { type Monaco } from '@monaco-editor/react';
import {
  FileCode2,
  X,
  Circle,
  Save,
  Play,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface OpenTab {
  path: string;
  name: string;
  language: string;
  content: string;
  savedContent: string;
  modified: boolean;
}

interface CodeEditorProps {
  project: string | null;
  activeFile: string | null;
  onFileChange: (path: string | null) => void;
  onCodeSelect?: (code: string | null) => void;
  onRunOutput?: (stdout: string, stderr: string) => void;
}

const LANG_MAP: Record<string, string> = {
  python: 'python',
  javascript: 'javascript',
  typescript: 'typescript',
  typescriptreact: 'typescript',
  javascriptreact: 'javascript',
  html: 'html',
  css: 'css',
  scss: 'scss',
  json: 'json',
  yaml: 'yaml',
  markdown: 'markdown',
  sql: 'sql',
  shell: 'shell',
  powershell: 'powershell',
  bat: 'bat',
  dockerfile: 'dockerfile',
  go: 'go',
  rust: 'rust',
  java: 'java',
  kotlin: 'kotlin',
  swift: 'swift',
  ruby: 'ruby',
  php: 'php',
  c: 'c',
  cpp: 'cpp',
  csharp: 'csharp',
  dart: 'dart',
  lua: 'lua',
  r: 'r',
  perl: 'perl',
  scala: 'scala',
  vue: 'html',
  svelte: 'html',
  xml: 'xml',
  plaintext: 'plaintext',
  dotenv: 'ini',
  toml: 'ini',
};

const LANG_COLORS: Record<string, string> = {
  python: '#3572A5', javascript: '#f1e05a', typescript: '#3178c6',
  html: '#e34c26', css: '#563d7c', json: '#292929', markdown: '#083fa1',
  shell: '#89e051', powershell: '#012456', bat: '#C1F12E',
  yaml: '#cb171e', go: '#00ADD8', rust: '#dea584', java: '#b07219',
  ruby: '#701516', php: '#4F5D95', csharp: '#178600', dart: '#00B4AB',
  lua: '#000080', r: '#198CE7', perl: '#0298c3', scala: '#c22d40',
  c: '#555555', cpp: '#f34b7d', kotlin: '#A97BFF', swift: '#F05138',
};

const RUN_COMMANDS: Record<string, (f: string) => string> = {
  python: (f) => `python "${f}"`,
  javascript: (f) => `node "${f}"`,
  typescript: (f) => `npx ts-node "${f}"`,
  go: (f) => `go run "${f}"`,
  rust: (f) => `rustc "${f}" -o out && ./out`,
  java: (f) => { const cls = f.replace(/\.java$/, ''); return `javac "${f}" && java "${cls}"`; },
  c: (f) => `gcc "${f}" -o out && ./out`,
  cpp: (f) => `g++ "${f}" -o out && ./out`,
  csharp: (f) => `dotnet-script "${f}"`,
  ruby: (f) => `ruby "${f}"`,
  php: (f) => `php "${f}"`,
  lua: (f) => `lua "${f}"`,
  perl: (f) => `perl "${f}"`,
  r: (f) => `Rscript "${f}"`,
  dart: (f) => `dart run "${f}"`,
  kotlin: (f) => `kotlinc "${f}" -include-runtime -d out.jar && java -jar out.jar`,
  scala: (f) => `scala "${f}"`,
  shell: (f) => `bash "${f}"`,
  powershell: (f) => `powershell -File "${f}"`,
  bat: (f) => `cmd /c "${f}"`,
  swift: (f) => `swift "${f}"`,
};

export default function CodeEditor({
  project, activeFile, onFileChange, onCodeSelect, onRunOutput,
}: CodeEditorProps) {
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const saveRef = useRef<() => void>(() => {});
  const { toast } = useToast();

  useEffect(() => {
    if (!activeFile || !project) return;
    if (tabs.find((t) => t.path === activeFile)) {
      setActiveTab(activeFile);
      return;
    }
    api.post('/laurena-code/files/read', { path: activeFile }, { params: { project } })
      .then((res) => {
        const newTab: OpenTab = {
          path: res.data.path,
          name: res.data.path.split(/[/\\]/).pop() || res.data.path,
          language: res.data.language || 'plaintext',
          content: res.data.content,
          savedContent: res.data.content,
          modified: false,
        };
        setTabs((prev) => [...prev, newTab]);
        setActiveTab(res.data.path);
      })
      .catch((err) => toast({ title: 'Erro ao abrir arquivo', description: err.message, variant: 'destructive' }));
  }, [activeFile, project]);

  const doSave = useCallback(async () => {
    const tabPath = activeTab;
    if (!tabPath || !project) return;
    const tab = tabs.find((t) => t.path === tabPath);
    if (!tab || !tab.modified) return;

    setSaving(true);
    try {
      await api.post('/laurena-code/files/write', { path: tab.path, content: tab.content }, { params: { project } });
      setTabs((prev) => prev.map((t) => t.path === tabPath ? { ...t, savedContent: t.content, modified: false } : t));
      toast({ title: 'Salvo', description: tab.name });
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [tabs, activeTab, project, toast]);

  useEffect(() => { saveRef.current = doSave; }, [doSave]);

  const doRun = useCallback(async () => {
    const tab = tabs.find((t) => t.path === activeTab);
    if (!tab || !project) return;

    if (tab.modified) {
      await doSave();
    }

    const cmdFn = RUN_COMMANDS[tab.language];
    if (!cmdFn) {
      toast({ title: 'Executar', description: `Linguagem "${tab.language}" não tem comando de execução configurado.`, variant: 'destructive' });
      return;
    }

    setRunning(true);
    try {
      const res = await api.post('/laurena-code/terminal', { command: cmdFn(tab.path), cwd: project }, { timeout: 70000 });
      onRunOutput?.(res.data.stdout || '', res.data.stderr || '');
      if (res.data.exit_code === 0) {
        toast({ title: '✅ Executado com sucesso', description: tab.name });
      } else {
        toast({ title: `⚠️ Código de saída: ${res.data.exit_code}`, description: tab.name, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erro na execução', description: err.message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  }, [tabs, activeTab, project, doSave, toast, onRunOutput]);

  const closeTab = useCallback((path: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTabs((prev) => {
      const remaining = prev.filter((t) => t.path !== path);
      if (activeTab === path) {
        const newActive = remaining.length > 0 ? remaining[remaining.length - 1].path : null;
        setActiveTab(newActive);
        onFileChange(newActive);
      }
      return remaining;
    });
  }, [activeTab, onFileChange]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (!activeTab || value === undefined) return;
    setTabs((prev) => prev.map((t) => t.path === activeTab ? { ...t, content: value, modified: value !== t.savedContent } : t));
  }, [activeTab]);

  const handleEditorMount = useCallback((editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    editor.onDidChangeCursorSelection(() => {
      const sel = editor.getModel()?.getValueInRange(editor.getSelection());
      onCodeSelect?.(sel || null);
    });

    editor.addAction({
      id: 'laurena-save',
      label: 'Salvar Arquivo',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => { saveRef.current(); },
    });
  }, [onCodeSelect]);

  const currentTab = tabs.find((t) => t.path === activeTab);
  const monacoLang = currentTab ? LANG_MAP[currentTab.language] || 'plaintext' : 'plaintext';
  const canRun = currentTab ? !!RUN_COMMANDS[currentTab.language] : false;

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      {/* Tabs */}
      <div className="flex items-center bg-[#252526] border-b border-[#3c3c3c] overflow-x-auto shrink-0">
        {tabs.map((tab) => {
          const color = LANG_COLORS[tab.language] || '#888';
          return (
            <div
              key={tab.path}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-[11px] border-r border-[#3c3c3c] cursor-pointer shrink-0 group min-w-0',
                activeTab === tab.path ? 'bg-[#1e1e1e] text-white' : 'text-[#969696] hover:bg-[#2d2d2d]'
              )}
              style={activeTab === tab.path ? { borderTop: '2px solid #569cd6' } : { borderTop: '2px solid transparent' }}
              onClick={() => { setActiveTab(tab.path); onFileChange(tab.path); }}
            >
              <Circle className="w-2 h-2 shrink-0" fill={tab.modified ? '#c5a332' : color} stroke="none" />
              <span className="truncate max-w-[120px]">{tab.name}</span>
              {tab.modified && <span className="text-[#c5a332] text-[10px] font-bold shrink-0">●</span>}
              <button onClick={(e) => closeTab(tab.path, e)} className="ml-1 opacity-0 group-hover:opacity-100 hover:bg-[#3c3c3c] rounded p-0.5 transition-opacity shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        {/* Action buttons */}
        <div className="flex items-center ml-auto shrink-0 gap-0.5 px-1">
          {canRun && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-green-400 hover:text-green-300 hover:bg-[#3c3c3c]" onClick={doRun} disabled={running} title="Executar arquivo">
              {running ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
              Executar
            </Button>
          )}
          {currentTab?.modified && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-[#ccc] hover:text-white hover:bg-[#3c3c3c]" onClick={doSave} disabled={saving}>
              {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
              Salvar
            </Button>
          )}
        </div>
      </div>

      {/* Editor */}
      {currentTab ? (
        <div className="flex-1 overflow-hidden">
          <Editor
            height="100%"
            language={monacoLang}
            value={currentTab.content}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            theme="vs-dark"
            options={{
              fontSize: 13,
              fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', Consolas, monospace",
              fontLigatures: true,
              minimap: { enabled: true, scale: 1 },
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              renderWhitespace: 'selection',
              bracketPairColorization: { enabled: true },
              autoClosingBrackets: 'always',
              autoClosingQuotes: 'always',
              formatOnPaste: true,
              suggestOnTriggerCharacters: true,
              wordWrap: 'on',
              lineNumbers: 'on',
              glyphMargin: true,
              folding: true,
              links: true,
              tabSize: 2,
              insertSpaces: true,
              padding: { top: 8, bottom: 8 },
            }}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-[#555] gap-4">
          <div className="relative">
            <div className="absolute -inset-6 bg-gradient-to-r from-[#569cd6]/10 via-[#c586c0]/10 to-[#4ec9b0]/10 rounded-full blur-xl" />
            <FileCode2 className="w-20 h-20 relative" />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-bold text-[#ccc]">LAURENA CODE</h3>
            <p className="text-[12px] text-[#888] max-w-[300px]">
              Selecione um arquivo no explorador ou crie um novo projeto usando o chat IA.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-[11px] text-[#666]">
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 rounded bg-[#333] border border-[#555] text-[#aaa]">Ctrl+S</kbd>
              <span>Salvar arquivo</span>
            </div>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-0.5 bg-[#007acc] text-white text-[10px] shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-semibold">LAURENA CODE</span>
          {currentTab && (
            <>
              <span className="opacity-80">{currentTab.language}</span>
              <span className="opacity-80">{currentTab.content.split('\n').length} linhas</span>
              {currentTab.modified && <span className="text-yellow-300 font-medium">● Modificado</span>}
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="opacity-80">UTF-8</span>
          {canRun && <span className="opacity-80 text-green-300">▶ Executável</span>}
        </div>
      </div>
    </div>
  );
}
