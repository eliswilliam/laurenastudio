# ✅ Manual Test — Data Deletion Flow (LGPD / GDPR)

## 🎯 Objective
Validate that the user data deletion flow works end-to-end starting from the frontend **Settings** page.

---

## 📋 Test Credentials

```
📧 Email: demoaccount@example.com
🔐 Password: DemoPassword123!
```

---

## 🧪 Step-by-Step Procedure

### Step 1️⃣: Open the Application
1. Open your browser
2. Navigate to: **http://localhost:8080**
3. You should see the home or login page

### Step 2️⃣: Log In
1. Click **Login** (if not already logged in)
2. Enter the test credentials:
   - Email: `demoaccount@example.com`
   - Password: `DemoPassword123!`
3. Click **Sign In** (`Entrar`)
4. ✅ You should be logged in and see your workspace

### Step 3️⃣: Go to Settings
1. Locate the **⚙️ Settings** (`Configurações`) icon
2. Click it
3. You should see the tabs: Profile, Branding, Connections, Networks, **Privacy** (`Privacidade`)

### Step 4️⃣: Access Data Deletion
1. Click the **Privacy** (`Privacidade`) tab (🔒 lock icon)
2. You should see the section:
   ```
   ⚠️ Warning: Irreversible Action
   Data Deletion (LGPD)
   Request permanent deletion of all your personal data from the platform.
   ```
3. Click the **"Access Data Deletion Center"** (`Acessar Central de Exclusão de Dados`) button

### Step 5️⃣: Verify New Tab (Critical!)
A **new tab should open** displaying the confirmation form:

```
┌─────────────────────────────────────────┐
│  Delete my data                          │
│  🔐 Connected via: Laurena Platform      │
│                                          │
│  ⚠️ Warning: Irreversible Action         │
│  • You will be logged out immediately    │
│  • All data will be removed              │
│  • Recovery is not possible after delete │
│                                          │
│  ☑ I confirm I want to permanently...    │
│  [Delete and log out]                    │
└─────────────────────────────────────────┘
```

**Verify:**
- ✅ Badge showing the login provider (Laurena Platform, Google, or Facebook)
- ✅ Warning box in red/orange
- ✅ Confirmation checkbox
- ✅ "Delete and log out" (`Deletar e desconectar`) button

### Step 6️⃣: Confirm Deletion
1. **Check the confirmation box**
2. The submit button should become enabled
3. Click **"Delete and log out"** (`Deletar e desconectar`)

### Step 7️⃣: Validate Success
After a few seconds, you should see:

```
┌─────────────────────────────────────────┐
│  ✓ Deletion requested                    │
│                                          │
│  Your account will be deleted within     │
│  30 days in accordance with LGPD.        │
│                                          │
│  Confirmation code:                      │
│  [858b2d32-6b8d-4ced-be55-...]           │
│                                          │
│  You will be redirected in 3 seconds...  │
└─────────────────────────────────────────┘
```

**Next:**
- ✅ Page redirects to home (`/`)
- ✅ You are **automatically logged out**
- ✅ Tokens are removed from `localStorage`

### Step 8️⃣: Validate Logout
To confirm you have been logged out:
1. Try accessing **Settings** (`Configurações`) again
2. You should be **redirected to login**
3. Or the login button should be visible

---

## 🔍 Debugging (If Something Goes Wrong)

### Scenario: "401 Unauthorized Error"
**Cause**: Token is not being sent or has expired.

**Solution**:
1. Log in again
2. Check DevTools (F12) → Application → `localStorage`
3. Confirm that `access_token` exists and is not empty
4. Try again

### Scenario: New tab does not open
**Cause**: Pop-up blocker is active.

**Solution**:
1. Allow pop-ups for this site
2. Temporarily disable ad/pop-up blocking extensions
3. Try again

### Scenario: "Blank page" in the new tab
**Cause**: Error rendering HTML.

**Solution**:
1. Open DevTools (F12) → Console
2. Look for red error messages
3. verify the authentication token in session/local storage

### Scenario: "Processing..." state never finishes
**Cause**: POST request did not return a response.

**Solution**:
1. Open DevTools → Network
2. Look for the request to `/api/v1/webhooks/request-deletion`
3. Verify that it returns `200 OK` and `{"status": "deleted"}`
4. If it returns an error, note the status code

---

## 📱 Detailed Expected Behavior

### In the Main Tab (Settings)
1. Button disables briefly upon click
2. Loading spinner appears briefly

### In the New Tab (Deletion Page)
1. Loads styled HTML (terracotta/beige theme)
2. Shows provider badge ("Detecting..." → "Connected via: ...")
3. Displays prominent warning notice
4. Checkbox is interactive (can be checked/unchecked)
5. Submit button remains disabled until checkbox is checked
6. Upon clicking: "⏳ Processing deletion..." appears
7. After success: Green checkmark with confirmation code
8. Automatic redirect after 3 seconds

### In the Database
- User record is deleted (LGPD compliance)
- Associated workspace and user data are deleted
- No personal records remain for the deleted user

---

## 🧠 What This Test Validates

| Item | What It Checks | Expected |
|------|----------------|----------|
| 1. Token in Header | Authorization Bearer token sent | ✅ Present |
| 2. Token Handoff | Token available to the deletion page | ✅ Valid JWT |
| 3. HTML Rendering | Page loads with proper styling | ✅ Well formatted |
| 4. Provider Detection | JavaScript detects login provider | ✅ "Laurena Platform" |
| 5. Form Validation | Required checkbox works | ✅ Button enables on check |
| 6. POST Request | Deletion request sent with JWT | ✅ 200 OK |
| 7. Data Deletion | User deleted from database | ✅ Removed |
| 8. Logout | Tokens removed from `localStorage` | ✅ `localStorage` cleared |
| 9. Redirect | Redirects to home page | ✅ URL is `/` |

---

## 💾 Related Files

- **test_deletion_complete.py** — Automated end-to-end test script
- **create_test_user.py** — Helper script to create a test user
- **TESTE_EXCLUSAO_DADOS.md** — Detailed technical guide for the data deletion flow
- **MANUAL_TEST.md** — Manual testing instructions (this file)

---

## ✅ Final Checklist

Check off items as you test:

- [ ] Successful login with `demoaccount@example.com`
- [ ] Settings page accessible
- [ ] Privacy tab visible
- [ ] "Access Data Deletion Center" button clickable
- [ ] New tab opens
- [ ] Deletion page loads without errors
- [ ] Badge displays "Connected via: Laurena Platform"
- [ ] Checkbox can be checked
- [ ] Submit button enables when checkbox is checked
- [ ] Clicking "Delete and log out" works
- [ ] "Processing deletion..." state appears
- [ ] Success message displayed with confirmation code
- [ ] Redirects to home page
- [ ] Logged out (login required to access protected routes again)
- [ ] `localStorage` cleared of auth tokens

---

## 🎉 Expected Result

✅ **Complete flow working:** Login → Settings → Data Deletion → Confirmation → Logout → Home
