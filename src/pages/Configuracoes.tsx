import { useEffect, useRef, useState } from 'react';
import {
  Settings,
  User,
  Save,
  Camera,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Globe,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  apiMe,
  apiUpdateProfile,
  apiUploadAvatar,
  resolveAvatarDisplayUrl,
} from '@/lib/authApi';
import { useAuthStore } from '@/store/useAuthStore';

export default function Configuracoes() {
  const { toast } = useToast();
  const atualizarUsuario = useAuthStore((s) => s.atualizarUsuario);
  const tokenStore = useAuthStore((s) => s.token);

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
  const [passwordSet, setPasswordSet] = useState(true);
  const [oauthProvider, setOauthProvider] = useState<'google' | 'facebook' | null>(null);
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [carregandoAvatar, setCarregandoAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [notificacoes, setNotificacoes] = useState({
    email: true,
    push: true,
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
        setPasswordSet(
          user.password_set ?? !(Boolean(user.google_id) || Boolean(user.facebook_id))
        );
        setOauthProvider(user.google_id ? 'google' : user.facebook_id ? 'facebook' : null);
        atualizarUsuario({
          nome: user.full_name?.trim() || user.email.split('@')[0],
          avatar: resolveAvatarDisplayUrl(user.avatar_url),
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
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- carregar perfil uma vez ao montar

  // ── Compute initials for avatar ───────────────────────────────────────────
  const initials = perfil.nome
    ? perfil.nome
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : perfil.email.slice(0, 2).toUpperCase();

  const displayAvatarUrl = resolveAvatarDisplayUrl(perfil.avatarUrl);

  // ── Save profile (dados pessoais apenas) ──────────────────────────────────
  const handleSalvarPerfil = async () => {
    setSalvandoPerfil(true);
    try {
      const updated = await apiUpdateProfile({
        full_name: perfil.nome.trim() || null,
        phone: perfil.telefone.trim() || null,
        bio: perfil.bio.trim() || null,
      });

      setPerfil((p) => ({
        ...p,
        nome: updated.full_name ?? '',
        telefone: updated.phone ?? '',
        bio: updated.bio ?? '',
        avatarUrl: updated.avatar_url ?? p.avatarUrl,
      }));
      atualizarUsuario({
        nome: updated.full_name?.trim() || updated.email.split('@')[0],
        avatar: resolveAvatarDisplayUrl(updated.avatar_url),
      });

      toast({
        title: 'Perfil atualizado',
        description: 'Suas informações foram salvas com sucesso.',
      });
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

  const handleAlterarSenha = async () => {
    if (!senha.nova || senha.nova.length < 8) {
      toast({
        title: 'Nova senha inválida',
        description: 'A nova senha deve ter pelo menos 8 caracteres.',
        variant: 'destructive',
      });
      return;
    }
    if (senha.nova !== senha.confirmar) {
      toast({ title: 'As senhas não coincidem', variant: 'destructive' });
      return;
    }
    if (passwordSet && !senha.atual.trim()) {
      toast({ title: 'Informe a senha atual', variant: 'destructive' });
      return;
    }

    setSalvandoSenha(true);
    try {
      await apiUpdateProfile({
        ...(passwordSet ? { current_password: senha.atual } : {}),
        new_password: senha.nova,
      });
      setSenha({ atual: '', nova: '', confirmar: '' });
      setPasswordSet(true);
      toast({
        title: 'Senha atualizada',
        description: 'A sua senha foi alterada com sucesso.',
      });
    } catch (err: unknown) {
      toast({
        title: 'Erro ao alterar senha',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSalvandoSenha(false);
    }
  };

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Formato inválido',
        description: 'Use JPG, PNG, GIF ou WebP.',
        variant: 'destructive',
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'Tamanho máximo: 5 MB.',
        variant: 'destructive',
      });
      return;
    }
    setCarregandoAvatar(true);
    try {
      await apiUploadAvatar(file);
      const user = await apiMe();
      const path = user.avatar_url ?? '';
      setPerfil((p) => ({
        ...p,
        avatarUrl: path,
      }));
      atualizarUsuario({
        nome: user.full_name?.trim() || user.email.split('@')[0],
        avatar: resolveAvatarDisplayUrl(path),
      });
      toast({
        title: 'Foto atualizada',
        description: 'Sua foto de perfil foi salva no servidor e associada à sua conta.',
      });
    } catch (err: unknown) {
      toast({
        title: 'Erro ao enviar foto',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setCarregandoAvatar(false);
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
      let token = localStorage.getItem('auth_token') || localStorage.getItem('access_token') || tokenStore;

      // Fallback para sessões antigas: token salvo apenas no estado persistido do Zustand
      if (!token) {
        const persistedAuth = localStorage.getItem('laurena-auth');
        if (persistedAuth) {
          try {
            const parsed = JSON.parse(persistedAuth);
            token = parsed?.state?.token || null;
          } catch {
            token = null;
          }
        }
      }
      
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

      const deleteUrl = `/api/v1/webhooks/delete-my-data?token=${encodeURIComponent(token)}`;
      const newWindow = window.open(deleteUrl, '_blank');
      
      if (!newWindow) {
        toast({
          title: 'Bloqueador de pop-ups ativo',
          description: 'Permita pop-ups neste site para acessar a página de exclusão.',
          variant: 'destructive',
        });
        return;
      }

      newWindow.focus();

    } catch (err) {
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
          Gerencie seu perfil, notificações e privacidade.
        </p>
      </div>

      <Tabs defaultValue="perfil" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="perfil" className="gap-1.5 text-xs sm:text-sm">
            <User className="w-3.5 h-3.5" />
            Perfil
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
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={handleAvatarFile}
                    />
                    {displayAvatarUrl ? (
                      <img
                        src={displayAvatarUrl}
                        alt={perfil.nome || perfil.email}
                        className="w-20 h-20 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                        {initials}
                      </div>
                    )}
                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={carregandoAvatar}
                        onClick={() => avatarInputRef.current?.click()}
                      >
                        {carregandoAvatar ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Camera className="w-3.5 h-3.5" />
                        )}
                        Alterar foto
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">
                        JPG, PNG, GIF ou WebP. Máx 5MB.
                      </p>
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
                  {passwordSet
                    ? 'Introduza a senha atual e a nova senha para atualizar o acesso por e-mail.'
                    : oauthProvider
                      ? 'Ainda não tem senha local. Defina uma para também poder entrar com e-mail e senha.'
                      : 'Defina uma nova senha para a sua conta.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {oauthProvider && (
                  <Alert className="border-primary/25 bg-primary/5">
                    <Globe className="h-4 w-4 text-primary" />
                    <div className="min-w-0">
                      <AlertTitle className="text-sm">
                        Conta associada ao{' '}
                        {oauthProvider === 'google' ? 'Google' : 'Facebook'}
                      </AlertTitle>
                      <AlertDescription className="text-xs text-muted-foreground">
                        O seu login principal foi feito com{' '}
                        {oauthProvider === 'google' ? 'Google' : 'Facebook'}. Pode continuar a usar esse
                        método ou, abaixo, {passwordSet ? 'alterar' : 'definir'} uma senha para entrar
                        também com e-mail e senha.
                      </AlertDescription>
                    </div>
                  </Alert>
                )}
                {passwordSet && (
                  <div className="space-y-2">
                    <Label>Senha atual</Label>
                    <div className="relative">
                      <Input
                        type={mostrarSenha ? 'text' : 'password'}
                        value={senha.atual}
                        onChange={(e) => setSenha({ ...senha, atual: e.target.value })}
                        placeholder="••••••••"
                        className="pr-10"
                        autoComplete="current-password"
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
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{passwordSet ? 'Nova senha' : 'Senha'}</Label>
                    <Input
                      type={mostrarSenha ? 'text' : 'password'}
                      value={senha.nova}
                      onChange={(e) => setSenha({ ...senha, nova: e.target.value })}
                      placeholder="Mínimo 8 caracteres"
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirmar {passwordSet ? 'nova senha' : 'senha'}</Label>
                    <Input
                      type={mostrarSenha ? 'text' : 'password'}
                      value={senha.confirmar}
                      onChange={(e) => setSenha({ ...senha, confirmar: e.target.value })}
                      placeholder="Repita a senha"
                      autoComplete="new-password"
                    />
                    {senha.confirmar && senha.nova !== senha.confirmar && (
                      <p className="text-xs text-destructive">As senhas não coincidem.</p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => void handleAlterarSenha()}
                    disabled={
                      salvandoSenha ||
                      !senha.nova ||
                      senha.nova.length < 8 ||
                      senha.nova !== senha.confirmar ||
                      (passwordSet && !senha.atual.trim())
                    }
                    variant="outline"
                    className="gap-1.5"
                  >
                    {salvandoSenha ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                    {passwordSet ? 'Alterar Senha' : 'Definir Senha'}
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
              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => handleSalvar('notificações')} className="gap-1.5">
                  <Save className="w-4 h-4" />
                  Salvar Notificações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Privacidade (LGPD) — visual alinhado à marca Laurena ── */}
        <TabsContent value="privacidade" className="space-y-6">
          <Card className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/[0.07] via-card to-card shadow-md">
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-foreground">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <AlertCircle className="w-4 h-4" />
                </span>
                Exclusão de dados (LGPD)
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Solicite a exclusão permanente dos seus dados pessoais na plataforma Laurena Studio.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="rounded-xl border border-border/80 bg-card/90 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
                  Ação irreversível
                </p>
                <ul className="text-sm text-muted-foreground space-y-1.5 ml-4 list-disc marker:text-primary/70">
                  <li>Os seus dados serão eliminados de forma permanente.</li>
                  <li>A sessão será encerrada imediatamente.</li>
                  <li>Não será possível recuperar informações após o pedido.</li>
                  <li>Em conformidade com a LGPD, o processamento pode levar até 30 dias.</li>
                </ul>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Para continuar, abra a central de exclusão (nova janela). Será pedida autenticação com o
                  seu token de sessão atual.
                </p>
                <Button
                  type="button"
                  onClick={handleOpenDeleteDataPage}
                  disabled={carregandoDeletion}
                  variant="destructive"
                  className="inline-flex items-center gap-2"
                  size="sm"
                >
                  {carregandoDeletion ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  {carregandoDeletion ? 'Abrindo…' : 'Abrir central de exclusão de dados'}
                </Button>
                <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/25 pl-3">
                  A exclusão é definitiva: posts, chats, sites gerados e preferências ligadas à conta podem
                  ser removidos. Leia com atenção as informações na página aberta antes de confirmar.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
