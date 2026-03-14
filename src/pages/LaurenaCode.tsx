import { useState, useCallback, useEffect } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  PanelBottomClose,
  PanelBottomOpen,
  Code2,
  Activity,
  FolderOpen,
  Plus,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import FileExplorer from '@/components/laurena-code/FileExplorer';
import CodeEditor from '@/components/laurena-code/CodeEditor';
import ChatPanel from '@/components/laurena-code/ChatPanel';
import TerminalPanel from '@/components/laurena-code/TerminalPanel';
import AgentSelector from '@/components/laurena-code/AgentSelector';
import api from '@/lib/api';

interface ProjectInfo {
  name: string;
  path: string;
  files_count: number;
}

export default function LaurenaCode() {
  const [showExplorer, setShowExplorer] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [selectedAgents, setSelectedAgents] = useState<string[]>(['coder']);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [newProjectDialog, setNewProjectDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [runOutput, setRunOutput] = useState<{ stdout: string; stderr: string; label: string } | null>(null);
  const { toast } = useToast();

  const loadProjects = useCallback(async () => {
    try {
      const res = await api.get('/laurena-code/projects');
      setProjects(res.data);
    } catch {
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleFileSelect = useCallback((path: string) => {
    setActiveFile(path);
  }, []);

  const handleFileChange = useCallback((path: string | null) => {
    setActiveFile(path);
  }, []);

  const handleCodeSelect = useCallback((code: string | null) => {
    setSelectedCode(code);
  }, []);

  const handleRunOutput = useCallback((stdout: string, stderr: string) => {
    setRunOutput({ stdout, stderr, label: activeFile || 'run' });
    setShowTerminal(true);
  }, [activeFile]);

  const handleProjectCreated = useCallback(
    (projectName: string) => {
      setActiveProject(projectName);
      setRefreshKey((k) => k + 1);
      loadProjects();
    },
    [loadProjects]
  );

  const handleActionExecuted = useCallback(
    (action: any) => {
      if (action.type === 'create_file' || action.type === 'edit_file') {
        setRefreshKey((k) => k + 1);
        if (action.file) {
          setTimeout(() => setActiveFile(action.file), 500);
        }
      }
    },
    []
  );

  const toggleAgent = useCallback((agentId: string) => {
    setSelectedAgents((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId]
    );
  }, []);

  const handleCreateEmptyProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;
    try {
      await api.post('/laurena-code/files/create-folder', { path: '.' }, { params: { project: name } });
      setActiveProject(name);
      setNewProjectDialog(false);
      setNewProjectName('');
      setRefreshKey((k) => k + 1);
      loadProjects();
      toast({ title: 'Projeto criado', description: name });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="h-[calc(100vh-64px)] md:h-screen flex flex-col bg-[#1e1e1e] -m-4 md:-m-6 overflow-hidden">
      {/* Top bar */}
      <div className="h-9 bg-[#323233] flex items-center justify-between px-2 border-b border-[#3c3c3c] shrink-0">
        <div className="flex items-center gap-1">
          {/* Panel toggles */}
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-7 w-7',
                  showExplorer ? 'text-white bg-[#3c3c3c]' : 'text-[#888] hover:text-white hover:bg-[#3c3c3c]'
                )}
                onClick={() => setShowExplorer(!showExplorer)}
              >
                {showExplorer ? <PanelLeftClose className="w-3.5 h-3.5" /> : <PanelLeftOpen className="w-3.5 h-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[10px]">Explorador</TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-7 w-7',
                  showTerminal ? 'text-white bg-[#3c3c3c]' : 'text-[#888] hover:text-white hover:bg-[#3c3c3c]'
                )}
                onClick={() => setShowTerminal(!showTerminal)}
              >
                {showTerminal ? <PanelBottomClose className="w-3.5 h-3.5" /> : <PanelBottomOpen className="w-3.5 h-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[10px]">Terminal</TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-7 w-7',
                  showChat ? 'text-white bg-[#3c3c3c]' : 'text-[#888] hover:text-white hover:bg-[#3c3c3c]'
                )}
                onClick={() => setShowChat(!showChat)}
              >
                {showChat ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[10px]">Chat IA</TooltipContent>
          </Tooltip>

          <div className="w-px h-4 bg-[#555] mx-1" />

          {/* Agent selector */}
          <AgentSelector selectedAgents={selectedAgents} onToggleAgent={toggleAgent} compact />

          <div className="w-px h-4 bg-[#555] mx-1" />

          {/* Project selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px] text-[#ccc] hover:text-white hover:bg-[#3c3c3c] gap-1"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                {activeProject || 'Selecionar projeto'}
                <ChevronDown className="w-3 h-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#252526] border-[#3c3c3c] text-[#ccc]" align="start">
              {projects.map((p) => (
                <DropdownMenuItem
                  key={p.name}
                  className="text-xs hover:bg-[#094771]"
                  onClick={() => {
                    setActiveProject(p.name);
                    setActiveFile(null);
                    setRefreshKey((k) => k + 1);
                  }}
                >
                  <FolderOpen className="w-3 h-3 mr-2 text-[#dcb67a]" />
                  {p.name}
                  <span className="ml-auto text-[#888] text-[10px]">{p.files_count} arquivos</span>
                </DropdownMenuItem>
              ))}
              {projects.length > 0 && <DropdownMenuSeparator className="bg-[#3c3c3c]" />}
              <DropdownMenuItem
                className="text-xs hover:bg-[#094771]"
                onClick={() => setNewProjectDialog(true)}
              >
                <Plus className="w-3 h-3 mr-2 text-[#569cd6]" />
                Novo projeto vazio
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Center title */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-[#569cd6] to-[#c586c0] flex items-center justify-center">
            <Code2 className="w-3 h-3 text-white" />
          </div>
          <span className="text-[11px] font-bold text-[#cccccc] tracking-wider">
            LAURENA CODE
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1 text-[10px] text-[#888] px-2">
            <Activity className="w-3 h-3 text-green-400" />
            <span>Online</span>
          </div>
        </div>
      </div>

      {/* Main IDE layout */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* File Explorer */}
          {showExplorer && (
            <>
              <ResizablePanel defaultSize={15} minSize={10} maxSize={30}>
                <FileExplorer
                  key={refreshKey}
                  project={activeProject}
                  onFileSelect={handleFileSelect}
                  activeFile={activeFile}
                />
              </ResizablePanel>
              <ResizableHandle className="w-[1px] bg-[#3c3c3c] hover:bg-[#569cd6] transition-colors" />
            </>
          )}

          {/* Center: Editor + Terminal */}
          <ResizablePanel defaultSize={showChat ? 55 : 70} minSize={30}>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={showTerminal ? 65 : 100} minSize={20}>
                <CodeEditor
                  project={activeProject}
                  activeFile={activeFile}
                  onFileChange={handleFileChange}
                  onCodeSelect={handleCodeSelect}
                  onRunOutput={handleRunOutput}
                />
              </ResizablePanel>

              {showTerminal && (
                <>
                  <ResizableHandle className="h-[1px] bg-[#3c3c3c] hover:bg-[#569cd6] transition-colors" />
                  <ResizablePanel defaultSize={35} minSize={10} maxSize={60}>
                    <TerminalPanel project={activeProject} externalOutput={runOutput} />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>

          {/* Chat Panel */}
          {showChat && (
            <>
              <ResizableHandle className="w-[1px] bg-[#3c3c3c] hover:bg-[#569cd6] transition-colors" />
              <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
                <ChatPanel
                  project={activeProject}
                  activeFile={activeFile}
                  selectedCode={selectedCode}
                  onActionExecuted={handleActionExecuted}
                  onProjectCreated={handleProjectCreated}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      {/* New project dialog */}
      <Dialog open={newProjectDialog} onOpenChange={setNewProjectDialog}>
        <DialogContent className="bg-[#252526] border-[#3c3c3c] text-[#ccc]">
          <DialogHeader>
            <DialogTitle className="text-[#eee]">Novo Projeto</DialogTitle>
            <DialogDescription className="text-[#888]">
              Crie um projeto vazio ou use o chat IA para gerar um projeto completo.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="nome-do-projeto"
              className="bg-[#3c3c3c] border-[#555] text-[#ccc]"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateEmptyProject()}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewProjectDialog(false)} className="text-[#ccc]">
              Cancelar
            </Button>
            <Button onClick={handleCreateEmptyProject} disabled={!newProjectName.trim()}>
              Criar Projeto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
