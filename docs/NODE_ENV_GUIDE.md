# NODE_ENV Configuration Guide - EthAura

This guide explains the difference between `development` and `production` modes for the EthAura backend.

## Quick Answer

**For ngrok testing**: Use `NODE_ENV=development` (current setting)  
**For production deployment**: Use `NODE_ENV=production`

## Comparison

| Feature | Development Mode | Production Mode |
|---------|------------------|-----------------|
| **CORS - Localhost** | ✅ Allowed | ✅ Allowed |
| **CORS - Local Network** | ✅ Allowed | ✅ Allowed |
| **CORS - All ngrok domains** | ✅ Auto-allowed | ❌ Not allowed |
| **CORS - Specific ngrok URL** | ✅ Allowed | ✅ Only if matches `FRONTEND_URL` |
| **CORS - Configured FRONTEND_URL** | ✅ Allowed | ✅ Allowed |
| **Rate Limiting** | ❌ Disabled | ✅ Enabled (100 req/15min) |
| **Error Details** | ✅ Full stack traces | ⚠️ Generic messages |
| **Logging** | ✅ Verbose | ✅ Standard |
| **Security** | ⚠️ Less secure | ✅ More secure |

## Development Mode (`NODE_ENV=development`)

### Configuration

```env
NODE_ENV=development
FRONTEND_URL=https://ethersafe.ngrok.app
```

### CORS Behavior

**Automatically allows**:
- ✅ `http://localhost:3000`
- ✅ `http://localhost:5173`
- ✅ `http://192.168.x.x:port` (local network)
- ✅ `https://*.ngrok.app` (ALL ngrok domains)
- ✅ `https://*.ngrok.dev` (ALL ngrok domains)
- ✅ `https://*.ngrok.io` (ALL ngrok domains)
- ✅ Configured `FRONTEND_URL`

### When to Use

✅ **Use development mode when**:
- Testing with ngrok
- Frontend URL might change frequently
- Working with multiple developers
- Rapid prototyping
- Local development

### Pros

- ✅ No need to update `.env` when ngrok URL changes
- ✅ Easier to test with different ngrok URLs
- ✅ Rate limiting disabled (no issues with React StrictMode)
- ✅ Full error messages for debugging

### Cons

- ⚠️ Less secure - any ngrok URL can access backend
- ⚠️ Not suitable for production
- ⚠️ No rate limiting protection

### Example Logs

```
🚀 EthAura Backend Server running on port 3001
📊 Environment: development
🌐 CORS enabled for: https://ethersafe.ngrok.app

✅ CORS allowed: ngrok origin: https://ethersafe.ngrok.app
✅ CORS allowed: ngrok origin: https://random123.ngrok.app
```

## Production Mode (`NODE_ENV=production`)

### Configuration

```env
NODE_ENV=production
FRONTEND_URL=https://ethersafe.ngrok.app
```

### CORS Behavior

**Only allows**:
- ✅ `http://localhost:3000`
- ✅ `http://localhost:5173`
- ✅ `http://192.168.x.x:port` (local network)
- ✅ Exact match of `FRONTEND_URL` only
- ❌ Other ngrok domains blocked

### When to Use

✅ **Use production mode when**:
- Deploying to production
- Need maximum security
- Frontend URL is stable
- Public-facing deployment

### Pros

- ✅ More secure - only specific frontend URL allowed
- ✅ Rate limiting enabled
- ✅ Production-ready security
- ✅ Explicit allowlist

### Cons

- ⚠️ Must update `.env` if frontend URL changes
- ⚠️ Requires backend restart after changing `.env`
- ⚠️ Less flexible for testing

### Example Logs

```
🚀 EthAura Backend Server running on port 3001
📊 Environment: production
🌐 CORS enabled for: https://ethersafe.ngrok.app

✅ CORS allowed: configured FRONTEND_URL: https://ethersafe.ngrok.app
⚠️ CORS blocked: ngrok origin not in FRONTEND_URL: https://random123.ngrok.app
```

## Recommendation for Your Setup

### Current Setup (ngrok with static domains)

**Recommended**: `NODE_ENV=development`

**Why**:
- ✅ You're still testing/developing
- ✅ Easier to work with if URLs change
- ✅ Backend logs show which origins are allowed
- ✅ Can switch to production mode later

**Configuration**:
```env
NODE_ENV=development
FRONTEND_URL=https://ethersafe.ngrok.app
```

### When to Switch to Production

Switch to `NODE_ENV=production` when:
- ✅ Deploying to production server
- ✅ Frontend URL is stable and won't change
- ✅ Need maximum security
- ✅ Ready for public access

**Configuration**:
```env
NODE_ENV=production
FRONTEND_URL=https://app.ethaura.com
```

## Testing Both Modes

### Test Development Mode

```bash
# Edit backend/.env
NODE_ENV=development
FRONTEND_URL=https://ethersafe.ngrok.app

# Restart backend
cd backend
npm start

# Test with random ngrok URL (should pass)
curl -H "Origin: https://random123.ngrok.app" \
  http://localhost:3001/health
```

**Expected**: ✅ CORS allowed

### Test Production Mode

```bash
# Edit backend/.env
NODE_ENV=production
FRONTEND_URL=https://ethersafe.ngrok.app

# Restart backend
cd backend
npm start

# Test with random ngrok URL (should fail)
curl -H "Origin: https://random123.ngrok.app" \
  http://localhost:3001/health
```

**Expected**: ❌ CORS blocked

## Security Implications

### Development Mode Security

**Risks**:
- ⚠️ Any ngrok URL can access your backend
- ⚠️ If someone guesses your ngrok URL, they can make requests
- ⚠️ No rate limiting protection

**Mitigations**:
- ✅ ngrok URLs are hard to guess (random subdomain)
- ✅ Backend still validates all requests
- ✅ Signature verification still required
- ✅ Only use for testing, not production

### Production Mode Security

**Benefits**:
- ✅ Only specific frontend URL allowed
- ✅ Rate limiting enabled
- ✅ Explicit allowlist
- ✅ Production-ready

**Requirements**:
- ✅ Must set `FRONTEND_URL` correctly
- ✅ Must restart backend after changes
- ✅ Must update `.env` if URL changes

## Summary

| Scenario | Recommended Mode | Configuration |
|----------|------------------|---------------|
| **ngrok testing** | `development` | `NODE_ENV=development`<br>`FRONTEND_URL=https://ethersafe.ngrok.app` |
| **Local development** | `development` | `NODE_ENV=development`<br>`FRONTEND_URL=http://localhost:3000` |
| **Production deployment** | `production` | `NODE_ENV=production`<br>`FRONTEND_URL=https://app.ethaura.com` |
| **Staging environment** | `production` | `NODE_ENV=production`<br>`FRONTEND_URL=https://staging.ethaura.com` |

## Quick Reference

**Current Configuration** (recommended for ngrok testing):
```env
NODE_ENV=development
FRONTEND_URL=https://ethersafe.ngrok.app
```

**This allows**:
- ✅ All localhost origins
- ✅ All local network origins
- ✅ All ngrok domains (*.ngrok.app, *.ngrok.dev, etc.)
- ✅ Configured FRONTEND_URL

**Switch to production when ready**:
```env
NODE_ENV=production
FRONTEND_URL=https://app.ethaura.com
```

**This allows**:
- ✅ All localhost origins
- ✅ All local network origins
- ✅ Only exact FRONTEND_URL
- ❌ Other ngrok domains blocked

