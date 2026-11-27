import React, { useEffect, useRef, useState } from 'react';
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
import { useTranslation } from '@/hooks/useTranslation';
import { formatApiError } from '@/lib/api';

export default function Configuracoes() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const atualizarUsuario = useAuthStore((s) => s.atualizarUsuario);

  const [carregandoDeletion, setCarregandoDeletion] = useState(false);
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
          title: t('pages.settings.profileLoadError'),
          description: t('pages.settings.profileLoadErrorDesc'),
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) setCarregandoPerfil(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const initials = perfil.nome
    ? perfil.nome
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : perfil.email.slice(0, 2).toUpperCase();

  const displayAvatarUrl = resolveAvatarDisplayUrl(perfil.avatarUrl);

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
        title: t('pages.settings.profileSaved'),
        description: t('pages.settings.profileSavedDesc'),
      });
    } catch (err: unknown) {
      toast({
        title: t('pages.settings.profileError'),
        description: formatApiError(err),
        variant: 'destructive',
      });
    } finally {
      setSalvandoPerfil(false);
    }
  };

  const handleAlterarSenha = async () => {
    if (!senha.nova || senha.nova.length < 8) {
      toast({
        title: t('pages.settings.passwordInvalid'),
        description: t('pages.settings.passwordInvalidDesc'),
        variant: 'destructive',
      });
      return;
    }
    if (senha.nova !== senha.confirmar) {
      toast({ title: t('pages.settings.passwordMismatchTitle'), variant: 'destructive' });
      return;
    }
    if (passwordSet && !senha.atual.trim()) {
      toast({ title: t('pages.settings.passwordRequired'), variant: 'destructive' });
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
        title: t('pages.settings.passwordSaved'),
        description: t('pages.settings.passwordSavedDesc'),
      });
    } catch (err: unknown) {
      toast({
        title: t('pages.settings.passwordError'),
        description: formatApiError(err),
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
        title: t('pages.settings.photoInvalidFormat'),
        description: t('pages.settings.photoInvalidFormatDesc'),
        variant: 'destructive',
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t('pages.settings.photoTooLarge'),
        description: t('pages.settings.photoTooLargeDesc'),
        variant: 'destructive',
      });
      return;
    }
    setCarregandoAvatar(true);
    try {
      const user = await apiUploadAvatar(file);
      const path = user.avatar_url ?? '';
      setPerfil((p) => ({ ...p, avatarUrl: path }));
      atualizarUsuario({
        nome: user.full_name?.trim() || user.email.split('@')[0],
        avatar: resolveAvatarDisplayUrl(path),
      });
      toast({
        title: t('pages.settings.photoSaved'),
        description: t('pages.settings.photoSavedDesc'),
      });
    } catch (err: unknown) {
      toast({
        title: t('pages.settings.photoError'),
        description: formatApiError(err),
        variant: 'destructive',
      });
    } finally {
      setCarregandoAvatar(false);
    }
  };

  const handleSalvar = (secao: string) => {
    toast({
      title: t('pages.settings.settingsSaved'),
      description: t('pages.settings.settingsSavedDesc', { section: secao }),
    });
  };

  const handleOpenDeleteDataPage = async () => {
    setCarregandoDeletion(true);
    try {
      const deleteUrl = '/api/v1/webhooks/delete-my-data';
      const newWindow = window.open(deleteUrl, '_blank');

      if (!newWindow) {
        toast({
          title: t('pages.settings.popupBlocked'),
          description: t('pages.settings.popupBlockedDesc'),
          variant: 'destructive',
        });
        return;
      }

      newWindow.focus();
    } catch (err) {
      toast({
        title: t('pages.settings.deletionError'),
        description: formatApiError(err),
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
          {t('pages.settings.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('pages.settings.subtitle')}
        </p>
      </div>

      <Tabs defaultValue="perfil" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="perfil" className="gap-1.5 text-xs sm:text-sm">
            <User className="w-3.5 h-3.5" />
            {t('pages.settings.tabProfile')}
          </TabsTrigger>
          <TabsTrigger value="privacidade" className="gap-1.5 text-xs sm:text-sm">
            <Lock className="w-3.5 h-3.5" />
            {t('pages.settings.tabPrivacy')}
          </TabsTrigger>
        </TabsList>

        {/* ── Perfil ── */}
        <TabsContent value="perfil" className="space-y-6">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">{t('pages.settings.personalInfo')}</CardTitle>
              <CardDescription>{t('pages.settings.personalInfoDesc')}</CardDescription>
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
                        {t('pages.settings.changePhoto')}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('pages.settings.photoHint')}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('pages.settings.fullName')}</Label>
                      <Input
                        value={perfil.nome}
                        onChange={(e) => setPerfil({ ...perfil, nome: e.target.value })}
                        placeholder={t('pages.settings.namePlaceholder')}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('pages.settings.emailLabel')}</Label>
                      <Input
                        type="email"
                        value={perfil.email}
                        readOnly
                        disabled
                        className="bg-muted/50 cursor-not-allowed"
                        title={t('pages.settings.emailReadonly')}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>{t('pages.settings.phone')}</Label>
                      <Input
                        value={perfil.telefone}
                        onChange={(e) => setPerfil({ ...perfil, telefone: e.target.value })}
                        placeholder={t('pages.settings.phonePlaceholder')}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('pages.settings.bio')}</Label>
                    <Textarea
                      value={perfil.bio}
                      onChange={(e) => setPerfil({ ...perfil, bio: e.target.value })}
                      rows={3}
                      placeholder={t('pages.settings.bioPlaceholder')}
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
                      {t('pages.settings.saveProfile')}
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
                  {passwordSet ? t('pages.settings.changePassword') : t('pages.settings.setPassword')}
                </CardTitle>
                <CardDescription>
                  {passwordSet
                    ? t('pages.settings.passwordDescChange')
                    : oauthProvider
                      ? t('pages.settings.passwordDescSet')
                      : t('pages.settings.passwordDescNew')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {oauthProvider && (
                  <Alert className="border-primary/25 bg-primary/5">
                    <Globe className="h-4 w-4 text-primary" />
                    <div className="min-w-0">
                      <AlertTitle className="text-sm">
                        {t('pages.settings.oauthLinked', {
                          provider: oauthProvider === 'google' ? 'Google' : 'Facebook',
                        })}
                      </AlertTitle>
                      <AlertDescription className="text-xs text-muted-foreground">
                        {t('pages.settings.oauthDesc', {
                          provider: oauthProvider === 'google' ? 'Google' : 'Facebook',
                          action: passwordSet
                            ? t('pages.settings.oauthActionChange')
                            : t('pages.settings.oauthActionSet'),
                        })}
                      </AlertDescription>
                    </div>
                  </Alert>
                )}
                {passwordSet && (
                  <div className="space-y-2">
                    <Label>{t('pages.settings.currentPassword')}</Label>
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
                    <Label>{passwordSet ? t('pages.settings.newPassword') : t('pages.settings.passwordLabel')}</Label>
                    <Input
                      type={mostrarSenha ? 'text' : 'password'}
                      value={senha.nova}
                      onChange={(e) => setSenha({ ...senha, nova: e.target.value })}
                      placeholder={t('pages.settings.minChars')}
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{passwordSet ? t('pages.settings.confirmNewPassword') : t('pages.settings.confirmPassword')}</Label>
                    <Input
                      type={mostrarSenha ? 'text' : 'password'}
                      value={senha.confirmar}
                      onChange={(e) => setSenha({ ...senha, confirmar: e.target.value })}
                      placeholder={t('pages.settings.repeatPassword')}
                      autoComplete="new-password"
                    />
                    {senha.confirmar && senha.nova !== senha.confirmar && (
                      <p className="text-xs text-destructive">{t('pages.settings.passwordMismatch')}</p>
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
                    {passwordSet ? t('pages.settings.changePassword') : t('pages.settings.setPassword')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notificações */}
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">{t('pages.settings.notifications')}</CardTitle>
              <CardDescription>{t('pages.settings.notificationsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{t('pages.settings.emailNotif')}</p>
                  <p className="text-xs text-muted-foreground">{t('pages.settings.emailNotifDesc')}</p>
                </div>
                <Switch
                  checked={notificacoes.email}
                  onCheckedChange={(v) => setNotificacoes({ ...notificacoes, email: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{t('pages.settings.pushNotif')}</p>
                  <p className="text-xs text-muted-foreground">{t('pages.settings.pushNotifDesc')}</p>
                </div>
                <Switch
                  checked={notificacoes.push}
                  onCheckedChange={(v) => setNotificacoes({ ...notificacoes, push: v })}
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => handleSalvar('notifications')} className="gap-1.5">
                  <Save className="w-4 h-4" />
                  {t('pages.settings.saveNotifications')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Privacidade (LGPD) ── */}
        <TabsContent value="privacidade" className="space-y-6">
          <Card className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/[0.07] via-card to-card shadow-md">
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-foreground">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <AlertCircle className="w-4 h-4" />
                </span>
                {t('pages.settings.lgpdTitle')}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {t('pages.settings.lgpdDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="rounded-xl border border-border/80 bg-card/90 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
                  {t('pages.settings.irreversible')}
                </p>
                <ul className="text-sm text-muted-foreground space-y-1.5 ml-4 list-disc marker:text-primary/70">
                  <li>{t('pages.settings.lgpdItem1')}</li>
                  <li>{t('pages.settings.lgpdItem2')}</li>
                  <li>{t('pages.settings.lgpdItem3')}</li>
                  <li>{t('pages.settings.lgpdItem4')}</li>
                </ul>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t('pages.settings.openDeletionDesc')}
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
                  {carregandoDeletion ? t('pages.settings.opening') : t('pages.settings.openDeletion')}
                </Button>
                <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/25 pl-3">
                  {t('pages.settings.openDeletionWarning')}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
