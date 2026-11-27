import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Image,
  Video,
  BrainCircuit,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  Search,
  Grid3X3,
  List,
  Filter,
  MoreVertical,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import api, { formatApiError } from '@/lib/api';

interface MediaItem {
  id: string;
  filename: string;
  url: string;
  type: string;
  size: number;
  source: string;
  created_at: string | null;
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMediaCategory(type: string): 'imagem' | 'video' | 'gerado-ia' {
  if (type.startsWith('video/')) return 'video';
  return 'imagem';
}

const iconesTipo: Record<string, React.ReactNode> = {
  imagem: <Image className="w-3.5 h-3.5" />,
  video: <Video className="w-3.5 h-3.5" />,
  'gerado-ia': <BrainCircuit className="w-3.5 h-3.5" />,
};

export default function BibliotecaMidia() {
  const [busca, setBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<string>('todos');
  const [visualizacao, setVisualizacao] = useState<'grid' | 'lista'>('grid');
  const [uploadDialogAberto, setUploadDialogAberto] = useState(false);
  const [midias, setMidias] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { t } = useTranslation();

  const fetchMidias = useCallback(async () => {
    try {
      const { data } = await api.get('/media/');
      setMidias(data);
    } catch {
      // silently fail; show empty state
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMidias();
  }, [fetchMidias]);

  const midiasFiltradas = midias.filter((m) => {
    const cat = m.source === 'ai' ? 'gerado-ia' : getMediaCategory(m.type);
    if (tipoFiltro !== 'todos' && cat !== tipoFiltro) return false;
    if (busca && !m.filename.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        await api.post('/media/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast({
          title: t('pages.media.uploadDone'),
          description: t('pages.media.uploadDoneDesc', { name: file.name }),
        });
      } catch (err: any) {
        toast({
          title: t('pages.media.uploadError'),
          description: formatApiError(err) || t('pages.media.uploadErrorDesc', { name: file.name }),
          variant: 'destructive',
        });
      }
    }

    setIsUploading(false);
    setUploadDialogAberto(false);
    fetchMidias();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleUpload(e.dataTransfer.files);
  };

  const handleDownload = (item: MediaItem) => {
    window.open(item.url, '_blank');
  };

  const handleDeletar = async (item: MediaItem) => {
    try {
      await api.delete(`/media/${item.id}`);
      toast({
        title: t('pages.media.deleted'),
        description: t('pages.media.deletedDesc', { name: item.filename }),
      });
      fetchMidias();
    } catch (err: any) {
      toast({
        title: t('pages.media.deleteError'),
        description: formatApiError(err) || t('pages.media.deleteErrorDesc'),
        variant: 'destructive',
      });
    }
  };

  const handleReutilizar = (item: MediaItem) => {
    navigator.clipboard.writeText(item.url);
    toast({
      title: t('pages.media.urlCopied'),
      description: t('pages.media.urlCopiedDesc', { name: item.filename }),
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Image className="w-6 h-6 text-primary" />
            {t('pages.media.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('pages.media.subtitle')}
          </p>
        </div>
        <Dialog open={uploadDialogAberto} onOpenChange={setUploadDialogAberto}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Upload className="w-4 h-4" />
              {t('pages.media.uploadBtn')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('pages.media.uploadTitle')}</DialogTitle>
              <DialogDescription>
                {t('pages.media.uploadDesc')}
              </DialogDescription>
            </DialogHeader>
            <div
              className="border-2 border-dashed rounded-xl p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="w-10 h-10 text-primary mx-auto mb-3 animate-spin" />
              ) : (
                <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              )}
              <p className="text-sm font-medium">
                {isUploading ? t('pages.media.uploading') : t('pages.media.dragDrop')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('pages.media.fileHint')}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm"
                onChange={(e) => handleUpload(e.target.files)}
              />
              {!isUploading && (
                <Button variant="outline" className="mt-4" type="button">
                  {t('pages.media.selectFiles')}
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('pages.media.searchPlaceholder')}
            className="pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
          <SelectTrigger className="w-[160px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder={t('pages.media.filterPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">{t('pages.media.filterAll')}</SelectItem>
            <SelectItem value="imagem">{t('pages.media.filterImages')}</SelectItem>
            <SelectItem value="video">{t('pages.media.filterVideos')}</SelectItem>
            <SelectItem value="gerado-ia">{t('pages.media.filterAI')}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex border rounded-lg">
          <Button
            variant={visualizacao === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className="rounded-r-none h-10"
            onClick={() => setVisualizacao('grid')}
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button
            variant={visualizacao === 'lista' ? 'secondary' : 'ghost'}
            size="icon"
            className="rounded-l-none h-10"
            onClick={() => setVisualizacao('lista')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Contadores */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>{t('pages.media.countItems', { n: midiasFiltradas.length })}</span>
        <span>•</span>
        <span>{t('pages.media.countImages', { n: midiasFiltradas.filter((m) => m.type.startsWith('image/')).length })}</span>
        <span>•</span>
        <span>{t('pages.media.countVideos', { n: midiasFiltradas.filter((m) => m.type.startsWith('video/')).length })}</span>
        <span>•</span>
        <span>{t('pages.media.countAI', { n: midiasFiltradas.filter((m) => m.source === 'ai').length })}</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : midiasFiltradas.length === 0 ? (
        <Card className="rounded-xl">
          <CardContent className="p-12 text-center text-muted-foreground">
            <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">{t('pages.media.emptyTitle')}</p>
            <p className="text-sm mt-1">{t('pages.media.emptyDesc')}</p>
          </CardContent>
        </Card>
      ) : visualizacao === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {midiasFiltradas.map((item) => {
            const cat = item.source === 'ai' ? 'gerado-ia' : getMediaCategory(item.type);
            return (
              <Card key={item.id} className="rounded-xl overflow-hidden group hover:shadow-md transition-shadow">
                <div className="relative aspect-square overflow-hidden bg-muted">
                  {item.type.startsWith('video/') ? (
                    <video src={item.url} className="w-full h-full object-cover" muted />
                  ) : (
                    <img
                      src={item.url}
                      alt={item.filename}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => handleReutilizar(item)}>
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => handleDownload(item)}>
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleDeletar(item)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className="gap-1 text-[10px] bg-background/80 backdrop-blur-sm">
                      {iconesTipo[cat]}
                      {cat === 'gerado-ia' ? 'IA' : cat === 'imagem' ? 'IMG' : 'VID'}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-3">
                  <p className="text-sm font-medium truncate">{item.filename}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatarTamanho(item.size)} • {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="rounded-xl">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left font-medium text-muted-foreground p-4">{t('pages.media.colFile')}</th>
                  <th className="text-left font-medium text-muted-foreground p-4">{t('pages.media.colType')}</th>
                  <th className="text-left font-medium text-muted-foreground p-4">{t('pages.media.colSize')}</th>
                  <th className="text-left font-medium text-muted-foreground p-4">{t('pages.media.colDate')}</th>
                  <th className="text-right font-medium text-muted-foreground p-4">{t('pages.media.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {midiasFiltradas.map((item) => {
                  const cat = item.source === 'ai' ? 'gerado-ia' : getMediaCategory(item.type);
                  return (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {item.type.startsWith('image/') ? (
                            <img src={item.url} alt={item.filename} className="w-10 h-10 rounded-lg object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                              <Video className="w-4 h-4" />
                            </div>
                          )}
                          <span className="font-medium">{item.filename}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className="gap-1 capitalize">
                          {iconesTipo[cat]}
                          {cat === 'gerado-ia' ? t('pages.media.labelGenAI') : cat}
                        </Badge>
                      </td>
                      <td className="p-4 text-muted-foreground">{formatarTamanho(item.size)}</td>
                      <td className="p-4 text-muted-foreground">{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</td>
                      <td className="p-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleReutilizar(item)}>
                              <RefreshCw className="w-4 h-4 mr-2" />
                              {t('pages.media.copyUrl')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload(item)}>
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeletar(item)} className="text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" />
                              {t('pages.media.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
