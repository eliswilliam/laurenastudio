import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Megaphone, Layers, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/useAuthStore';
import { notify } from '@/lib/notify';
import {
  apiLogin,
  redirectToGoogleLogin,
  redirectToFacebookLogin,
  resolveAvatarDisplayUrl,
} from '@/lib/authApi';
import { executeRecaptchaAction } from '@/lib/recaptcha';
import { useEffect, useMemo } from 'react';
import { useTranslation } from '@/hooks/useTranslation';

export default function Login() {
  const LOGIN_ERROR_TOAST_MS = 5000;
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const { login, fetchBillingStatus } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const resolveLoginErrorMessage = (err: unknown): string => {
    if (!(err instanceof Error) || !err.message.trim()) {
      return t('pages.login.errorDesc');
    }
    const raw = err.message.trim();
    if (/^Erro HTTP 401|^HTTP 401/i.test(raw)) {
      return t('pages.login.errorDesc');
    }
    return raw;
  };

  const pillars = useMemo(
    () => [
      { icon: Megaphone, title: t('pages.login.pillar1Title'), desc: t('pages.login.pillar1Desc') },
      { icon: Layers, title: t('pages.login.pillar2Title'), desc: t('pages.login.pillar2Desc') },
      { icon: Globe, title: t('pages.login.pillar3Title'), desc: t('pages.login.pillar3Desc') },
    ],
    [t]
  );

  useEffect(() => {
    const error = searchParams.get('error');
    if (!error) return;

    let decodedMessage = error;
    try {
      decodedMessage = decodeURIComponent(error);
    } catch {
      decodedMessage = error;
    }

    notify.error(t('pages.login.googleErrorTitle'), decodedMessage, LOGIN_ERROR_TOAST_MS);
  }, [searchParams, t]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !senha) return;
    setCarregando(true);
    try {
      const recaptchaToken = await executeRecaptchaAction('login');
      const data = await apiLogin(email, senha, recaptchaToken);
      login(
        {
          id: data.user.id,
          nome: data.user.full_name?.trim() || data.user.email.split('@')[0],
          email: data.user.email,
          avatar: resolveAvatarDisplayUrl(data.user.avatar_url),
          plano: 'starter',
          criadoEm: data.user.created_at,
        },
        data.tokens.access_token
      );
      notify.success(t('pages.login.successTitle'), t('pages.login.successDesc'));
      const hasActivePlan = await fetchBillingStatus();
      navigate(hasActivePlan ? '/dashboard' : '/escolher-plano');
    } catch (err: unknown) {
      notify.error(
        t('pages.login.errorTitle'),
        resolveLoginErrorMessage(err),
        LOGIN_ERROR_TOAST_MS
      );
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/95 via-primary to-primary/75 relative overflow-hidden items-center justify-center p-10 xl:p-14">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTRWMjhIMjR2MmgxinptMC00VjI0SDI0djJoMTJ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-black/10 blur-3xl" />
        <div className="relative z-10 max-w-xl text-white">
          <div className="mb-10 flex items-center gap-3">
            <img src="/android-chrome-192x192.png" alt="Laurena Studio" className="h-12 w-12 rounded-xl shadow-lg shadow-black/20 ring-2 ring-white/20" />
            <span className="font-bagel text-3xl tracking-[0.2em] text-white drop-shadow-sm">LAURENA</span>
          </div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-white/60">{t('pages.login.studioAi')}</p>
          <h1 className="text-balance text-4xl font-bold leading-[1.35] tracking-tight xl:text-[2.65rem]">
            {t('pages.login.heroTitle')}{' '}
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-white to-white/85 bg-clip-text text-transparent">
                {t('pages.login.heroTitleHighlight')}
              </span>
              <span className="absolute -inset-x-1 -bottom-0.5 z-0 h-3 rounded-sm bg-white/25" aria-hidden />
            </span>
          </h1>
          <p className="mt-6 max-w-[34rem] text-base leading-relaxed text-white/82 md:text-lg">
            {t('pages.login.heroSubtitle')}{' '}
            <span className="font-medium text-white">{t('pages.login.heroHighlight')}</span>
          </p>
          <ul className="mt-10 flex flex-col gap-3 sm:grid sm:grid-cols-3 sm:gap-4">
            {pillars.map(({ icon: Icon, title, desc }) => (
              <li
                key={title}
                className="group flex gap-3 rounded-2xl border border-white/15 bg-white/[0.08] p-4 shadow-lg shadow-black/5 backdrop-blur-md transition-all duration-300 hover:border-white/25 hover:bg-white/[0.14]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/18 text-white ring-1 ring-white/20 transition-transform duration-300 group-hover:scale-105">
                  <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[0.95rem] font-semibold leading-tight tracking-tight">{title}</p>
                  <p className="mt-1 text-[0.8125rem] leading-snug text-white/70">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-2 lg:hidden">
            <img src="/android-chrome-192x192.png" alt="Laurena Studio" className="w-8 h-8 rounded-lg" />
            <span className="font-bagel tracking-wider text-xl">LAURENA</span>
          </div>

          <h2 className="text-2xl font-bold mb-1">{t('pages.login.formTitle')}</h2>
          <p className="text-muted-foreground mb-8">
            {t('pages.login.formSubtitle')}
          </p>

          <Button
            variant="outline"
            className="w-full h-11 gap-2 mb-3"
            onClick={() => redirectToGoogleLogin()}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            {t('pages.login.continueGoogle')}
          </Button>

          <Button
            variant="outline"
            className="w-full h-11 gap-2 mb-4"
            onClick={() => redirectToFacebookLogin()}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
              <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.883v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
            </svg>
            {t('pages.login.continueFacebook')}
          </Button>

          <div className="relative my-6">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">
              {t('common.or')}
            </span>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t('pages.login.emailPlaceholder')}
                  className="pl-10 h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="senha">{t('auth.password')}</Label>
                <Link
                  to="/esqueci-senha"
                  className="text-xs text-primary hover:underline"
                >
                  {t('pages.login.forgotPassword')}
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-10 pr-10 h-11"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setMostrarSenha(!mostrarSenha)}
                >
                  {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full h-11" disabled={carregando}>
              {carregando ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('pages.login.entering')}
                </div>
              ) : (
                t('pages.login.submit')
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {t('pages.login.noAccount')}{' '}
            <Link to="/registro" className="text-primary font-medium hover:underline">
              {t('pages.login.createFree')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
