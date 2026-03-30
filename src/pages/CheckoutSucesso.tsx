/**
 * CheckoutSucesso.tsx
 * Dedicated Stripe success redirect page.
 *
 * Stripe redirects here with ?session_id=cs_xxx after a successful checkout.
 * The page:
 *  1. Calls POST /billing/verify-session with the session_id
 *     (this checks the Stripe API directly and activates the plan if paid)
 *  2. Falls back to polling /billing/status if no session_id
 *  3. Shows a success animation + plan info once active
 *  4. Offers a button to go to the Dashboard
 *  5. If something went wrong, shows an error state with retry
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Crown,
  Zap,
  Building2,
  CreditCard,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/useAuthStore';
import { apiVerifySession } from '@/lib/billingApi';
import { PLAN_DISPLAY_NAMES } from '@/data/planos';
import { useTranslation } from '@/hooks/useTranslation';

// ── Helpers ────────────────────────────────────────────────────────────────

const planIcons: Record<string, React.ReactNode> = {
  starter: <Zap className="w-8 h-8" />,
  pro: <Crown className="w-8 h-8" />,
  business: <Building2 className="w-8 h-8" />,
};

const planColors: Record<string, string> = {
  starter: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  pro: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  business: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
};

type PageState = 'loading' | 'success' | 'pending' | 'canceled' | 'error';

// ── Component ──────────────────────────────────────────────────────────────

export default function CheckoutSucesso() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAutenticado, fetchBillingStatus, billingStatus, usuario } = useAuthStore();

  const [state, setState] = useState<PageState>('loading');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const maxAttempts = 8;

  // If not authenticated → login
  useEffect(() => {
    if (!isAutenticado) {
      navigate('/login', { replace: true });
    }
  }, [isAutenticado, navigate]);

  // Main verification logic
  useEffect(() => {
    if (searchParams.get('canceled') === 'true') {
      setState('canceled');
      return;
    }

    const sessionId = searchParams.get('session_id');
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const verifyWithSessionId = async (sid: string, currentAttempt: number) => {
      if (cancelled) return;
      try {
        const result = await apiVerifySession(sid);
        if (cancelled) return;

        if (result.status === 'active') {
          // Refresh the store so dashboard has fresh data
          await fetchBillingStatus();
          setState('success');
          return;
        }

        if (result.status === 'pending') {
          // Boleto: show pending state
          setMessage(result.message);
          setState('pending');
          return;
        }

        if (result.status === 'expired') {
          setMessage(result.message);
          setState('error');
          return;
        }

        // Unexpected: retry a few times
        if (currentAttempt < maxAttempts) {
          setAttempt(currentAttempt + 1);
          timer = setTimeout(() => verifyWithSessionId(sid, currentAttempt + 1), 2500);
        } else {
          setState('error');
        }
      } catch {
        if (!cancelled && currentAttempt < maxAttempts) {
          setAttempt(currentAttempt + 1);
          timer = setTimeout(() => verifyWithSessionId(sid, currentAttempt + 1), 2500);
        } else if (!cancelled) {
          setState('error');
        }
      }
    };

    // Fallback: poll /billing/status if no session_id (shouldn't happen but be safe)
    const pollStatus = async (currentAttempt: number) => {
      if (cancelled) return;
      try {
        const isActive = await fetchBillingStatus();
        if (cancelled) return;
        if (isActive) {
          setState('success');
          return;
        }
        if (currentAttempt < maxAttempts) {
          setAttempt(currentAttempt + 1);
          timer = setTimeout(() => pollStatus(currentAttempt + 1), 2500);
        } else {
          setState('error');
        }
      } catch {
        if (!cancelled && currentAttempt < maxAttempts) {
          timer = setTimeout(() => pollStatus(currentAttempt + 1), 2500);
        } else if (!cancelled) {
          setState('error');
        }
      }
    };

    if (sessionId) {
      verifyWithSessionId(sessionId, 0);
    } else {
      pollStatus(0);
    }

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manual retry
  const handleRetry = () => {
    setState('loading');
    setAttempt(0);
    const sessionId = searchParams.get('session_id');

    const retry = async (currentAttempt: number) => {
      if (sessionId) {
        try {
          const result = await apiVerifySession(sessionId);
          if (result.status === 'active') {
            await fetchBillingStatus();
            setState('success');
            return;
          }
        } catch { /* fall through to status poll */ }
      }

      const isActive = await fetchBillingStatus();
      if (isActive) {
        setState('success');
      } else if (currentAttempt < 6) {
        setAttempt(currentAttempt + 1);
        setTimeout(() => retry(currentAttempt + 1), 2500);
      } else {
        setState('error');
      }
    };
    retry(0);
  };

  // Derived
  const plan = billingStatus?.subscription?.plan;
  const sub = billingStatus?.subscription;

  // ── LOADING: Waiting for webhook ─────────────────────────────────────────

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
        <Card className="max-w-md w-full mx-4 rounded-2xl shadow-xl border-0">
          <CardContent className="pt-12 pb-10 text-center space-y-6">
            <div className="relative mx-auto w-20 h-20">
              <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
              <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-primary/10">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold">{t('pages.checkout.processingTitle')}</h1>
              <p className="text-muted-foreground">
                {t('pages.checkout.processingDesc')}
                <br />
                {t('pages.checkout.processingHint')}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              {t('pages.checkout.verification', { current: attempt, max: maxAttempts })}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── CANCELED: User abandoned checkout ────────────────────────────────────

  if (state === 'canceled') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
        <Card className="max-w-md w-full mx-4 rounded-2xl shadow-xl border-0">
          <CardContent className="pt-12 pb-10 text-center space-y-6">
            <div className="mx-auto w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center">
              <XCircle className="w-10 h-10 text-amber-500" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold">{t('pages.checkout.canceledTitle')}</h1>
              <p className="text-muted-foreground">
                {t('pages.checkout.canceledDesc')}
                <br />
                {t('pages.checkout.canceledHint')}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button size="lg" onClick={() => navigate('/escolher-plano')}>
                <CreditCard className="w-4 h-4 mr-2" />
                {t('pages.checkout.choosePlan')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                {t('pages.checkout.backLogin')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── PENDING: Boleto / async payment waiting ──────────────────────────────

  if (state === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
        <Card className="max-w-md w-full mx-4 rounded-2xl shadow-xl border-0">
          <CardContent className="pt-12 pb-10 text-center space-y-6">
            <div className="mx-auto w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-10 h-10 text-amber-500" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold">{t('pages.checkout.pendingTitle')}</h1>
              <p className="text-muted-foreground">
                {message || t('pages.checkout.pendingDefault')}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button size="lg" onClick={handleRetry}>
                <RefreshCw className="w-4 h-4 mr-2" />
                {t('pages.checkout.checkAgain')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/escolher-plano')}>
                {t('pages.checkout.backPlans')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── ERROR: Verification failed ───────────────────────────────────────────

  if (state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
        <Card className="max-w-md w-full mx-4 rounded-2xl shadow-xl border-0">
          <CardContent className="pt-12 pb-10 text-center space-y-6">
            <div className="mx-auto w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
              <XCircle className="w-10 h-10 text-red-500" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold">{t('pages.checkout.errorTitle')}</h1>
              <p className="text-muted-foreground">
                {t('pages.checkout.errorDesc')}
              </p>
              <p className="text-muted-foreground text-sm">
                {t('pages.checkout.errorHint')}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button size="lg" onClick={handleRetry}>
                <RefreshCw className="w-4 h-4 mr-2" />
                {t('common.retry')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate('/escolher-plano')}>
                {t('pages.checkout.backPlans')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── SUCCESS: Subscription activated! ─────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
      <Card className="max-w-lg w-full mx-4 rounded-2xl shadow-xl border-0">
        <CardContent className="pt-12 pb-10 text-center space-y-8">
          {/* Success icon */}
          <div className="mx-auto w-24 h-24 rounded-full bg-green-500/10 flex items-center justify-center animate-in zoom-in-50 duration-500">
            <CheckCircle2 className="w-14 h-14 text-green-500" />
          </div>

          {/* Thank you message */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">
              {t('pages.checkout.congrats', {
                name: usuario?.nome?.split(' ')[0] ?? t('pages.checkout.congratsNameFallback'),
              })}
            </h1>
            <p className="text-muted-foreground text-lg">
              {t('pages.checkout.activated')}
              <br />
              {t('pages.checkout.thanks')}
            </p>
          </div>

          {/* Plan summary card */}
          {plan && (
            <div className="bg-muted/50 rounded-xl p-6 space-y-4 text-left">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${planColors[plan.name] ?? 'bg-primary/10 text-primary'}`}>
                  {planIcons[plan.name] ?? <CreditCard className="w-8 h-8" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold">{PLAN_DISPLAY_NAMES[plan.name] ?? plan.display_name ?? plan.name}</h2>
                    <Badge className="bg-green-600 text-white text-xs">{t('common.active')}</Badge>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    R$ {plan.price_brl.toFixed(2)} {t('landing.plans.perMonth')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-background rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">{t('pages.checkout.textPerMonth')}</p>
                  <p className="font-bold text-lg">{plan.text_limit === 0 ? '∞' : plan.text_limit}</p>
                </div>
                <div className="bg-background rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">{t('pages.checkout.imagePerMonth')}</p>
                  <p className="font-bold text-lg">{plan.image_limit === 0 ? '∞' : plan.image_limit}</p>
                </div>
                <div className="bg-background rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">{t('pages.checkout.videoPerMonth')}</p>
                  <p className="font-bold text-lg">{plan.video_limit === 0 ? '∞' : plan.video_limit}</p>
                </div>
              </div>

              {sub?.current_period_end && (
                <p className="text-xs text-muted-foreground text-center">
                  {t('pages.checkout.nextCharge')}{' '}
                  {new Date(sub.current_period_end).toLocaleDateString(i18n.language, {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>
          )}

          {/* Account info */}
          {usuario && (
            <div className="text-sm text-muted-foreground">
              {t('pages.checkout.account')}{' '}
              <span className="font-medium text-foreground">{usuario.email}</span>
            </div>
          )}

          {/* CTA: Go to Dashboard */}
          <Button
            size="lg"
            className="w-full text-base h-12"
            onClick={() => navigate('/dashboard', { replace: true })}
          >
            {t('pages.checkout.goDashboard')}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>

          <p className="text-xs text-muted-foreground">
            {t('pages.checkout.manageHint')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
