# Security Fixes P1 (High Priority) - To Apply Within 1 Week

## Overview
These are high-priority security enhancements that should be applied after P0 fixes.

## 1. Rate Limiting on /sites/chat Endpoint

**File:** `backend/app/routes/sites.py`  
**Severity:** Medium  
**Risk:** API cost abuse, DoS

### Issue
The `/sites/chat` endpoint calls external AI APIs (Gemini/Groq) without per-user rate limiting. A malicious user with an active subscription could spam this endpoint causing excessive costs.

### Fix

Add this code after the imports section (around line 50):

```python
from collections import deque
from threading import Lock
from time import monotonic

# Rate limiting for AI chat endpoint
_SITE_CHAT_RATE_LIMIT_WINDOW_SECONDS = 60  # 1 minute
_SITE_CHAT_RATE_LIMIT_MAX_REQUESTS = 10    # 10 messages max per minute
_SITE_CHAT_RATE_STORE: dict[str, deque[float]] = {}
_SITE_CHAT_RATE_LOCK = Lock()

def _enforce_site_chat_rate_limit(user_id: str) -> None:
    """Prevent chat endpoint abuse - max 10 requests per minute per user."""
    now = monotonic()
    with _SITE_CHAT_RATE_LOCK:
        bucket = _SITE_CHAT_RATE_STORE.setdefault(user_id, deque())
        # Remove expired timestamps
        while bucket and now - bucket[0] > _SITE_CHAT_RATE_LIMIT_WINDOW_SECONDS:
            bucket.popleft()
        # Check if limit exceeded
        if len(bucket) >= _SITE_CHAT_RATE_LIMIT_MAX_REQUESTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many chat requests. Maximum {_SITE_CHAT_RATE_LIMIT_MAX_REQUESTS} per minute. Please wait.",
            )
        bucket.append(now)
```

Then update the `site_chat` function (around line 74):

```python
@router.post("/chat", response_model=SiteChatResponse, summary="Chat with Laurena about a site")
async def site_chat(
    payload: SiteChatRequest,
    current_user: User = Depends(get_current_user),
    subscription: Subscription = Depends(verify_active_subscription),
    db: AsyncSession = Depends(get_db),
) -> SiteChatResponse:
    # ADD THIS LINE FIRST:
    _enforce_site_chat_rate_limit(current_user.id)
    
    # ... rest of the function
```

### Testing

```bash
# Test rate limiting
for i in {1..12}; do
  curl -X POST http://localhost:8000/api/v1/sites/chat \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","content":"test"}]}'
  echo "Request $i"
  sleep 0.5
done
# Expected: First 10 succeed, requests 11-12 return 429
```

## 2. Rate Limiting on /billing/create-checkout Endpoint

**File:** `backend/app/routes/billing.py`  
**Severity:** Medium  
**Risk:** Stripe API abuse, session pollution

### Issue
The `/billing/create-checkout` endpoint creates Stripe checkout sessions without rate limiting. Could be abused to create excessive sessions.

### Fix

Add this code after the imports section (around line 38):

```python
from collections import deque
from threading import Lock
from time import monotonic

# Rate limiting for checkout creation
_CHECKOUT_RATE_LIMIT_WINDOW_SECONDS = 300  # 5 minutes
_CHECKOUT_RATE_LIMIT_MAX_REQUESTS = 5      # 5 checkouts max per 5 minutes
_CHECKOUT_RATE_STORE: dict[str, deque[float]] = {}
_CHECKOUT_RATE_LOCK = Lock()

def _enforce_checkout_rate_limit(workspace_id: str) -> None:
    """Prevent checkout spam - max 5 sessions per 5 minutes per workspace."""
    now = monotonic()
    with _CHECKOUT_RATE_LOCK:
        bucket = _CHECKOUT_RATE_STORE.setdefault(workspace_id, deque())
        while bucket and now - bucket[0] > _CHECKOUT_RATE_LIMIT_WINDOW_SECONDS:
            bucket.popleft()
        if len(bucket) >= _CHECKOUT_RATE_LIMIT_MAX_REQUESTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many checkout attempts. Maximum {_CHECKOUT_RATE_LIMIT_MAX_REQUESTS} per 5 minutes.",
            )
        bucket.append(now)
```

Then update the `create_checkout` function (around line 65):

```python
@router.post("/create-checkout", response_model=CheckoutSessionResponse, ...)
async def create_checkout(
    payload: CheckoutSessionRequest,
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    # ADD THIS LINE FIRST:
    _enforce_checkout_rate_limit(workspace_id)
    
    try:
        session = stripe_service.create_checkout_session(
            # ... rest of the function
```

### Testing

```bash
# Test checkout rate limiting
for i in {1..7}; do
  curl -X POST http://localhost:8000/api/v1/billing/create-checkout \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"plan_name":"starter","billing_cycle":"monthly","success_url":"http://localhost:8080/success","cancel_url":"http://localhost:8080/cancel"}'
  echo "Request $i"
done
# Expected: First 5 succeed, requests 6-7 return 429
```

## 3. Reduce OAuth Error Verbosity

**File:** `backend/app/routes/auth.py`  
**Lines:** 433-438 (Google), 481-486 (Facebook)  
**Severity:** Medium  
**Risk:** Information disclosure

### Issue
Exception details are exposed in OAuth callback errors, potentially leaking internal paths and stack traces.

### Fix

**For Google OAuth callback** (line 433):

**BEFORE:**
```python
except Exception as exc:
    import urllib.parse
    error_msg = urllib.parse.quote(str(exc))
    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/login?error={error_msg}"
    )
```

**AFTER:**
```python
except Exception as exc:
    import urllib.parse
    logger.error("Google OAuth callback failed: %s", exc, exc_info=True)
    error_msg = urllib.parse.quote("Authentication failed. Please try again.")
    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/login?error={error_msg}"
    )
```

**For Facebook OAuth callback** (line 481):

Apply the same fix:

```python
except Exception as exc:
    import urllib.parse
    logger.error("Facebook OAuth callback failed: %s", exc, exc_info=True)
    error_msg = urllib.parse.quote("Authentication failed. Please try again.")
    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/login?error={error_msg}"
    )
```

### Testing

1. Test with invalid OAuth state:
```bash
curl "http://localhost:8000/api/v1/auth/google/callback?code=invalid&state=invalid"
```
Expected: Generic error message, no stack trace

2. Check logs for detailed error (should be there):
```bash
docker compose logs api | grep "OAuth callback failed"
```

## 4. Verification Checklist

After applying all P1 fixes:

- [ ] Test chat endpoint rate limiting (should block after 10 requests/min)
- [ ] Test checkout rate limiting (should block after 5 requests/5min)
- [ ] Test OAuth error handling (should show generic message)
- [ ] Check server logs for detailed OAuth errors (should be logged)
- [ ] Verify no internal paths exposed in user-facing errors
- [ ] Run integration tests
- [ ] Deploy to staging for testing

## Next Steps (P2 Fixes)

After P1 fixes are verified, proceed to `SECURITY_FIXES_P2.md`:
- Update remaining medium/low priority dependencies
- Python dependency audit (pip-audit)
- CSP hardening
- Add security monitoring/alerting

---

**Auditor:** Eli Secure  
**Date Created:** 2026-04-03  
**Target Completion:** 2026-04-10 (1 week)
