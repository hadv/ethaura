# ngrok Setup Guide for EthAura

This guide explains how to set up EthAura with ngrok for mobile testing and production deployment.

## Why Use ngrok?

ngrok provides HTTPS tunnels to your local development server, which is essential for:

1. **Mobile Device Testing**: Test passkey registration on mobile devices (iOS/Android)
2. **WebAuthn Requirements**: Many authenticators require HTTPS for security
3. **Cross-Network Access**: Access your local server from different networks
4. **Production-like Environment**: Test with HTTPS before deploying to production

## Architecture with ngrok

When using ngrok, the frontend calls the backend directly (no Vite proxy needed):

```
┌─────────────────────────────────────────────────────────┐
│  User's Browser                                         │
│  https://ethersafe.ngrok.app                            │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ Direct API calls (no proxy)
                 │ fetch('https://ethaura.ngrok.dev/api/...')
                 ▼
┌─────────────────────────────────────────────────────────┐
│  ngrok Tunnel (Backend)                                 │
│  https://ethaura.ngrok.dev                              │
└────────────────┬────────────────────────────────────────┘
                 │
                 │ Tunnel to localhost
                 ▼
┌─────────────────────────────────────────────────────────┐
│  Backend Server                                         │
│  http://localhost:3001                                  │
└─────────────────────────────────────────────────────────┘
```

**Key Points**:
- ✅ Frontend calls backend directly via `VITE_BACKEND_URL`
- ✅ No Vite proxy needed (proxy is disabled in `vite.config.js`)
- ✅ Both frontend and backend use HTTPS (provided by ngrok)
- ✅ CORS is handled by backend (allows `https://ethersafe.ngrok.app`)

## Prerequisites

1. Install ngrok: https://ngrok.com/download
2. Sign up for ngrok account (free tier is sufficient)
3. Authenticate ngrok: `ngrok config add-authtoken YOUR_TOKEN`

## Setup Instructions

### Option 1: Development Mode (Automatic ngrok Support)

In development mode, the backend automatically allows all ngrok domains.

**Backend Setup**:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:
```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

**Frontend Setup**:

```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env`:
```env
VITE_BACKEND_URL=https://your-backend.ngrok.dev
# ... other config
```

**Start Services**:

```bash
# Terminal 1: Start backend
cd backend
npm start

# Terminal 2: Expose backend with ngrok
ngrok http 3001
# Copy the HTTPS URL (e.g., https://abc123.ngrok.dev)

# Terminal 3: Update frontend .env with ngrok URL and start
cd frontend
# Update VITE_BACKEND_URL in .env
npm run dev -- --host
```

### Option 2: Production Mode (Explicit Frontend URL)

For production or when you want explicit control over allowed origins.

**Backend Setup**:

Edit `backend/.env`:
```env
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://ethersafe.ngrok.app
```

**Frontend Setup**:

Edit `frontend/.env`:
```env
VITE_BACKEND_URL=https://your-backend.ngrok.dev
# ... other config
```

**Start Services**:

```bash
# Terminal 1: Start backend
cd backend
npm start

# Terminal 2: Expose backend with ngrok
ngrok http 3001
# Copy the HTTPS URL

# Terminal 3: Expose frontend with ngrok (static domain)
cd frontend
npm run build
npx serve -s dist -l 3000

# Terminal 4: Expose frontend
ngrok http 3000 --domain=ethersafe.ngrok.app
```

## Using ngrok Static Domains

ngrok offers static domains (e.g., `ethersafe.ngrok.app`) that don't change between sessions.

**Benefits**:
- ✅ Consistent URL across restarts
- ✅ No need to update `.env` files
- ✅ Better for production-like testing
- ✅ Can configure in Web3Auth dashboard

**Setup**:

1. Go to https://dashboard.ngrok.com/cloud-edge/domains
2. Create a static domain (e.g., `ethersafe.ngrok.app`)
3. Use it with ngrok:

```bash
ngrok http 3000 --domain=ethersafe.ngrok.app
```

## CORS Configuration

The backend automatically handles CORS for ngrok URLs:

### Development Mode (`NODE_ENV=development`)

All ngrok domains are automatically allowed:
- `*.ngrok.io`
- `*.ngrok.app`
- `*.ngrok.dev`
- `*.ngrok-free.app`
- `*.ngrok-free.dev`

### Production Mode (`NODE_ENV=production`)

Only the exact `FRONTEND_URL` is allowed. Set it in `backend/.env`:

```env
FRONTEND_URL=https://ethersafe.ngrok.app
```

## Testing Passkey Registration

### Desktop Browser

1. Open frontend URL: `https://ethersafe.ngrok.app`
2. Login with Web3Auth
3. Go to Passkey Settings
4. Click "Add New Device"
5. Register passkey (will use platform authenticator)

### Mobile Device

1. Open frontend URL on mobile: `https://ethersafe.ngrok.app`
2. Login with Web3Auth
3. Go to Passkey Settings
4. Click "Add New Device"
5. Register passkey (will use Face ID/Touch ID)

### QR Code Registration

1. On desktop: Go to Passkey Settings → "Add New Device"
2. Scan QR code with mobile device
3. Complete registration on mobile
4. Device appears in desktop UI

## Troubleshooting

### CORS Errors

**Symptom**: `Access to fetch at 'https://...' from origin 'https://...' has been blocked by CORS`

**Solution**:

1. Check backend logs for CORS warnings
2. Verify `FRONTEND_URL` in `backend/.env` matches exactly
3. For development, ensure `NODE_ENV=development`
4. For production, set exact frontend URL

### ngrok URL Changes

**Symptom**: ngrok URL changes every restart, breaking configuration

**Solution**:

1. Use ngrok static domains (paid feature)
2. Or update `.env` files after each ngrok restart
3. Or use development mode (auto-allows all ngrok domains)

### WebAuthn Not Working

**Symptom**: "WebAuthn is not supported" or passkey registration fails

**Solution**:

1. Ensure using HTTPS (ngrok provides this)
2. Check browser console for errors
3. Verify `VITE_BACKEND_URL` uses HTTPS
4. Test on different browser/device

### Backend Not Accessible

**Symptom**: Frontend can't reach backend API

**Solution**:

1. Verify ngrok is running: `ngrok http 3001`
2. Check `VITE_BACKEND_URL` in frontend `.env`
3. Test backend directly: `curl https://your-backend.ngrok.dev/health`
4. Check backend logs for errors

## Configuration Summary

### Backend `.env`

```env
# Development mode (auto-allows all ngrok domains)
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# OR Production mode (explicit frontend URL)
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://ethersafe.ngrok.app
```

### Frontend `.env`

```env
# Backend URL - frontend calls backend directly (no proxy needed)
VITE_BACKEND_URL=https://ethaura.ngrok.dev
# ... other config
```

### Frontend `vite.config.js`

Already configured to allow ngrok domains:

```javascript
allowedHosts: [
  '.ngrok-free.app',
  '.ngrok-free.dev',
  '.ngrok.io',
  '.ngrok.app',
  'ethersafe.ngrok.app', // Specific static domain
],
```

**Note**: Vite proxy is disabled when using ngrok. The frontend calls the backend directly via `VITE_BACKEND_URL`.

## Best Practices

1. **Use Static Domains**: For consistent URLs across sessions
2. **Development Mode**: Use for testing, auto-allows all ngrok domains
3. **Production Mode**: Use explicit `FRONTEND_URL` for security
4. **HTTPS Only**: Always use HTTPS URLs from ngrok
5. **Update Web3Auth**: Add ngrok URLs to Web3Auth dashboard allowed origins
6. **Test Mobile**: Always test on real mobile devices before production

## Security Notes

⚠️ **Important Security Considerations**:

1. **Development Mode**: Auto-allows all ngrok domains - use only for testing
2. **Production Mode**: Explicitly set `FRONTEND_URL` - more secure
3. **ngrok Free Tier**: URLs are public - anyone can access if they know the URL
4. **Static Domains**: More secure than random URLs, but still public
5. **Production Deployment**: Use proper domain with SSL certificate, not ngrok

## Next Steps

After testing with ngrok:

1. Deploy backend to production server (VPS, cloud provider)
2. Deploy frontend to static hosting (Vercel, Netlify, Cloudflare Pages)
3. Configure custom domain with SSL certificate
4. Update Web3Auth dashboard with production URLs
5. Update `FRONTEND_URL` in production backend `.env`

## References

- [ngrok Documentation](https://ngrok.com/docs)
- [ngrok Static Domains](https://ngrok.com/docs/network-edge/domains-and-tcp-addresses/)
- [WebAuthn Specification](https://www.w3.org/TR/webauthn-2/)
- [EthAura Production Guide](./backend/PRODUCTION.md)

