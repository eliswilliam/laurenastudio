import { useState } from 'react';
import {
  Image,
  Video,
  Sparkles,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  Search,
  Grid3X3,
  List,
  Filter,
  MoreVertical,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ItemMidia, TipoMidia } from '@/lib/types';

const midiasMock: ItemMidia[] = [
  { id: '1', nome: 'Post Black Friday', tipo: 'imagem', url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&h=400&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=300&h=300&fit=crop', tamanho: 2400000, criadoEm: '2026-03-01', tags: ['promoção', 'ecommerce'] },
  { id: '2', nome: 'Banner IA Generativa', tipo: 'gerado-ia', url: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=400&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=300&h=300&fit=crop', tamanho: 1800000, criadoEm: '2026-02-28', tags: ['ia', 'tecnologia'] },
  { id: '3', nome: 'Vídeo Institucional', tipo: 'video', url: 'https://images.unsplash.com/photo-1536240478700-b869070f9279?w=400&h=300&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1536240478700-b869070f9279?w=300&h=200&fit=crop', tamanho: 15000000, criadoEm: '2026-02-25', tags: ['institucional', 'marca'] },
  { id: '4', nome: 'Story Motivacional', tipo: 'gerado-ia', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=300&fit=crop', tamanho: 890000, criadoEm: '2026-02-24', tags: ['motivacional', 'story'] },
  { id: '5', nome: 'Feed Produto Novo', tipo: 'imagem', url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop', tamanho: 3200000, criadoEm: '2026-02-22', tags: ['produto', 'lançamento'] },
  { id: '6', nome: 'Carrossel Dicas', tipo: 'imagem', url: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=400&h=400&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=300&h=300&fit=crop', tamanho: 4100000, criadoEm: '2026-02-20', tags: ['dicas', 'carrossel'] },
  { id: '7', nome: 'Thumbnail YouTube', tipo: 'gerado-ia', url: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=225&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=300&h=170&fit=crop', tamanho: 1200000, criadoEm: '2026-02-18', tags: ['youtube', 'thumbnail'] },
  { id: '8', nome: 'Reel Tendências', tipo: 'video', url: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=400&h=400&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=300&h=300&fit=crop', tamanho: 8500000, criadoEm: '2026-02-15', tags: ['reel', 'tendências'] },
  { id: '9', nome: 'Post Equipe', tipo: 'imagem', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=300&fit=crop', thumbnailUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=300&h=225&fit=crop', tamanho: 2900000, criadoEm: '2026-02-12', tags: ['equipe', 'empresa'] },
];

function formatarTamanho(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const iconesTipo: Record<TipoMidia, React.ReactNode> = {
  imagem: <Image className="w-3.5 h-3.5" />,
  video: <Video className="w-3.5 h-3.5" />,
  'gerado-ia': <Sparkles className="w-3.5 h-3.5" />,
};

export default function BibliotecaMidia() {
  const [busca, setBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<string>('todos');
  const [visualizacao, setVisualizacao] = useState<'grid' | 'lista'>('grid');
  const [uploadDialogAberto, setUploadDialogAberto] = useState(false);
  const { toast } = useToast();

  const midiasFiltradas = midiasMock.filter((m) => {
    if (tipoFiltro !== 'todos' && m.tipo !== tipoFiltro) return false;
    if (busca && !m.nome.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  const handleDownload = (item: ItemMidia) => {
    toast({ title: 'Download iniciado', description: `Baixando ${item.nome}...` });
  };

  const handleDeletar = (item: ItemMidia) => {
    toast({ title: 'Mídia deletada', description: `${item.nome} foi removido da biblioteca.` });
  };

  const handleReutilizar = (item: ItemMidia) => {
    toast({ title: 'Mídia copiada', description: `${item.nome} está pronto para uso em um novo post.` });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Image className="w-6 h-6 text-primary" />
            Biblioteca de Mídia
          </h1>
          <p className="text-muted-foreground">
            Gerencie imagens, vídeos e conteúdos gerados por IA.
          </p>
        </div>
        <Dialog open={uploadDialogAberto} onOpenChange={setUploadDialogAberto}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Upload className="w-4 h-4" />
              Fazer Upload
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload de Mídia</DialogTitle>
              <DialogDescription>
                Arraste arquivos ou clique para enviar.
              </DialogDescription>
            </DialogHeader>
            <div className="border-2 border-dashed rounded-xl p-12 text-center hover:border-primary/50 transition-colors cursor-pointer">
              <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">Arraste e solte arquivos aqui</p>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG, GIF, MP4 até 50MB
              </p>
              <Button variant="outline" className="mt-4">
                Selecionar Arquivos
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar mídia..."
            className="pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
          <SelectTrigger className="w-[160px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="imagem">Imagens</SelectItem>
            <SelectItem value="video">Vídeos</SelectItem>
            <SelectItem value="gerado-ia">Gerados por IA</SelectItem>
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
        <span>{midiasFiltradas.length} itens</span>
        <span>•</span>
        <span>{midiasFiltradas.filter((m) => m.tipo === 'imagem').length} imagens</span>
        <span>•</span>
        <span>{midiasFiltradas.filter((m) => m.tipo === 'video').length} vídeos</span>
        <span>•</span>
        <span>{midiasFiltradas.filter((m) => m.tipo === 'gerado-ia').length} gerados por IA</span>
      </div>

      {/* Grid de mídias */}
      {visualizacao === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {midiasFiltradas.map((item) => (
            <Card key={item.id} className="rounded-xl overflow-hidden group hover:shadow-md transition-shadow">
              <div className="relative aspect-square overflow-hidden bg-muted">
                <img
                  src={item.thumbnailUrl}
                  alt={item.nome}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {/* Overlay com ações */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleReutilizar(item)}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDownload(item)}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDeletar(item)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                {/* Badge de tipo */}
                <div className="absolute top-2 left-2">
                  <Badge variant="secondary" className="gap-1 text-[10px] bg-background/80 backdrop-blur-sm">
                    {iconesTipo[item.tipo]}
                    {item.tipo === 'gerado-ia' ? 'IA' : item.tipo === 'imagem' ? 'IMG' : 'VID'}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-3">
                <p className="text-sm font-medium truncate">{item.nome}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatarTamanho(item.tamanho)} • {item.criadoEm}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="rounded-xl">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left font-medium text-muted-foreground p-4">Arquivo</th>
                  <th className="text-left font-medium text-muted-foreground p-4">Tipo</th>
                  <th className="text-left font-medium text-muted-foreground p-4">Tamanho</th>
                  <th className="text-left font-medium text-muted-foreground p-4">Data</th>
                  <th className="text-left font-medium text-muted-foreground p-4">Tags</th>
                  <th className="text-right font-medium text-muted-foreground p-4">Ações</th>
                </tr>
              </thead>
              <tbody>
                {midiasFiltradas.map((item) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.thumbnailUrl}
                          alt={item.nome}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                        <span className="font-medium">{item.nome}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="gap-1 capitalize">
                        {iconesTipo[item.tipo]}
                        {item.tipo === 'gerado-ia' ? 'Gerado IA' : item.tipo}
                      </Badge>
                    </td>
                    <td className="p-4 text-muted-foreground">{formatarTamanho(item.tamanho)}</td>
                    <td className="p-4 text-muted-foreground">{item.criadoEm}</td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        {item.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </td>
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
                            Reutilizar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownload(item)}>
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeletar(item)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Deletar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
