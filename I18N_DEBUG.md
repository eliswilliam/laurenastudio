# i18n Debugging Guide

## Issue: Language Detection Is Not Working

### Possible Causes:
1. **LocalStorage contains a stale value**: The `i18nextLng` key in `localStorage` can override automatic detection.
2. **Cookies**: Existing cookies may interfere with detection.
3. **Incorrect configuration**: Language code mapping mismatch.

## Applied Solutions:

### 1. Updated Configuration (`src/i18n/index.ts`)
- ✅ Added aliases for all language variants (`pt-BR`, `pt`, `en-US`, `en`, etc.)
- ✅ Added `convertDetectedLanguage` function to normalize language codes
- ✅ Detection order: `navigator` → `localStorage` → `htmlTag` → `cookie`
- ✅ Enabled debug mode (`debug: true`) to inspect logs in the browser console

### 2. How to Test Detection

#### Option A: Clear `localStorage` (RECOMMENDED)
1. Open the browser developer tools (F12)
2. Go to the **Console** tab
3. Run the following command:
   ```javascript
   localStorage.removeItem('i18nextLng');
   location.reload();
   ```

#### Option B: Test with Different Languages
1. Open the browser developer tools (F12)
2. Check the `i18next` logs (when `debug: true`)
3. Change the browser language in your browser settings
4. Clear `localStorage` with the command above
5. Reload the page

#### Option C: Test Manually in the Console
```javascript
// View current browser language
console.log(navigator.language);

// View language detected/stored by i18next
console.log(localStorage.getItem('i18nextLng'));

// Force a specific language
localStorage.setItem('i18nextLng', 'en');
location.reload();
```

### 3. Check the Browser Console

With `debug: true`, you should see logs such as:
```
i18next: languageChanged pt-BR
i18next: initialized {...}
```

### 4. Supported Languages

| Browser Code     | Loaded Language | File Used    |
|------------------|-----------------|--------------|
| pt-BR, pt        | pt-BR           | pt-BR.json   |
| en-US, en-GB, en | en              | en.json      |
| es-ES, es-MX, es | es              | es.json      |
| fr-FR, fr-CA, fr | fr              | fr.json      |

## Post-Fix Verification Steps:

1. **Clear `localStorage`**
   ```javascript
   localStorage.clear();
   location.reload();
   ```

2. **Check the browser language**
   - Open DevTools (F12)
   - Console → Type `navigator.language`
   - Should output your browser locale (e.g., `"fr-FR"`, `"en-US"`, `"pt-BR"`)

3. **Reload the page**
   - The site should render in the browser's language
   - Verify the `i18next` logs in the console

4. **Test the `LanguageSwitcher`**
   - Switch languages using the UI selector
   - Verify that the UI language updates immediately
   - Reload → the selected language should persist

## If the Problem Persists:

### Verify that `i18next` is properly initialized
```javascript
// In the browser console
import('./src/i18n/index.ts').then(i18n => console.log(i18n.default.language));
```

### Temporarily disable `localStorage` caching
Edit `src/i18n/index.ts` line 36:
```typescript
caches: [], // Temporarily disable cache
```

Then test whether detection works without caching.
