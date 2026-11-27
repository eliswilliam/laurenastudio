import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiResetPassword } from '@/lib/authApi';
import { useTranslation } from '@/hooks/useTranslation';
import { translateApiError } from '@/lib/apiErrors';

interface LocationState {
  email: string;
  code: string;
}

export default function RedefinirSenha() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const state = location.state as LocationState | null;

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  if (!state?.email || !state?.code) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">{t('pages.resetPassword.invalidLink')}</p>
          <Link to="/esqueci-senha">
            <Button variant="outline">{t('pages.resetPassword.recover')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (novaSenha.length < 8) {
      toast({
        title: t('pages.resetPassword.shortTitle'),
        description: t('pages.resetPassword.shortDesc'),
        variant: 'destructive',
      });
      return;
    }

    if (novaSenha !== confirmarSenha) {
      toast({
        title: t('pages.resetPassword.mismatchTitle'),
        description: t('pages.resetPassword.mismatchDesc'),
        variant: 'destructive',
      });
      return;
    }

    setCarregando(true);
    try {
      await apiResetPassword(state.email, state.code, novaSenha);
      setSucesso(true);
    } catch (err: unknown) {
      toast({
        title: t('pages.resetPassword.errorTitle'),
        description: err instanceof Error ? translateApiError(err.message, t) : t('pages.forgotPassword.errorDesc'),
        variant: 'destructive',
      });
    } finally {
      setCarregando(false);
    }
  };

  const need = Math.max(0, 8 - novaSenha.length);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <img src="/android-chrome-192x192.png" alt="Laurena Studio" className="w-8 h-8 rounded-lg" />
          <span className="font-bagel tracking-wider text-xl">LAURENA</span>
        </div>

        {!sucesso ? (
          <>
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Lock className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-1">{t('pages.resetPassword.title')}</h2>
            <p className="text-muted-foreground mb-8">
              {t('pages.resetPassword.subtitle')}{' '}
              <span className="font-medium text-foreground">{state.email}</span>.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nova-senha">{t('pages.resetPassword.newPassword')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="nova-senha"
                    type={mostrarSenha ? 'text' : 'password'}
                    placeholder={t('pages.resetPassword.placeholderMin')}
                    className="pl-10 pr-10 h-11"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    required
                    minLength={8}
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

              <div className="space-y-2">
                <Label htmlFor="confirmar-senha">{t('pages.resetPassword.confirmPassword')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirmar-senha"
                    type={mostrarSenha ? 'text' : 'password'}
                    placeholder={t('pages.resetPassword.placeholderRepeat')}
                    className="pl-10 h-11"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                {confirmarSenha && novaSenha !== confirmarSenha && (
                  <p className="text-xs text-destructive">{t('pages.resetPassword.mismatchHint')}</p>
                )}
              </div>

              {novaSenha.length > 0 && novaSenha.length < 8 && (
                <p className="text-xs text-muted-foreground">
                  {t('pages.resetPassword.moreChars', { n: need })}
                </p>
              )}

              <Button
                type="submit"
                className="w-full h-11"
                disabled={carregando || novaSenha.length < 8 || novaSenha !== confirmarSenha}
              >
                {carregando ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('pages.resetPassword.saving')}
                  </div>
                ) : (
                  t('pages.resetPassword.submit')
                )}
              </Button>
            </form>
          </>
        ) : (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">{t('pages.resetPassword.successTitle')}</h2>
              <p className="text-muted-foreground">
                {t('pages.resetPassword.successDesc')}
              </p>
            </div>
            <Button className="w-full h-11" onClick={() => navigate('/login')}>
              {t('pages.resetPassword.goLogin')}
            </Button>
          </div>
        )}

        {!sucesso && (
          <div className="mt-8 text-center">
            <Link
              to="/esqueci-senha"
              className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t('common.back')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
