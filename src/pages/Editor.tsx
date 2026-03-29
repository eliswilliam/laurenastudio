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
  Droplets,
  Palette,
  Maximize2,
  FlipHorizontal,
  FlipVertical,
  Move,
  ScanLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type Tool = 'crop' | 'text' | 'adjust' | 'filter';

const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Roboto:wght@400;700&family=Montserrat:wght@400;700&family=Playfair+Display:wght@400;700&family=Oswald:wght@400;700&family=Merriweather:wght@400;700&family=Lora:wght@400;700&family=Open+Sans:wght@400;700&display=swap';

const FONT_OPTIONS = [
  { label: 'Inter', value: '"Inter", system-ui, sans-serif' },
  { label: 'Roboto', value: '"Roboto", sans-serif' },
  { label: 'Montserrat', value: '"Montserrat", sans-serif' },
  { label: 'Playfair Display', value: '"Playfair Display", Georgia, serif' },
  { label: 'Oswald', value: '"Oswald", sans-serif' },
  { label: 'Merriweather', value: '"Merriweather", Georgia, serif' },
  { label: 'Lora', value: '"Lora", Georgia, serif' },
  { label: 'Open Sans', value: '"Open Sans", sans-serif' },
] as const;

interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: number;
  opacity: number;
  rotation: number;
  strokeColor: string | null;
  strokeWidth: number;
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

function measureTextWidth(ctx: CanvasRenderingContext2D, t: Pick<TextOverlay, 'text' | 'fontSize' | 'fontFamily' | 'fontWeight'>): number {
  ctx.save();
  ctx.font = `${t.fontWeight} ${t.fontSize}px ${t.fontFamily}`;
  const w = ctx.measureText(t.text).width;
  ctx.restore();
  return w;
}

function hitTestText(x: number, y: number, t: TextOverlay, ctx: CanvasRenderingContext2D): boolean {
  const w = measureTextWidth(ctx, t);
  const pad = 10;
  if (!t.rotation) {
    return (
      x >= t.x - pad &&
      x <= t.x + w + pad &&
      y >= t.y - t.fontSize - pad &&
      y <= t.y + pad
    );
  }
  const diag = Math.hypot(w, t.fontSize) * 0.65;
  const cx = t.x + w / 2;
  const cy = t.y - t.fontSize / 2;
  return x >= cx - diag && x <= cx + diag && y >= cy - diag && y <= cy + diag;
}

export default function Editor() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(
    null
  );

  const { mediaUrl, mediaType } = (location.state as { mediaUrl?: string; mediaType?: string }) || {};

  const [tool, setTool] = useState<Tool>('adjust');
  const [zoom, setZoom] = useState(1);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [hueRotate, setHueRotate] = useState(0);
  const [imageBlur, setImageBlur] = useState(0);
  const [vignette, setVignette] = useState(false);
  const [activeFilter, setActiveFilter] = useState('none');
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [newText, setNewText] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textSize, setTextSize] = useState(32);
  const [newFontFamily, setNewFontFamily] = useState<string>(FONT_OPTIONS[0].value);
  const [newFontWeight, setNewFontWeight] = useState(700);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const updateOverlay = useCallback((id: string, patch: Partial<TextOverlay>) => {
    setTextOverlays((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

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

    const adjustFilter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hueRotate}deg) blur(${imageBlur}px)`;
    const fullFilter = activeFilter !== 'none' ? `${activeFilter} ${adjustFilter}` : adjustFilter;
    ctx.filter = fullFilter;

    if (flipH || flipV) {
      ctx.translate(flipH ? canvas.width : 0, flipV ? canvas.height : 0);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    }

    ctx.drawImage(img, 0, 0);
    ctx.restore();

    if (vignette) {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const r = Math.max(canvas.width, canvas.height) * 0.85;
      const g = ctx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.42)');
      ctx.save();
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    ctx.filter = 'none';
    textOverlays.forEach((overlay) => {
      ctx.save();
      ctx.globalAlpha = overlay.opacity;
      ctx.translate(overlay.x, overlay.y);
      ctx.rotate((overlay.rotation * Math.PI) / 180);
      ctx.translate(-overlay.x, -overlay.y);
      ctx.font = `${overlay.fontWeight} ${overlay.fontSize}px ${overlay.fontFamily}`;
      if (overlay.strokeWidth > 0 && overlay.strokeColor) {
        ctx.strokeStyle = overlay.strokeColor;
        ctx.lineWidth = overlay.strokeWidth;
        ctx.lineJoin = 'round';
        ctx.shadowColor = 'transparent';
        ctx.strokeText(overlay.text, overlay.x, overlay.y);
      }
      ctx.fillStyle = overlay.color;
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.fillText(overlay.text, overlay.x, overlay.y);
      ctx.restore();
    });

    if (selectedTextId && textOverlays.some((t) => t.id === selectedTextId)) {
      const t = textOverlays.find((x) => x.id === selectedTextId)!;
      const w = measureTextWidth(ctx, t);
      ctx.save();
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      if (!t.rotation) {
        ctx.strokeRect(t.x - 4, t.y - t.fontSize - 4, w + 8, t.fontSize + 8);
      } else {
        const pad = 8;
        ctx.strokeRect(t.x - pad, t.y - t.fontSize - pad, w + pad * 2, t.fontSize + pad * 2);
      }
      ctx.restore();
    }
  }, [
    brightness,
    contrast,
    saturation,
    hueRotate,
    imageBlur,
    vignette,
    activeFilter,
    textOverlays,
    flipH,
    flipV,
    imageLoaded,
    selectedTextId,
  ]);

  useEffect(() => {
    const id = 'laurena-editor-google-fonts';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = GOOGLE_FONTS_HREF;
      document.head.appendChild(link);
    }
  }, []);

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

  useEffect(() => {
    if (!imageLoaded) return;
    let alive = true;
    void document.fonts.ready.then(() => {
      if (alive) drawCanvas();
    });
    return () => {
      alive = false;
    };
  }, [imageLoaded, drawCanvas]);

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement> | PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const pickTextAt = (x: number, y: number): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    for (let i = textOverlays.length - 1; i >= 0; i--) {
      if (hitTestText(x, y, textOverlays[i], ctx)) return textOverlays[i].id;
    }
    return null;
  };

  const onCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!imageLoaded || textOverlays.length === 0) return;
    const { x, y } = getCanvasCoords(e);
    const id = pickTextAt(x, y);
    if (!id) {
      setSelectedTextId(null);
      return;
    }
    const t = textOverlays.find((o) => o.id === id);
    if (!t) return;
    setSelectedTextId(id);
    dragRef.current = { id, startX: x, startY: y, origX: t.x, origY: t.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.style.cursor = 'grabbing';
  };

  const onCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (dragRef.current) {
      const { x, y } = getCanvasCoords(e);
      const d = dragRef.current;
      const dx = x - d.startX;
      const dy = y - d.startY;
      setTextOverlays((prev) =>
        prev.map((t) => (t.id === d.id ? { ...t, x: d.origX + dx, y: d.origY + dy } : t))
      );
      return;
    }

    if (textOverlays.length === 0) return;
    const { x, y } = getCanvasCoords(e);
    const id = pickTextAt(x, y);
    canvas.style.cursor = id ? 'grab' : 'default';
  };

  const onCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      dragRef.current = null;
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* ignore */
      }
    }
    e.currentTarget.style.cursor = 'default';
  };

  const addTextOverlay = () => {
    if (!newText.trim()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const id = Date.now().toString();
    setTextOverlays((prev) => [
      ...prev,
      {
        id,
        text: newText,
        x: canvas.width / 2 - 80,
        y: canvas.height / 2,
        fontSize: textSize,
        color: textColor,
        fontFamily: newFontFamily,
        fontWeight: newFontWeight,
        opacity: 1,
        rotation: 0,
        strokeColor: null,
        strokeWidth: 0,
      },
    ]);
    setSelectedTextId(id);
    setNewText('');
  };

  const removeTextOverlay = (id: string) => {
    setTextOverlays((prev) => prev.filter((t) => t.id !== id));
    setSelectedTextId((s) => (s === id ? null : s));
  };

  const selectedOverlay = selectedTextId ? textOverlays.find((t) => t.id === selectedTextId) : undefined;

  const resetAdjustments = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setHueRotate(0);
    setImageBlur(0);
    setVignette(false);
    setActiveFilter('none');
    setFlipH(false);
    setFlipV(false);
    setTextOverlays([]);
    setSelectedTextId(null);
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
        <Button variant="outline" onClick={() => navigate(-1)}>
          Voltar
        </Button>
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
      <div className="flex items-center justify-between flex-wrap gap-2">
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

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Move className="w-3.5 h-3.5 shrink-0" />
        Arraste os textos sobre a imagem para posicionar. Selecione um texto na lista para ajustar fonte, contorno e rotação.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[64px_1fr_300px] gap-4">
        <div className="flex lg:flex-col gap-1 bg-card border rounded-xl p-2">
          {tools.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTool(key)}
              title={label}
              className={cn(
                'w-12 h-12 rounded-lg flex items-center justify-center transition-colors',
                tool === key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="w-5 h-5" />
            </button>
          ))}
        </div>

        <div className="bg-muted/30 rounded-xl border overflow-auto flex items-center justify-center p-4 min-h-[400px]">
          <canvas
            ref={canvasRef}
            className="max-w-full max-h-[70vh] rounded-lg shadow-md touch-none"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onPointerLeave={(e) => {
              onCanvasPointerUp(e);
              if (canvasRef.current) canvasRef.current.style.cursor = 'default';
            }}
          />
        </div>

        <Card className="rounded-xl max-h-[85vh] overflow-y-auto">
          <CardContent className="p-4 space-y-5">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium flex-1 text-center">{Math.round(zoom * 100)}%</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>

            {tool === 'adjust' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Sun className="w-4 h-4" /> Ajustes
                </h3>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Brilho</Label>
                      <span className="text-xs text-muted-foreground">{brightness}%</span>
                    </div>
                    <Slider value={[brightness]} onValueChange={([v]) => setBrightness(v)} min={0} max={200} step={1} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Contraste</Label>
                      <span className="text-xs text-muted-foreground">{contrast}%</span>
                    </div>
                    <Slider value={[contrast]} onValueChange={([v]) => setContrast(v)} min={0} max={200} step={1} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Saturação</Label>
                      <span className="text-xs text-muted-foreground">{saturation}%</span>
                    </div>
                    <Slider value={[saturation]} onValueChange={([v]) => setSaturation(v)} min={0} max={200} step={1} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs flex items-center gap-1">
                        <ScanLine className="w-3 h-3" /> Matiz (hue)
                      </Label>
                      <span className="text-xs text-muted-foreground">{hueRotate}°</span>
                    </div>
                    <Slider value={[hueRotate]} onValueChange={([v]) => setHueRotate(v)} min={0} max={360} step={1} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Desfoque</Label>
                      <span className="text-xs text-muted-foreground">{imageBlur}px</span>
                    </div>
                    <Slider value={[imageBlur]} onValueChange={([v]) => setImageBlur(v)} min={0} max={12} step={0.5} />
                  </div>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={vignette}
                      onChange={(e) => setVignette(e.target.checked)}
                      className="rounded border-input"
                    />
                    Vinheta (escurecer bordas)
                  </label>
                </div>
              </div>
            )}

            {tool === 'filter' && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Filtros</h3>
                <div className="grid grid-cols-2 gap-2">
                  {filters.map((f) => (
                    <button
                      key={f.name}
                      type="button"
                      onClick={() => setActiveFilter(f.value)}
                      className={cn(
                        'px-3 py-2 rounded-lg text-xs font-medium border transition-colors',
                        activeFilter === f.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/40'
                      )}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tool === 'text' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Adicionar texto</h3>
                <Input
                  placeholder="Digite o texto…"
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                />
                <div className="space-y-2">
                  <Label className="text-xs">Fonte</Label>
                  <Select value={newFontFamily} onValueChange={setNewFontFamily}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Fonte" />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map((f) => (
                        <SelectItem key={f.value} value={f.value} className="text-xs">
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <Label>Peso</Label>
                    <span className="text-muted-foreground">{newFontWeight}</span>
                  </div>
                  <Slider
                    value={[newFontWeight]}
                    onValueChange={([v]) => setNewFontWeight(v)}
                    min={400}
                    max={900}
                    step={100}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Cor</Label>
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="w-full h-8 rounded cursor-pointer border border-input"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tamanho</Label>
                    <Input
                      type="number"
                      value={textSize}
                      onChange={(e) => setTextSize(Number(e.target.value))}
                      min={8}
                      max={200}
                    />
                  </div>
                </div>
                <Button className="w-full" size="sm" onClick={addTextOverlay} disabled={!newText.trim()}>
                  Adicionar texto
                </Button>

                {selectedOverlay && (
                  <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <p className="text-xs font-semibold text-primary">Texto selecionado</p>
                    <div className="space-y-2">
                      <Label className="text-xs">Fonte</Label>
                      <Select
                        value={selectedOverlay.fontFamily}
                        onValueChange={(v) => updateOverlay(selectedOverlay.id, { fontFamily: v })}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FONT_OPTIONS.map((f) => (
                            <SelectItem key={f.value} value={f.value} className="text-xs">
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <Label>Peso</Label>
                        <span className="text-muted-foreground">{selectedOverlay.fontWeight}</span>
                      </div>
                      <Slider
                        value={[selectedOverlay.fontWeight]}
                        onValueChange={([v]) => updateOverlay(selectedOverlay.id, { fontWeight: v })}
                        min={400}
                        max={900}
                        step={100}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Cor</Label>
                        <input
                          type="color"
                          value={selectedOverlay.color}
                          onChange={(e) => updateOverlay(selectedOverlay.id, { color: e.target.value })}
                          className="w-full h-8 rounded cursor-pointer border border-input"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Tamanho</Label>
                        <Input
                          type="number"
                          value={selectedOverlay.fontSize}
                          onChange={(e) =>
                            updateOverlay(selectedOverlay.id, { fontSize: Number(e.target.value) || 12 })
                          }
                          min={8}
                          max={200}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <Label>Opacidade</Label>
                        <span className="text-muted-foreground">{Math.round(selectedOverlay.opacity * 100)}%</span>
                      </div>
                      <Slider
                        value={[selectedOverlay.opacity * 100]}
                        onValueChange={([v]) => updateOverlay(selectedOverlay.id, { opacity: v / 100 })}
                        min={5}
                        max={100}
                        step={1}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <Label>Rotação</Label>
                        <span className="text-muted-foreground">{selectedOverlay.rotation}°</span>
                      </div>
                      <Slider
                        value={[selectedOverlay.rotation]}
                        onValueChange={([v]) => updateOverlay(selectedOverlay.id, { rotation: v })}
                        min={-180}
                        max={180}
                        step={1}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Contorno (cor)</Label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={selectedOverlay.strokeColor ?? '#000000'}
                          onChange={(e) => updateOverlay(selectedOverlay.id, { strokeColor: e.target.value })}
                          className="w-10 h-8 rounded cursor-pointer border border-input shrink-0"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs h-8"
                          onClick={() => updateOverlay(selectedOverlay.id, { strokeColor: null, strokeWidth: 0 })}
                        >
                          Sem contorno
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <Label>Espessura do contorno</Label>
                        <span className="text-muted-foreground">{selectedOverlay.strokeWidth}px</span>
                      </div>
                      <Slider
                        value={[selectedOverlay.strokeWidth]}
                        onValueChange={([v]) =>
                          updateOverlay(selectedOverlay.id, {
                            strokeWidth: v,
                            strokeColor: v > 0 ? selectedOverlay.strokeColor ?? '#000000' : null,
                          })
                        }
                        min={0}
                        max={12}
                        step={1}
                      />
                    </div>
                  </div>
                )}

                {textOverlays.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Camadas de texto</Label>
                    {textOverlays.map((t) => (
                      <div
                        key={t.id}
                        className={cn(
                          'flex items-center justify-between rounded-lg px-2 py-1.5 text-xs border cursor-pointer',
                          selectedTextId === t.id ? 'border-primary bg-primary/5' : 'border-transparent bg-muted/50'
                        )}
                        onClick={() => setSelectedTextId(t.id)}
                      >
                        <span className="truncate pr-2">{t.text}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTextOverlay(t.id);
                          }}
                          className="text-destructive hover:text-destructive/80 shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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
                    Zoom 100%
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
