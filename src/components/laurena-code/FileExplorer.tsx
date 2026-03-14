import { useState, useEffect, useRef } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  RefreshCw,
  Plus,
  FileCode2,
  Upload,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
  extension?: string;
  size?: number;
}

interface FileExplorerProps {
  project: string | null;
  onFileSelect: (path: string) => void;
  activeFile: string | null;
}

const FILE_ICONS: Record<string, string> = {
  '.ts': '🟦', '.tsx': '⚛️', '.js': '🟨', '.jsx': '⚛️',
  '.py': '🐍', '.json': '📋', '.html': '🌐', '.css': '🎨',
  '.md': '📝', '.yaml': '⚙️', '.yml': '⚙️', '.sh': '🖥️',
  '.bat': '🖥️', '.cmd': '🖥️', '.ps1': '💠',
  '.dockerfile': '🐳', '.env': '🔒', '.sql': '🗃️',
  '.go': '🔵', '.rs': '🦀', '.java': '☕', '.rb': '💎',
  '.php': '🐘', '.vue': '💚', '.svelte': '🔥', '.swift': '🧡',
  '.kt': '🟣', '.c': '🔷', '.cpp': '🔷', '.h': '📎',
  '.cs': '🟪', '.dart': '🎯', '.lua': '🌙', '.r': '📊',
  '.pl': '🐪', '.ex': '💜', '.scala': '🔴', '.zig': '⚡',
  '.txt': '📄', '.xml': '📰', '.toml': '⚙️', '.ini': '⚙️',
};

const LANGUAGE_TEMPLATES: Record<string, { ext: string; template: string; icon: string }> = {
  Python: { ext: '.py', icon: '🐍', template: '# -*- coding: utf-8 -*-\n\ndef main():\n    print("Hello, World!")\n\nif __name__ == "__main__":\n    main()\n' },
  TypeScript: { ext: '.ts', icon: '🟦', template: 'function main(): void {\n  console.log("Hello, World!");\n}\n\nmain();\n' },
  'TypeScript React': { ext: '.tsx', icon: '⚛️', template: 'export default function Component() {\n  return (\n    <div className="p-4">\n      <h1>Hello, World!</h1>\n    </div>\n  );\n}\n' },
  JavaScript: { ext: '.js', icon: '🟨', template: 'function main() {\n  console.log("Hello, World!");\n}\n\nmain();\n' },
  'JavaScript React': { ext: '.jsx', icon: '⚛️', template: 'export default function Component() {\n  return (\n    <div className="p-4">\n      <h1>Hello, World!</h1>\n    </div>\n  );\n}\n' },
  HTML: { ext: '.html', icon: '🌐', template: '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Documento</title>\n  <style>\n    body { font-family: system-ui, sans-serif; padding: 2rem; }\n  </style>\n</head>\n<body>\n  <h1>Hello, World!</h1>\n</body>\n</html>\n' },
  CSS: { ext: '.css', icon: '🎨', template: '/* Estilos */\n\n* {\n  margin: 0;\n  padding: 0;\n  box-sizing: border-box;\n}\n\nbody {\n  font-family: system-ui, sans-serif;\n}\n' },
  Go: { ext: '.go', icon: '🔵', template: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello, World!")\n}\n' },
  Rust: { ext: '.rs', icon: '🦀', template: 'fn main() {\n    println!("Hello, World!");\n}\n' },
  Java: { ext: '.java', icon: '☕', template: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n' },
  'C#': { ext: '.cs', icon: '🟪', template: 'using System;\n\nclass Program {\n    static void Main(string[] args) {\n        Console.WriteLine("Hello, World!");\n    }\n}\n' },
  C: { ext: '.c', icon: '🔷', template: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n' },
  'C++': { ext: '.cpp', icon: '🔷', template: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}\n' },
  PHP: { ext: '.php', icon: '🐘', template: '<?php\n\necho "Hello, World!\\n";\n' },
  Ruby: { ext: '.rb', icon: '💎', template: '# frozen_string_literal: true\n\nputs "Hello, World!"\n' },
  Swift: { ext: '.swift', icon: '🧡', template: 'import Foundation\n\nprint("Hello, World!")\n' },
  Kotlin: { ext: '.kt', icon: '🟣', template: 'fun main() {\n    println("Hello, World!")\n}\n' },
  Dart: { ext: '.dart', icon: '🎯', template: 'void main() {\n  print("Hello, World!");\n}\n' },
  Lua: { ext: '.lua', icon: '🌙', template: 'print("Hello, World!")\n' },
  R: { ext: '.r', icon: '📊', template: 'cat("Hello, World!\\n")\n' },
  Perl: { ext: '.pl', icon: '🐪', template: '#!/usr/bin/perl\nuse strict;\nuse warnings;\n\nprint "Hello, World!\\n";\n' },
  Scala: { ext: '.scala', icon: '🔴', template: 'object Main extends App {\n  println("Hello, World!")\n}\n' },
  Shell: { ext: '.sh', icon: '🖥️', template: '#!/bin/bash\n\necho "Hello, World!"\n' },
  PowerShell: { ext: '.ps1', icon: '💠', template: '# PowerShell Script\n\nWrite-Host "Hello, World!"\n' },
  Batch: { ext: '.bat', icon: '🖥️', template: '@echo off\necho Hello, World!\npause\n' },
  SQL: { ext: '.sql', icon: '🗃️', template: '-- SQL Query\n\nSELECT 1 AS hello;\n' },
  JSON: { ext: '.json', icon: '📋', template: '{\n  "name": "projeto",\n  "version": "1.0.0"\n}\n' },
  YAML: { ext: '.yaml', icon: '⚙️', template: '# Configuração\nname: projeto\nversion: "1.0.0"\n' },
  Markdown: { ext: '.md', icon: '📝', template: '# Título\n\nDescrição do projeto.\n\n## Instalação\n\n```bash\nnpm install\n```\n' },
  Dockerfile: { ext: '', icon: '🐳', template: 'FROM node:20-alpine\n\nWORKDIR /app\n\nCOPY package*.json ./\nRUN npm ci\n\nCOPY . .\n\nEXPOSE 3000\nCMD ["npm", "start"]\n' },
  XML: { ext: '.xml', icon: '📰', template: '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n  <item>Hello, World!</item>\n</root>\n' },
  TOML: { ext: '.toml', icon: '⚙️', template: '[package]\nname = "projeto"\nversion = "1.0.0"\n' },
  'Texto Simples': { ext: '.txt', icon: '📄', template: '' },
};

function getFileIcon(name: string, ext?: string): string {
  if (ext && FILE_ICONS[ext]) return FILE_ICONS[ext];
  if (name === 'package.json') return '📦';
  if (name === 'Dockerfile' || name === 'dockerfile') return '🐳';
  if (name === 'README.md') return '📖';
  if (name === '.gitignore') return '🙈';
  if (name === '.env') return '🔒';
  return '📄';
}

function TreeNode({
  node, depth, onFileSelect, activeFile, project, onRefresh,
}: {
  node: FileNode; depth: number; onFileSelect: (path: string) => void;
  activeFile: string | null; project: string | null; onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const { toast } = useToast();
  const isActive = activeFile === node.path;

  const handleDelete = async () => {
    if (!project) return;
    try {
      await api.post('/laurena-code/files/delete', { path: node.path }, { params: { project } });
      toast({ title: 'Excluído', description: node.name });
      onRefresh();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const content = node.is_dir ? (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'flex items-center gap-1 w-full text-left px-2 py-1 text-xs hover:bg-[#2a2d2e] rounded transition-colors text-[#cccccc]'
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-[#858585]" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[#858585]" />}
        {expanded ? <FolderOpen className="w-3.5 h-3.5 shrink-0 text-[#dcb67a]" /> : <Folder className="w-3.5 h-3.5 shrink-0 text-[#dcb67a]" />}
        <span className="truncate font-medium">{node.name}</span>
      </button>
      {expanded && node.children?.map((child) => (
        <TreeNode key={child.path} node={child} depth={depth + 1} onFileSelect={onFileSelect} activeFile={activeFile} project={project} onRefresh={onRefresh} />
      ))}
    </div>
  ) : (
    <button
      onClick={() => onFileSelect(node.path)}
      className={cn(
        'flex items-center gap-1.5 w-full text-left px-2 py-1 text-xs rounded transition-colors',
        isActive ? 'bg-[#094771] text-white' : 'text-[#cccccc] hover:bg-[#2a2d2e]'
      )}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      <span className="text-[10px] shrink-0">{getFileIcon(node.name, node.extension)}</span>
      <span className="truncate">{node.name}</span>
    </button>
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger>{content}</ContextMenuTrigger>
      <ContextMenuContent className="bg-[#252526] border-[#3c3c3c] text-[#ccc]">
        {!node.is_dir && (
          <ContextMenuItem className="text-xs hover:bg-[#094771]" onClick={() => onFileSelect(node.path)}>
            Abrir
          </ContextMenuItem>
        )}
        <ContextMenuSeparator className="bg-[#3c3c3c]" />
        <ContextMenuItem className="text-xs text-red-400 hover:bg-[#094771]" onClick={handleDelete}>
          <Trash2 className="w-3 h-3 mr-2" />
          Excluir
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export default function FileExplorer({ project, onFileSelect, activeFile }: FileExplorerProps) {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [newFileDialog, setNewFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const loadFiles = async () => {
    setLoading(true);
    try {
      const params = project ? { project } : {};
      const res = await api.get('/laurena-code/files', { params });
      setFiles(res.data);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFiles(); }, [project]);

  const handleCreateFile = async () => {
    if (!project) return;

    let filename = newFileName.trim();
    let content = '';

    if (selectedLanguage && LANGUAGE_TEMPLATES[selectedLanguage]) {
      const tmpl = LANGUAGE_TEMPLATES[selectedLanguage];
      if (!filename) {
        const base = selectedLanguage === 'Dockerfile' ? 'Dockerfile' : `main${tmpl.ext}`;
        filename = base;
      } else if (tmpl.ext && !filename.includes('.') && selectedLanguage !== 'Dockerfile') {
        filename += tmpl.ext;
      }
      content = tmpl.template;
    }

    if (!filename) {
      toast({ title: 'Erro', description: 'Escolha uma linguagem ou digite um nome.', variant: 'destructive' });
      return;
    }

    try {
      await api.post('/laurena-code/files/create', { path: filename, content }, { params: { project } });
      toast({ title: 'Arquivo criado', description: filename });
      setNewFileDialog(false);
      setNewFileName('');
      setSelectedLanguage('');
      loadFiles();
      onFileSelect(filename);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadFiles = e.target.files;
    if (!uploadFiles || !project) return;

    for (const file of Array.from(uploadFiles)) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', '');
      formData.append('project', project);

      try {
        await api.post('/laurena-code/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast({ title: 'Upload concluído', description: file.name });
      } catch (err: any) {
        toast({ title: 'Erro no upload', description: `${file.name}: ${err.message}`, variant: 'destructive' });
      }
    }
    loadFiles();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="h-full flex flex-col bg-[#252526] text-[#cccccc]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#3c3c3c]">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#bbbbbb]">
          Arquivos
        </span>
        <div className="flex gap-0.5">
          <Button variant="ghost" size="icon" className="h-5 w-5 text-[#bbbbbb] hover:text-white hover:bg-[#3c3c3c]" onClick={() => setNewFileDialog(true)} title="Novo arquivo" disabled={!project}>
            <Plus className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5 text-[#bbbbbb] hover:text-white hover:bg-[#3c3c3c]" onClick={() => fileInputRef.current?.click()} title="Upload" disabled={!project}>
            <Upload className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5 text-[#bbbbbb] hover:text-white hover:bg-[#3c3c3c]" onClick={loadFiles} title="Atualizar">
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />

      <ScrollArea className="flex-1">
        <div className="py-1">
          {files.length === 0 && !loading && (
            <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
              <FileCode2 className="w-8 h-8 text-[#555]" />
              <p className="text-[11px] text-[#888]">
                {project ? 'Projeto vazio. Clique + para criar um arquivo.' : 'Crie ou selecione um projeto.'}
              </p>
            </div>
          )}
          {files.map((node) => (
            <TreeNode key={node.path} node={node} depth={0} onFileSelect={onFileSelect} activeFile={activeFile} project={project} onRefresh={loadFiles} />
          ))}
        </div>
      </ScrollArea>

      {project && (
        <div className="px-3 py-1.5 border-t border-[#3c3c3c] text-[10px] text-[#888] truncate">
          📁 {project}
        </div>
      )}

      {/* New File Dialog — language-focused */}
      <Dialog open={newFileDialog} onOpenChange={setNewFileDialog}>
        <DialogContent className="bg-[#252526] border-[#3c3c3c] text-[#ccc] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#eee]">Novo Arquivo</DialogTitle>
            <DialogDescription className="text-[#888]">
              Escolha a linguagem de programação. O arquivo será criado com um template inicial.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-[11px] text-[#aaa] mb-1.5 block">Linguagem de Programação</label>
              <Select value={selectedLanguage} onValueChange={(val) => {
                setSelectedLanguage(val);
                if (!newFileName.trim()) {
                  const tmpl = LANGUAGE_TEMPLATES[val];
                  if (tmpl) setNewFileName(val === 'Dockerfile' ? 'Dockerfile' : `main${tmpl.ext}`);
                }
              }}>
                <SelectTrigger className="bg-[#3c3c3c] border-[#555] text-[#ccc] text-xs h-9">
                  <SelectValue placeholder="Escolher linguagem..." />
                </SelectTrigger>
                <SelectContent className="bg-[#252526] border-[#3c3c3c] max-h-[300px]">
                  {Object.entries(LANGUAGE_TEMPLATES).map(([lang, info]) => (
                    <SelectItem key={lang} value={lang} className="text-[#ccc] text-xs">
                      <span className="flex items-center gap-2">
                        <span>{info.icon}</span>
                        <span>{lang}</span>
                        {info.ext && <span className="text-[#888]">({info.ext})</span>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] text-[#aaa] mb-1.5 block">Nome do arquivo</label>
              <Input
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="main.py"
                className="bg-[#3c3c3c] border-[#555] text-[#ccc] text-xs h-9"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setNewFileDialog(false); setNewFileName(''); setSelectedLanguage(''); }} className="text-[#ccc] text-xs">
              Cancelar
            </Button>
            <Button onClick={handleCreateFile} className="text-xs">
              Criar Arquivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
