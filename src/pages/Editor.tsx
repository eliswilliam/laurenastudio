import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Crop,
  Type,
  SlidersHorizontal,
  Download,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Sun,
  Contrast,
  Droplets,
  Palette,
  Maximize2,
  FlipHorizontal,
  FlipVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

type Tool = 'select' | 'crop' | 'text' | 'adjust' | 'filter';

interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
}

const filters = [
  { name: 'Original', value: 'none' },
  { name: 'Grayscale', value: 'grayscale(100%)' },
  { name: 'Sépia', value: 'sepia(80%)' },
  { name: 'Vintage', value: 'sepia(40%) contrast(110%) brightness(90%)' },
  { name: 'Frio', value: 'saturate(80%) hue-rotate(180deg) brightness(105%)' },
  { name: 'Quente', value: 'saturate(130%) hue-rotate(-10deg) brightness(105%)' },
  { name: 'Dramático', value: 'contrast(150%) saturate(120%) brightness(90%)' },
  { name: 'Suave', value: 'contrast(90%) brightness(110%) saturate(80%)' },
];

export default function Editor() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const { mediaUrl, mediaType } = (location.state as { mediaUrl?: string; mediaType?: string }) || {};

  const [tool, setTool] = useState<Tool>('select');
  const [zoom, setZoom] = useState(1);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [activeFilter, setActiveFilter] = useState('none');
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [newText, setNewText] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textSize, setTextSize] = useState(32);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !imageLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    const adjustFilter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    const fullFilter = activeFilter !== 'none' ? `${activeFilter} ${adjustFilter}` : adjustFilter;
    ctx.filter = fullFilter;

    if (flipH || flipV) {
      ctx.translate(flipH ? canvas.width : 0, flipV ? canvas.height : 0);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    }

    ctx.drawImage(img, 0, 0);
    ctx.restore();

    ctx.filter = 'none';
    textOverlays.forEach((overlay) => {
      ctx.font = `bold ${overlay.fontSize}px ${overlay.fontFamily}`;
      ctx.fillStyle = overlay.color;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.fillText(overlay.text, overlay.x, overlay.y);
      ctx.shadowColor = 'transparent';
    });
  }, [brightness, contrast, saturation, activeFilter, textOverlays, flipH, flipV, imageLoaded]);

  useEffect(() => {
    if (!mediaUrl || mediaType === 'video') return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.src = mediaUrl;
  }, [mediaUrl, mediaType]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const addTextOverlay = () => {
    if (!newText.trim()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    setTextOverlays((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        text: newText,
        x: canvas.width / 2 - 100,
        y: canvas.height / 2,
        fontSize: textSize,
        color: textColor,
        fontFamily: 'Arial',
      },
    ]);
    setNewText('');
  };

  const removeTextOverlay = (id: string) => {
    setTextOverlays((prev) => prev.filter((t) => t.id !== id));
  };

  const resetAdjustments = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setActiveFilter('none');
    setFlipH(false);
    setFlipV(false);
    setTextOverlays([]);
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `laurena-edited-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast({ title: 'Imagem salva!', description: 'O arquivo foi baixado.' });
  };

  if (!mediaUrl) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fade-in">
        <p className="text-muted-foreground">Nenhuma mídia para editar.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Voltar</Button>
      </div>
    );
  }

  if (mediaType === 'video') {
    return (
      <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Editor de Vídeo</h1>
        </div>
        <Card className="rounded-xl">
          <CardContent className="p-6 space-y-4">
            <video src={mediaUrl} controls className="w-full rounded-xl border" />
            <p className="text-sm text-muted-foreground text-center">
              O editor avançado de vídeo estará disponível em breve. Por enquanto, baixe o vídeo para editar externamente.
            </p>
            <a href={mediaUrl} download target="_blank" rel="noopener noreferrer">
              <Button className="w-full gap-2">
                <Download className="w-4 h-4" />
                Baixar Vídeo
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tools: { key: Tool; icon: typeof Crop; label: string }[] = [
    { key: 'adjust', icon: SlidersHorizontal, label: 'Ajustes' },
    { key: 'filter', icon: Palette, label: 'Filtros' },
    { key: 'text', icon: Type, label: 'Texto' },
    { key: 'crop', icon: Crop, label: 'Transformar' },
  ];

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Editor de Imagem</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={resetAdjustments}>
            <RotateCcw className="w-4 h-4" />
            Resetar
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handleDownload}>
            <Download className="w-4 h-4" />
            Exportar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[64px_1fr_280px] gap-4">
        {/* Tool sidebar */}
        <div className="flex lg:flex-col gap-1 bg-card border rounded-xl p-2">
          {tools.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setTool(key)}
              title={label}
              className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors ${
                tool === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="w-5 h-5" />
            </button>
          ))}
        </div>

        {/* Canvas */}
        <div className="bg-muted/30 rounded-xl border overflow-auto flex items-center justify-center p-4 min-h-[400px]">
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-[70vh] rounded-lg shadow-md"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
          />
        </div>

        {/* Properties panel */}
        <Card className="rounded-xl">
          <CardContent className="p-4 space-y-5">
            {/* Zoom */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))}>
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium flex-1 text-center">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(3, z + 0.1))}>
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>

            {/* Adjust */}
            {tool === 'adjust' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Ajustes</h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs flex items-center gap-1"><Sun className="w-3.5 h-3.5" /> Brilho</Label>
                      <span className="text-xs text-muted-foreground">{brightness}%</span>
                    </div>
                    <Slider value={[brightness]} onValueChange={([v]) => setBrightness(v)} min={0} max={200} step={1} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs flex items-center gap-1"><Contrast className="w-3.5 h-3.5" /> Contraste</Label>
                      <span className="text-xs text-muted-foreground">{contrast}%</span>
                    </div>
                    <Slider value={[contrast]} onValueChange={([v]) => setContrast(v)} min={0} max={200} step={1} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs flex items-center gap-1"><Droplets className="w-3.5 h-3.5" /> Saturação</Label>
                      <span className="text-xs text-muted-foreground">{saturation}%</span>
                    </div>
                    <Slider value={[saturation]} onValueChange={([v]) => setSaturation(v)} min={0} max={200} step={1} />
                  </div>
                </div>
              </div>
            )}

            {/* Filters */}
            {tool === 'filter' && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Filtros</h3>
                <div className="grid grid-cols-2 gap-2">
                  {filters.map((f) => (
                    <button
                      key={f.name}
                      onClick={() => setActiveFilter(f.value)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        activeFilter === f.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Text */}
            {tool === 'text' && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Adicionar Texto</h3>
                <Input
                  placeholder="Digite o texto…"
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Cor</Label>
                    <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-full h-8 rounded cursor-pointer" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tamanho</Label>
                    <Input type="number" value={textSize} onChange={(e) => setTextSize(Number(e.target.value))} min={8} max={200} />
                  </div>
                </div>
                <Button className="w-full" size="sm" onClick={addTextOverlay} disabled={!newText.trim()}>
                  Adicionar Texto
                </Button>
                {textOverlays.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    <Label className="text-xs text-muted-foreground">Textos adicionados</Label>
                    {textOverlays.map((t) => (
                      <div key={t.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-2 py-1.5 text-xs">
                        <span className="truncate">{t.text}</span>
                        <button onClick={() => removeTextOverlay(t.id)} className="text-destructive hover:text-destructive/80 ml-2 shrink-0">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Transform */}
            {tool === 'crop' && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Transformar</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setFlipH(!flipH)}>
                    <FlipHorizontal className="w-4 h-4" />
                    Flip H
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setFlipV(!flipV)}>
                    <FlipVertical className="w-4 h-4" />
                    Flip V
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5 col-span-2" onClick={() => setZoom(1)}>
                    <Maximize2 className="w-4 h-4" />
                    Tamanho Original
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
