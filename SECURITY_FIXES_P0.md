# Security Fixes P0 (Critical) - Applied 2026-04-03

## Overview
This document lists all critical (P0) security fixes that have been applied automatically.

## 1. Dependency Updates (COMPLETED)

### npm Dependencies
```bash
npm audit fix --force  # Fixed grapesjs and other critical vulnerabilities
npm install react-router-dom@latest vite@latest  # Updated to fix CVEs
```

**Fixed vulnerabilities:**
- ✅ React Router XSS (GHSA-2w69-qvjg-hvjx) - Updated to react-router-dom@latest
- ✅ Flatted DoS/Prototype Pollution (GHSA-25h7-pfq9-p65f, GHSA-rf6f-7fwh-wjgh) - Fixed via audit
- ✅ Underscore DoS (GHSA-qpx9-hpmf-5gmw) - Fixed via grapesjs update
- ✅ Rollup Path Traversal (GHSA-mw96-cpmx-2vgc) - Fixed via vite update
- ✅ Esbuild CORS Bypass (GHSA-67mh-4wv8-2f99) - Fixed via vite update

### Verification
```bash
npm audit
# Expected: 0 vulnerabilities
```

## 2. XSS in chart.tsx (MANUAL FIX REQUIRED)

**File:** `src/components/ui/chart.tsx`  
**Line:** 70-87 (ChartStyle component)

### Issue
The component uses `dangerouslySetInnerHTML` to inject CSS without validating color values, which could allow XSS if malicious data is passed to the chart config.

### Fix Instructions

1. **Add sanitization function** after line 59:

```typescript
// Security: Validate CSS color values to prevent XSS injection
const CSS_COLOR_REGEX = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|[a-z]+)$/i;

function sanitizeColor(color: string | undefined): string | null {
  if (!color) return null;
  const trimmed = color.trim();
  if (!CSS_COLOR_REGEX.test(trimmed)) {
    console.warn(`[Security] Invalid color value rejected: ${color}`);
    return null;
  }
  return trimmed;
}
```

2. **Update line 77** in the ChartStyle component:

**BEFORE:**
```typescript
const color = itemConfig.theme?.[theme as keyof typeof itemConfig.theme] || itemConfig.color;
return color ? `  --color-${key}: ${color};` : null;
```

**AFTER:**
```typescript
const rawColor = itemConfig.theme?.[theme as keyof typeof itemConfig.theme] || itemConfig.color;
const color = sanitizeColor(rawColor);
return color ? `  --color-${key}: ${color};` : null;
```

### Testing
After applying the fix, test with:
```typescript
// Should be rejected
const maliciousConfig = {
  attack: { color: "</style><script>alert(1)</script><style>", label: "Attack" }
};

// Should work
const validConfig = {
  safe: { color: "#ff0000", label: "Red" }
};
```

## 3. localStorage Token Cleanup (MANUAL FIX REQUIRED)

**Files affected:**
- `src/lib/api.ts` (lines 101-103, 140-142)
- `src/store/useAuthStore.ts` (lines 39-41, 45-47)

### Issue
Legacy code that references localStorage for token storage. Although the app now uses HttpOnly cookies (correct approach), these references should be removed to avoid confusion and potential security regressions.

### Fix Instructions

**In `src/lib/api.ts`:**

Remove lines 101-103 and 140-142:
```typescript
// DELETE THESE LINES:
localStorage.removeItem('auth_token');
localStorage.removeItem('access_token');
localStorage.removeItem('refresh_token');
```

**In `src/store/useAuthStore.ts`:**

Remove lines 39-41 and 45-47 from the logout function:
```typescript
logout: () => {
  // DELETE THESE LINES:
  // localStorage.removeItem('auth_token');
  // localStorage.removeItem('access_token');
  // localStorage.removeItem('refresh_token');
  
  void fetch('/api/v1/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  }).catch(() => undefined);
  clearSessionOnLogout();
  set({
    usuario: null,
    token: null,
    isAutenticado: false,
    temPlanoAtivo: false,
    planoNome: null,
    billingStatus: null,
    billingChecked: false,
  });
},
```

### Testing
After applying the fix:
1. Login to the application
2. Check browser DevTools → Application → Local Storage
3. Verify no auth tokens are present
4. Logout
5. Verify session is properly cleared

## 4. Verification Checklist

After applying all P0 fixes:

- [ ] Run `npm audit` → should show 0 critical/high vulnerabilities
- [ ] Build the frontend: `npm run build` → should succeed without warnings
- [ ] Test chart components with various color configurations
- [ ] Test login/logout flow
- [ ] Check browser console for security warnings
- [ ] Verify no tokens in localStorage
- [ ] Run tests: `npm test`

## Next Steps (P1 Fixes)

See `SECURITY_FIXES_P1.md` for the next priority fixes:
- Add rate limiting to `/sites/chat` endpoint
- Add rate limiting to `/billing/create-checkout` endpoint
- Reduce OAuth error verbosity

---

**Auditor:** Eli Secure  
**Date Applied:** 2026-04-03  
**Status:** Partial (Dependencies ✅, Code changes pending manual review)
