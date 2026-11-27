/**
 * AuthCallback.tsx
 * Handles the post-Google-OAuth redirect from the FastAPI backend.
 * The backend sets HttpOnly auth cookies and redirects here.
 * We fetch the user profile using the cookie session and redirect accordingly.
 */
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useToast } from '@/hooks/use-toast';
import { apiMe, resolveAvatarDisplayUrl } from '@/lib/authApi';
import { apiBillingStatus } from '@/lib/billingApi';
import { useTranslation } from '@/hooks/useTranslation';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const error = searchParams.get('error');

    if (error) {
      toast({
        title: t('pages.authCallback.googleErrorTitle'),
        description: decodeURIComponent(error),
        variant: 'destructive',
      });
      navigate('/login');
      return;
    }

    apiMe()
      .then(async (user) => {
        login(
          {
            id: user.id,
            nome: user.full_name?.trim() || user.email.split('@')[0],
            email: user.email,
            avatar: resolveAvatarDisplayUrl(user.avatar_url),
            plano: 'starter',
            criadoEm: user.created_at,
          }
        );
        toast({
          title: t('pages.authCallback.successTitle'),
          description: t('pages.authCallback.successDesc'),
        });
        // If coming from OAuth flow (e.g. builder subdomain), resume it
        const pendingNext = sessionStorage.getItem('pending_oauth_next');
        if (pendingNext) {
          sessionStorage.removeItem('pending_oauth_next');
          window.location.href = decodeURIComponent(pendingNext);
          return;
        }
        try {
          const billing = await apiBillingStatus();
          navigate(billing.is_active ? '/dashboard' : '/escolher-plano');
        } catch {
          navigate('/escolher-plano');
        }
      })
      .catch(() => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        toast({
          title: t('pages.authCallback.authErrorTitle'),
          description: t('pages.authCallback.authErrorDesc'),
          variant: 'destructive',
        });
        navigate('/login');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-muted-foreground text-sm">{t('pages.authCallback.loading')}</p>
    </div>
  );
}
