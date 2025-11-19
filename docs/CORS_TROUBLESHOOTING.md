# CORS Troubleshooting Guide - EthAura

This guide helps you diagnose and fix CORS (Cross-Origin Resource Sharing) issues in EthAura.

## Quick Diagnosis

### Symptom: CORS Error in Browser Console

```
Access to fetch at 'https://ethaura.ngrok.dev/api/...' from origin 'https://ethersafe.ngrok.app' 
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the 
requested resource.
```

### Quick Fix Checklist

1. ✅ Check `FRONTEND_URL` in `backend/.env` matches your frontend URL exactly
2. ✅ Restart backend server after changing `.env`
3. ✅ Check backend logs for CORS messages
4. ✅ Verify frontend is using correct `VITE_BACKEND_URL`

## CORS Configuration Overview

EthAura backend automatically allows CORS for:

### Always Allowed

1. **Localhost origins**:
   - `http://localhost:3000`
   - `http://localhost:5173`
   - `http://127.0.0.1:3000`
   - `http://127.0.0.1:5173`

2. **Local network IPs**:
   - `http://192.168.x.x:port`
   - `http://10.x.x.x:port`
   - `http://172.16-31.x.x:port`

3. **No origin** (mobile apps, curl):
   - Requests without `Origin` header

### Conditionally Allowed

4. **ngrok domains** (development mode):
   - `https://*.ngrok.io`
   - `https://*.ngrok.app`
   - `https://*.ngrok.dev`
   - `https://*.ngrok-free.app`
   - `https://*.ngrok-free.dev`

5. **Configured frontend URL** (production mode):
   - Exact match of `FRONTEND_URL` from `.env`

## Configuration

### Backend `.env`

```env
# Development mode - auto-allows all ngrok domains
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# OR Production mode - only allows exact FRONTEND_URL
NODE_ENV=production
FRONTEND_URL=https://ethersafe.ngrok.app
```

### Frontend `.env`

```env
VITE_BACKEND_URL=https://ethaura.ngrok.dev
```

## Testing CORS

### Method 1: Automated Test Script

```bash
cd backend
node test-cors.js http://localhost:3001 https://ethersafe.ngrok.app
```

### Method 2: Manual curl Test

```bash
# Test with origin header
curl -v \
  -H "Origin: https://ethersafe.ngrok.app" \
  https://ethaura.ngrok.dev/health

# Look for this header in response:
# access-control-allow-origin: https://ethersafe.ngrok.app
```

### Method 3: Browser Console

```javascript
// Open browser console at https://ethersafe.ngrok.app
fetch('https://ethaura.ngrok.dev/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error)
```

## Backend Logs

The backend logs detailed CORS information:

### Successful CORS

```
✅ CORS allowed: configured FRONTEND_URL: https://ethersafe.ngrok.app
✅ CORS allowed: ngrok origin: https://ethersafe.ngrok.app
✅ CORS allowed: localhost origin: http://localhost:3000
✅ CORS allowed: local network origin: http://192.168.1.4:3000
✅ CORS allowed: no origin (mobile app/curl)
```

### Blocked CORS

```
⚠️ CORS blocked origin: https://evil.com
   Expected FRONTEND_URL: https://ethersafe.ngrok.app
```

## Common Issues

### Issue 1: CORS Blocked After Changing `.env`

**Symptom**: Changed `FRONTEND_URL` but still getting CORS errors

**Solution**:
1. Restart backend server (changes to `.env` require restart)
2. Clear browser cache
3. Hard refresh frontend (Cmd+Shift+R or Ctrl+Shift+R)

### Issue 2: ngrok URL Not Allowed in Production

**Symptom**: `⚠️ CORS blocked: ngrok origin not in FRONTEND_URL`

**Solution**:
1. Set `FRONTEND_URL=https://ethersafe.ngrok.app` in `backend/.env`
2. Restart backend
3. Or set `NODE_ENV=development` to auto-allow all ngrok domains

### Issue 3: CORS Works in Development, Fails in Production

**Symptom**: Works with `NODE_ENV=development`, fails with `NODE_ENV=production`

**Solution**:
1. In production mode, only exact `FRONTEND_URL` is allowed
2. Set `FRONTEND_URL` to your exact frontend URL
3. Restart backend

### Issue 4: Preflight Request Fails

**Symptom**: Browser makes OPTIONS request that fails

**Solution**:
1. Backend automatically handles OPTIONS requests
2. Check backend logs for CORS messages
3. Verify `Access-Control-Allow-Methods` header is present

### Issue 5: Credentials Not Sent

**Symptom**: Cookies or credentials not sent with requests

**Solution**:
1. Backend already sets `credentials: true`
2. Frontend must use `credentials: 'include'` in fetch:
   ```javascript
   fetch(url, { credentials: 'include' })
   ```

## Debugging Steps

### Step 1: Check Backend Logs

Start backend and watch for CORS messages:

```bash
cd backend
npm start

# Look for:
# 🌐 CORS enabled for: https://ethersafe.ngrok.app
```

### Step 2: Make Test Request

From frontend, make a test request and check backend logs:

```javascript
// In browser console at https://ethersafe.ngrok.app
fetch('https://ethaura.ngrok.dev/health')
  .then(r => r.json())
  .then(console.log)
```

Backend should log:
```
✅ CORS allowed: configured FRONTEND_URL: https://ethersafe.ngrok.app
```

### Step 3: Check Response Headers

In browser DevTools → Network tab:

1. Find the request to backend
2. Check Response Headers
3. Look for:
   ```
   access-control-allow-origin: https://ethersafe.ngrok.app
   access-control-allow-credentials: true
   ```

### Step 4: Verify Configuration

```bash
# Check backend .env
cat backend/.env | grep FRONTEND_URL

# Check frontend .env
cat frontend/.env | grep VITE_BACKEND_URL
```

## Advanced Configuration

### Allow Multiple Origins

If you need to allow multiple frontend URLs, modify `backend/server.js`:

```javascript
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://ethersafe.ngrok.app',
  'https://app.ethaura.com', // Production domain
]

if (allowedOrigins.includes(origin)) {
  console.log('✅ CORS allowed:', origin)
  callback(null, true)
}
```

### Disable CORS (Development Only)

**⚠️ NOT RECOMMENDED - Security Risk**

```javascript
// In backend/server.js
app.use(cors({ origin: '*', credentials: true }))
```

## Security Notes

1. **Never use `origin: '*'` with `credentials: true`** - browsers will block it
2. **Always validate origins** - don't trust user input
3. **Use HTTPS in production** - ngrok provides this automatically
4. **Limit allowed origins** - only allow trusted domains

## References

- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Express CORS Middleware](https://expressjs.com/en/resources/middleware/cors.html)
- [CORS Errors Explained](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS/Errors)

