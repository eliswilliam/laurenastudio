/**
 * billingApi.ts: typed wrappers for the FastAPI /billing endpoints
 */
import api, { isUnreachableApiMessage } from './api';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Response types ─────────────────────────────────────────────────────────

export interface CheckoutSessionResponse {
  session_id: string;
  url: string;
}

export interface CustomerPortalResponse {
  url: string;
}

export interface PlanRead {
  id: string;
  name: string;
  display_name: string;
  price_brl: number;
  text_limit: number;
  image_limit: number;
  video_limit: number;
  social_limit: number;
  audio_limit: number;
  site_publish_limit: number;
}

export interface UsageRead {
  id: string;
  workspace_id: string;
  text_used: number;
  image_used: number;
  video_used: number;
  audio_used: number;
  site_publishes_used: number;
  period_start: string;
  period_end: string;
}

export interface SubscriptionRead {
  id: string;
  workspace_id: string;
  plan_id: string;
  status: string;
  start_date: string;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

export interface BillingStatusResponse {
  subscription: (SubscriptionRead & { plan: PlanRead }) | null;
  usage: {
    usage: UsageRead;
    limits: PlanRead;
    text_remaining: number;
    image_remaining: number;
    video_remaining: number;
    audio_remaining: number;
    site_publishes_remaining: number;
  } | null;
  is_active: boolean;
}

// ── API calls ──────────────────────────────────────────────────────────────

/** Create a Stripe Checkout session and return the redirect URL */
export async function apiCreateCheckout(
  planName: string,
  successUrl?: string,
  cancelUrl?: string
): Promise<CheckoutSessionResponse> {
  const res = await api.post<CheckoutSessionResponse>('/billing/create-checkout', {
    plan_name: planName,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  return res.data;
}

/** Open the Stripe Customer Portal for subscription management */
export async function apiCustomerPortal(
  returnUrl?: string
): Promise<CustomerPortalResponse> {
  const res = await api.post<CustomerPortalResponse>('/billing/customer-portal', {
    return_url: returnUrl,
  });
  return res.data;
}

/** List all available plans (public) */
export async function apiListPlans(): Promise<PlanRead[]> {
  const res = await api.get<PlanRead[]>('/billing/plans');
  return res.data;
}

/** Get billing status for the current account (retries on transient network failures). */
export async function apiBillingStatus(): Promise<BillingStatusResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await api.get<BillingStatusResponse>('/billing/status');
      return res.data;
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : '';
      if (!isUnreachableApiMessage(msg) || attempt === 2) break;
      await sleep(350 * (attempt + 1));
    }
  }
  throw lastError;
}

/** Verify a Stripe Checkout Session and activate subscription if paid */
export interface VerifySessionResponse {
  status: 'active' | 'pending' | 'canceled' | 'expired';
  plan_name: string | null;
  message: string;
}

export async function apiVerifySession(
  sessionId: string
): Promise<VerifySessionResponse> {
  const res = await api.post<VerifySessionResponse>('/billing/verify-session', {
    session_id: sessionId,
  });
  return res.data;
}

/** Get current subscription details */
export interface CurrentSubscriptionResponse {
  plan_name: string;
  display_name: string;
  price: number;
  status: string;
  current_period_end: string | null;
  limits: PlanRead;
  usage: UsageRead | null;
}

export async function apiCurrentSubscription(): Promise<CurrentSubscriptionResponse> {
  const res = await api.get<CurrentSubscriptionResponse>('/billing/current-subscription');
  return res.data;
}

// ── Search API ─────────────────────────────────────────────────────────────

export interface SearchResult {
  type: string;
  title: string;
  description: string | null;
  url: string;
}

export interface SearchResponse {
  query: string;
  total: number;
  results: Record<string, SearchResult[]>;
}

export async function apiGlobalSearch(q: string): Promise<SearchResponse> {
  const res = await api.get<SearchResponse>('/search', { params: { q } });
  return res.data;
}
