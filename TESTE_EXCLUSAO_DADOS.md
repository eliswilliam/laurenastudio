# 🧪 [TEST] Data Deletion Flow (LGPD)

## 📋 Summary of Changes

### 🔧 Backend (`app/routes/data_deletion.py`)

#### ✅ Change 1: Token Handoff to HTML Page
- **Problem**: When the deletion page was opened in a new tab via `window.open()`, `localStorage` in the new window could be empty depending on how the tab was opened.
- **Solution**: Extract the token from the `Authorization` header on the server and pass it safely into the rendered confirmation page, with fallback to `localStorage` / `sessionStorage`.
- **Endpoint**: `GET /api/v1/webhooks/delete-my-data`
- **Code**:
  ```python
  auth_header = request.headers.get("Authorization", "")
  token = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else ""
  ```

#### ✅ Change 2: Support Unauthenticated Deletion Requests
- **Problem**: The public `DeleteMyData.tsx` page attempted to send a request without a JWT, while the primary endpoint required authentication.
- **Solution**: Created a public endpoint `POST /api/v1/webhooks/request-deletion-public`.
- **File**: `backend/app/routes/data_deletion.py`
- **Security**: Looks up the user by email and returns a generic success response even if the email does not exist (prevents user enumeration).

### 🎨 Frontend (`src/pages/DeleteMyData.tsx`)
- Updated endpoint called: `/request-deletion` → `/request-deletion-public`
- Uses `FormData` as expected by the public endpoint
- Removed unused `provider` parameter

---

## 🧪 How to Test

### Test 1: Authenticated Flow (Settings)
**Objective**: Verify that account deletion works when the user is logged in.

#### Steps:
1. 🔐 **Log in** to the application
2. ⚙️ **Go to Settings** > **Data Deletion (LGPD)**
3. 🔘 **Click** "Access Data Deletion Center"
4. 🪟 **A new tab should open** with:
   - Title: "Delete my data" (`Excluir meus dados`)
   - Badge showing the detected login provider (Google, Facebook, or Platform)
   - Warning about irreversible action
   - Confirmation checkbox
5. ☑️ **Check** the confirmation checkbox
6. ✅ **Click** "Delete and log out" (`Deletar e desconectar`)
7. 📊 **Verify response**:
   - ✓ Displays "Deletion requested"
   - ✓ Displays confirmation code
   - ✓ Redirects to home in 3 seconds
   - ✓ User is automatically logged out

**Expected Result**: ✅ Complete flow executes without errors.

---

### Test 2: Unauthenticated Flow (`DeleteMyData.tsx`)
**Objective**: Verify that unauthenticated users can request data deletion via email.

#### Steps:
1. 🚫 **Log out** (if currently logged in)
2. 📄 **Navigate directly** to `/delete-my-data` (or `/deletar-dados`)
3. ✉️ **Enter a valid email address**
4. 🔘 **Click** "Request Deletion"
5. 📊 **Verify response**:
   - ✓ Displays success state
   - ✓ Displays confirmation code
   - ✓ Mentions deletion within 30 days

**Expected Result**: ✅ Request processed picks up and returns confirmation.

---

### Test 3: Validate POST Request
**Objective**: Verify that the authenticated `POST` request is sent with the proper `Authorization` header.

#### Steps:
1. 🔐 Log in
2. ⚙️ Go to Settings > Data Deletion > Click "Access Center"
3. 🪟 **In the new tab**, press **F12** (DevTools)
4. 📡 **Open the Network tab**
5. ☑️ **Check the confirmation box and click "Delete"**
6. 📊 **Inspect the request**:
   - ✓ URL: `/api/v1/webhooks/request-deletion`
   - ✓ Method: `POST`
   - ✓ Status: `200 OK`
   - ✓ Headers: `Authorization: Bearer {token}`
   - ✓ Response contains `"status": "deleted"`

**Expected Result**: ✅ Authenticated request succeeds.

---

### Test 4: Verify Automatic Logout
**Objective**: Validate that tokens are cleared after deletion.

#### Steps:
1. 🔐 Log in
2. ⚙️ Go to Settings > Data Deletion > Click "Access Center"
3. ☑️ **Confirm and delete**
4. 📊 **After success**:
   - Open DevTools Console
   - Type: `localStorage.getItem('access_token')`
   - ✓ Should return `null` (token removed)
   - ✓ Should redirect to home (`/`)
   - ✓ Attempting to access Settings should redirect to Login

**Expected Result**: ✅ Automatic logout and token cleanup complete.

---

## 🐛 Troubleshooting

### ❌ "401 Unauthorized" when accessing the deletion page
**Cause**: Token was not sent or has expired.
**Solution**:
- Log in again
- Automatic redirect to `/login` should occur
- Verify that `localStorage` contains `access_token`

### ❌ New tab opens blank or with an error
**Cause**: CORS or script error.
**Solution**:
- Check the Console (F12) for error messages
- Confirm the backend is running on `http://localhost:8000`
- Test the request manually:
  ```bash
  curl -H "Authorization: Bearer {your_token}" \
    http://localhost:8000/api/v1/webhooks/delete-my-data
  ```

---

## 📊 Automated Testing

To test the entire flow programmatically:

```bash
cd backend
python test_deletion_flow.py
```

**Create a test account first if needed**:
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teste@example.com",
    "password": "senha123",
    "full_name": "Test User"
  }'
```

---

## ✅ Validation Checklist

- [ ] Authenticated flow (Settings) works
- [ ] New tab opens and renders properly
- [ ] Deletion confirmation is processed
- [ ] Success screen displays confirmation code
- [ ] Automatic logout occurs
- [ ] Tokens are cleared from `localStorage`
- [ ] Unauthenticated flow works
- [ ] Email request is processed without leaking user existence

---

## 📝 Notes

- 🔒 **Security**: The public flow never reveals whether an email exists in the database (prevents user enumeration).
- ⏱️ **LGPD Compliance**: Data is deleted/anonymized in compliance with LGPD requirements.
- 🔄 **Fallback**: Falls back to `localStorage` / `sessionStorage` if no server-injected token is present.
