import { useEffect, useState } from 'react';
import {
  Settings,
  User,
  Palette,
  Link2,
  Globe,
  Save,
  Camera,
  Plus,
  Trash2,
  Check,
  ExternalLink,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Download,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiMe, apiUpdateProfile } from '@/lib/authApi';
import { useAuthStore } from '@/store/useAuthStore';

const contasSociais = [
  { id: '1', plataforma: 'Instagram', nome: '@laurena.studio', conectada: true, cor: '#E1306C' },
  { id: '2', plataforma: 'Facebook', nome: 'Laurena Studio Page', conectada: true, cor: '#1877F2' },
  { id: '3', plataforma: 'Twitter/X', nome: '@laurenastudio', conectada: true, cor: '#000000' },
  { id: '4', plataforma: 'LinkedIn', nome: 'Laurena Studio', conectada: false, cor: '#0A66C2' },
  { id: '5', plataforma: 'TikTok', nome: '', conectada: false, cor: '#000000' },
  { id: '6', plataforma: 'YouTube', nome: '', conectada: false, cor: '#FF0000' },
];

export default function Configuracoes() {
  const { toast } = useToast();
  const atualizarUsuario = useAuthStore((s) => s.atualizarUsuario);

  // ── State para dialogs/modals ─────────────────────────────────────────────
  const [carregandoDeletion, setCarregandoDeletion] = useState(false);

  // ── Profile state ─────────────────────────────────────────────────────────
  const [carregandoPerfil, setCarregandoPerfil] = useState(true);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);

  const [perfil, setPerfil] = useState({
    nome: '',
    email: '',
    telefone: '',
    bio: '',
    avatarUrl: '',
  });

  const [senha, setSenha] = useState({
    atual: '',
    nova: '',
    confirmar: '',
  });
  const [mostrarSenha, setMostrarSenha] = useState(false);

  // ── Branding + notifications (local state, not persisted to DB yet) ───────
  const [branding, setBranding] = useState({
    corPrimaria: '#C15F3C',
    corSecundaria: '#B1ADA1',
    fonte: 'Inter',
    tomVoz: 'profissional',
    assinatura: 'Equipe Laurena Studio',
  });

  const [notificacoes, setNotificacoes] = useState({
    email: true,
    push: true,
    postPublicado: true,
    relatorioSemanal: true,
    erroPublicacao: true,
    novoComentario: false,
    limiteUso: true,
  });

  // ── Load real user on mount ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await apiMe();
        if (cancelled) return;
        setPerfil({
          nome: user.full_name ?? '',
          email: user.email,
          telefone: user.phone ?? '',
          bio: user.bio ?? '',
          avatarUrl: user.avatar_url ?? '',
        });
      } catch {
        toast({
          title: 'Erro ao carregar perfil',
          description: 'Não foi possível carregar seus dados. Tente recarregar a página.',
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) setCarregandoPerfil(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Compute initials for avatar ───────────────────────────────────────────
  const initials = perfil.nome
    ? perfil.nome
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : perfil.email.slice(0, 2).toUpperCase();

  // ── Save profile ──────────────────────────────────────────────────────────
  const handleSalvarPerfil = async () => {
    // Validate password change if requested
    if (senha.nova) {
      if (!senha.atual) {
        toast({ title: 'Informe a senha atual', variant: 'destructive' });
        return;
      }
      if (senha.nova.length < 8) {
        toast({ title: 'A nova senha deve ter pelo menos 8 caracteres', variant: 'destructive' });
        return;
      }
      if (senha.nova !== senha.confirmar) {
        toast({ title: 'As senhas não coincidem', variant: 'destructive' });
        return;
      }
    }

    setSalvandoPerfil(true);
    try {
      const updated = await apiUpdateProfile({
        full_name: perfil.nome || null,
        phone: perfil.telefone || null,
        bio: perfil.bio || null,
        avatar_url: perfil.avatarUrl || null,
        ...(senha.nova
          ? { current_password: senha.atual, new_password: senha.nova }
          : {}),
      });

      // Update Zustand store so header/nav reflects new name
      atualizarUsuario({ nome: updated.full_name ?? '', avatar: updated.avatar_url ?? undefined });

      // Clear password fields
      setSenha({ atual: '', nova: '', confirmar: '' });

      toast({ title: 'Perfil atualizado', description: 'Suas informações foram salvas com sucesso.' });
    } catch (err: unknown) {
      toast({
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSalvandoPerfil(false);
    }
  };

  const handleSalvar = (secao: string) => {
    toast({
      title: 'Configurações salvas',
      description: `As configurações de ${secao} foram atualizadas com sucesso.`,
    });
  };

  // ── Open Delete Data Page (with JWT) ───────────────────────────────────────
  const handleOpenDeleteDataPage = async () => {
    setCarregandoDeletion(true);
    try {
      const token = localStorage.getItem('access_token');
      
      // Valida token
      if (!token) {
        toast({
          title: 'Você não está autenticado',
          description: 'Por favor, faça login novamente.',
          variant: 'destructive',
        });
        setCarregandoDeletion(false);
        return;
      }

      console.log('🔍 Tentando acessar /delete-my-data com token...');
      
      // Fetch da página COM o header JWT
      const response = await fetch('/api/v1/webhooks/delete-my-data', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📊 Resposta:', response.status);

      // Se 401, token expirou
      if (response.status === 401) {
        toast({
          title: 'Sessão expirada',
          description: 'Seu token expirou. Faça login novamente.',
          variant: 'destructive',
        });
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        setTimeout(() => window.location.href = '/login', 1500);
        return;
      }

      // Se não 200, erro
      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      // Sucesso! Pega HTML e abre em nova aba
      const htmlContent = await response.text();
      const newWindow = window.open('', '_blank');
      
      if (!newWindow) {
        toast({
          title: 'Bloqueador de pop-ups ativo',
          description: 'Permita pop-ups neste site para acessar a página de exclusão.',
          variant: 'destructive',
        });
        return;
      }

      // Escreve HTML na nova aba
      newWindow.document.write(htmlContent);
      newWindow.document.close();
      
      console.log('✅ Página de exclusão aberta com sucesso!');
      
    } catch (err) {
      console.error('❌ Erro:', err);
      toast({
        title: 'Erro ao acessar página de exclusão',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setCarregandoDeletion(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Configurações
        </h1>
        <p className="text-muted-foreground">
          Gerencie seu perfil, branding e integrações.
        </p>
      </div>

      <Tabs defaultValue="perfil" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-5">
          <TabsTrigger value="perfil" className="gap-1.5 text-xs sm:text-sm">
            <User className="w-3.5 h-3.5" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-1.5 text-xs sm:text-sm">
            <Palette className="w-3.5 h-3.5" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="conexoes" className="gap-1.5 text-xs sm:text-sm">
            <Link2 className="w-3.5 h-3.5" />
            Conexões
          </TabsTrigger>
          <TabsTrigger value="contas" className="gap-1.5 text-xs sm:text-sm">
            <Globe className="w-3.5 h-3.5" />
            Redes
          </TabsTrigger>
          <TabsTrigger value="privacidade" className="gap-1.5 text-xs sm:text-sm">
            <Lock className="w-3.5 h-3.5" />
            Privacidade
          </TabsTrigger>
        </TabsList>

        {/* ── Perfil ── */}
        <TabsContent value="perfil" className="space-y-6">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Informações Pessoais</CardTitle>
              <CardDescription>Atualize seus dados de perfil.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {carregandoPerfil ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Avatar */}
                  <div className="flex items-center gap-4">
                    {perfil.avatarUrl ? (
                      <img
                        src={perfil.avatarUrl}
                        alt={perfil.nome}
                        className="w-20 h-20 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                        {initials}
                      </div>
                    )}
                    <div>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Camera className="w-3.5 h-3.5" />
                        Alterar foto
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">JPG, PNG ou GIF. Máx 5MB.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome completo</Label>
                      <Input
                        value={perfil.nome}
                        onChange={(e) => setPerfil({ ...perfil, nome: e.target.value })}
                        placeholder="Seu nome"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>E-mail</Label>
                      <Input
                        type="email"
                        value={perfil.email}
                        readOnly
                        disabled
                        className="bg-muted/50 cursor-not-allowed"
                        title="O e-mail não pode ser alterado aqui."
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Telefone</Label>
                      <Input
                        value={perfil.telefone}
                        onChange={(e) => setPerfil({ ...perfil, telefone: e.target.value })}
                        placeholder="+55 11 99999-9999"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Bio</Label>
                    <Textarea
                      value={perfil.bio}
                      onChange={(e) => setPerfil({ ...perfil, bio: e.target.value })}
                      rows={3}
                      placeholder="Uma breve descrição sobre você..."
                      maxLength={500}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {perfil.bio.length}/500
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleSalvarPerfil} disabled={salvandoPerfil} className="gap-1.5">
                      {salvandoPerfil ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Salvar Perfil
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Alterar senha ── */}
          {!carregandoPerfil && (
            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Alterar Senha
                </CardTitle>
                <CardDescription>
                  Preencha apenas se quiser alterar sua senha atual.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Senha atual</Label>
                  <div className="relative">
                    <Input
                      type={mostrarSenha ? 'text' : 'password'}
                      value={senha.atual}
                      onChange={(e) => setSenha({ ...senha, atual: e.target.value })}
                      placeholder="••••••••"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarSenha(!mostrarSenha)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nova senha</Label>
                    <Input
                      type={mostrarSenha ? 'text' : 'password'}
                      value={senha.nova}
                      onChange={(e) => setSenha({ ...senha, nova: e.target.value })}
                      placeholder="Mínimo 8 caracteres"
                      minLength={8}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirmar nova senha</Label>
                    <Input
                      type={mostrarSenha ? 'text' : 'password'}
                      value={senha.confirmar}
                      onChange={(e) => setSenha({ ...senha, confirmar: e.target.value })}
                      placeholder="Repita a nova senha"
                    />
                    {senha.confirmar && senha.nova !== senha.confirmar && (
                      <p className="text-xs text-destructive">As senhas não coincidem.</p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={handleSalvarPerfil}
                    disabled={salvandoPerfil || !senha.atual || !senha.nova || senha.nova !== senha.confirmar}
                    variant="outline"
                    className="gap-1.5"
                  >
                    {salvandoPerfil ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                    Alterar Senha
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notificações */}
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Notificações</CardTitle>
              <CardDescription>Escolha como deseja receber alertas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Notificações por e-mail</p>
                  <p className="text-xs text-muted-foreground">Receba atualizações no seu e-mail</p>
                </div>
                <Switch
                  checked={notificacoes.email}
                  onCheckedChange={(v) => setNotificacoes({ ...notificacoes, email: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Notificações push</p>
                  <p className="text-xs text-muted-foreground">Alertas no navegador</p>
                </div>
                <Switch
                  checked={notificacoes.push}
                  onCheckedChange={(v) => setNotificacoes({ ...notificacoes, push: v })}
                />
              </div>
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Tipos de notificação</p>
                {[
                  { key: 'postPublicado', label: 'Post publicado com sucesso' },
                  { key: 'relatorioSemanal', label: 'Relatório semanal de performance' },
                  { key: 'erroPublicacao', label: 'Erro na publicação' },
                  { key: 'novoComentario', label: 'Novo comentário nas postagens' },
                  { key: 'limiteUso', label: 'Alerta de limite de uso' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <span className="text-sm">{item.label}</span>
                    <Switch
                      checked={notificacoes[item.key as keyof typeof notificacoes] as boolean}
                      onCheckedChange={(v) =>
                        setNotificacoes({ ...notificacoes, [item.key]: v })
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => handleSalvar('notificações')} className="gap-1.5">
                  <Save className="w-4 h-4" />
                  Salvar Notificações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding */}
        <TabsContent value="branding" className="space-y-6">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Identidade Visual</CardTitle>
              <CardDescription>
                Personalize a aparência do conteúdo gerado pela IA.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cor primária</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={branding.corPrimaria}
                      onChange={(e) => setBranding({ ...branding, corPrimaria: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer border"
                    />
                    <Input
                      value={branding.corPrimaria}
                      onChange={(e) => setBranding({ ...branding, corPrimaria: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cor secundária</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={branding.corSecundaria}
                      onChange={(e) => setBranding({ ...branding, corSecundaria: e.target.value })}
                      className="w-10 h-10 rounded cursor-pointer border"
                    />
                    <Input
                      value={branding.corSecundaria}
                      onChange={(e) => setBranding({ ...branding, corSecundaria: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Fonte preferida</Label>
                <Select value={branding.fonte} onValueChange={(v) => setBranding({ ...branding, fonte: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Inter">Inter</SelectItem>
                    <SelectItem value="Poppins">Poppins</SelectItem>
                    <SelectItem value="Roboto">Roboto</SelectItem>
                    <SelectItem value="Montserrat">Montserrat</SelectItem>
                    <SelectItem value="Open Sans">Open Sans</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tom de voz padrão</Label>
                <Select value={branding.tomVoz} onValueChange={(v) => setBranding({ ...branding, tomVoz: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="profissional">Profissional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="inspirador">Inspirador</SelectItem>
                    <SelectItem value="humoristico">Humorístico</SelectItem>
                    <SelectItem value="educativo">Educativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Assinatura de posts</Label>
                <Input
                  value={branding.assinatura}
                  onChange={(e) => setBranding({ ...branding, assinatura: e.target.value })}
                  placeholder="Texto de assinatura no rodapé dos posts"
                />
              </div>

              {/* Preview */}
              <div className="border rounded-xl p-4 space-y-3">
                <p className="text-xs text-muted-foreground font-medium">Preview da marca</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg" style={{ backgroundColor: branding.corPrimaria }} />
                  <div className="w-10 h-10 rounded-lg" style={{ backgroundColor: branding.corSecundaria }} />
                  <span style={{ fontFamily: branding.fonte }} className="font-semibold">
                    {branding.fonte}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground italic">
                  Tom: {branding.tomVoz} · Assinatura: {branding.assinatura}
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => handleSalvar('branding')} className="gap-1.5">
                  <Save className="w-4 h-4" />
                  Salvar Branding
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conexões API */}
        <TabsContent value="conexoes" className="space-y-6">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Chaves de API</CardTitle>
              <CardDescription>
                Gerencie suas chaves de API para integrações externas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Chave de Produção</p>
                    <p className="text-xs text-muted-foreground">Criada em 10/01/2026</p>
                  </div>
                  <Badge variant="outline" className="text-green-600 border-green-200">Ativa</Badge>
                </div>
                <div className="flex gap-2">
                  <Input value="lrn_prod_••••••••••••••••••••mk4f" readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="sm">Copiar</Button>
                </div>
              </div>
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Chave de Desenvolvimento</p>
                    <p className="text-xs text-muted-foreground">Criada em 10/01/2026</p>
                  </div>
                  <Badge variant="outline" className="text-yellow-600 border-yellow-200">Teste</Badge>
                </div>
                <div className="flex gap-2">
                  <Input value="lrn_test_••••••••••••••••••••9x2a" readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="sm">Copiar</Button>
                </div>
              </div>
              <Button variant="outline" className="gap-1.5">
                <Plus className="w-4 h-4" />
                Gerar Nova Chave
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Webhooks</CardTitle>
              <CardDescription>
                Receba eventos em tempo real na sua aplicação.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm">Post publicado</p>
                  <Badge variant="outline" className="text-green-600 border-green-200">Ativo</Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  https://api.meusite.com/webhooks/laurena
                </p>
                <div className="flex gap-2 mt-2">
                  <Button variant="ghost" size="sm" className="text-xs">Editar</Button>
                  <Button variant="ghost" size="sm" className="text-xs text-destructive">
                    <Trash2 className="w-3 h-3 mr-1" />
                    Remover
                  </Button>
                </div>
              </div>
              <Button variant="outline" className="gap-1.5">
                <Plus className="w-4 h-4" />
                Adicionar Webhook
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contas Sociais */}
        <TabsContent value="contas" className="space-y-6">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">Redes Sociais Conectadas</CardTitle>
              <CardDescription>
                Conecte e gerencie suas contas de redes sociais.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {contasSociais.map((conta) => (
                <div key={conta.id} className="flex items-center justify-between border rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: conta.cor }}
                    >
                      {conta.plataforma[0]}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{conta.plataforma}</p>
                      {conta.conectada ? (
                        <p className="text-xs text-muted-foreground">{conta.nome}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Não conectado</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {conta.conectada ? (
                      <>
                        <Badge variant="outline" className="text-green-600 border-green-200 gap-1">
                          <Check className="w-3 h-3" />
                          Conectado
                        </Badge>
                        <Button variant="ghost" size="sm" className="text-xs text-destructive">
                          Desconectar
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" className="gap-1.5">
                        <ExternalLink className="w-3.5 h-3.5" />
                        Conectar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Privacidade e Exclusão de Dados ── */}
        <TabsContent value="privacidade" className="space-y-6">
          {/* Exclusão de Dados */}
          <Card className="rounded-xl border-red-200 bg-red-50/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-red-700">
                <AlertCircle className="w-4 h-4" />
                Exclusão de Dados (LGPD)
              </CardTitle>
              <CardDescription>
                Solicite a exclusão permanente de todos os seus dados pessoais da plataforma.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-white p-4 rounded-lg border border-red-200">
                <h4 className="text-sm font-semibold text-red-700 mb-2">⚠️ Atenção: Ação Irreversível</h4>
                <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                  <li>Todos os seus dados serão permanentemente deletados</li>
                  <li>Você será imediatamente desconectado</li>
                  <li>Não é possível recuperar dados após a exclusão</li>
                  <li>Conforme LGPD, removeremos em até 30 dias</li>
                </ul>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Para solicitar a exclusão de sua conta e dados associados, clique no botão abaixo.
                </p>
                <Button
                  onClick={handleOpenDeleteDataPage}
                  disabled={carregandoDeletion}
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
                  size="sm"
                >
                  {carregandoDeletion ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  {carregandoDeletion ? 'Carregando...' : 'Acessar Central de Exclusão de Dados'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Download de Dados */}
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="w-4 h-4" />
                Baixar Meus Dados
              </CardTitle>
              <CardDescription>
                Solicite uma cópia de todos os seus dados pessoais em formato portável.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Você tem direito a receber uma cópia de seus dados conforme a LGPD. Clique abaixo para solicitar um arquivo contendo:
              </p>
              <ul className="text-sm space-y-2 ml-4 list-disc text-muted-foreground">
                <li>Informações de perfil</li>
                <li>Histórico de posts e conteúdo criado</li>
                <li>Dados de interações na plataforma</li>
                <li>Histórico de análises e campanhas</li>
              </ul>
              <Button variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                Solicitar Download dos Dados
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
