# Multi-Device Passkey Setup Guide

## Quick Start

### Automated Setup (Recommended)

Use the provided script to automatically configure local network access:

```bash
# From project root
./scripts/start-local-network.sh
```

This script will:
- Detect your local IP address (e.g., 192.168.1.4)
- Update `frontend/.env` with the correct backend URL
- Optionally start both backend and frontend services
- Display access URLs for desktop and mobile

### Manual Setup

#### 1. Backend Setup

The backend database schema is automatically created on first run. No manual migration needed.

```bash
cd backend
npm install
npm start
```

The backend will:
- Create `passkey_devices` and `device_sessions` tables
- Start session cleanup scheduler (runs hourly)
- Listen on port 3001 (default)
- Accept connections from local network IPs (192.168.x.x, 10.x.x.x, etc.)

#### 2. Frontend Setup

No additional dependencies needed - `qrcode.react` is already installed.

**For local network testing (mobile QR code flow):**
```bash
cd frontend
npm install

# Find your local IP first
ipconfig getifaddr en0  # macOS
# or
ipconfig                # Windows

# Update .env with your local IP
echo "VITE_BACKEND_URL=http://192.168.1.4:3001" > .env

# Start with network access
npm run dev -- --host
```

**For localhost testing only:**
```bash
cd frontend
npm install
npm run dev
```

The frontend will:
- Load device management components
- Enable QR code generation
- Support mobile registration page

#### 3. Environment Variables

**Backend** (`backend/.env`):
```env
PORT=3001
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

**Frontend** (`frontend/.env`):

For local network testing (mobile devices):
```env
VITE_BACKEND_URL=http://192.168.1.4:3001
VITE_HOST=192.168.1.4
```

**Note:** Setting `VITE_HOST` to your WiFi IP ensures Vite only binds to that interface, preventing VPN or virtual machine IPs from showing in the output.

For localhost only:
```env
VITE_BACKEND_URL=http://localhost:3001
```

## Testing the Implementation

### Test 1: Add Device on Current Browser

1. Start backend and frontend
2. Login with Web3Auth
3. Create or select a wallet
4. Go to Wallet Settings → Passkey Settings
5. Scroll to "Multi-Device Passkeys" section
6. Click "Add Device"
7. Select "This Device"
8. Enter device name (e.g., "MacBook Pro")
9. Click "Create Passkey"
10. Authenticate with Touch ID/Face ID
11. Verify device appears in list

**Expected Result:** Device added successfully, shows in device list with creation timestamp.

### Test 2: Add Device via QR Code (Mobile)

**Prerequisites:**
- Mobile device with camera
- Mobile and desktop on same WiFi network
- Backend configured to accept local network connections (already configured)

**Setup:**

1. Find your local network IP address:
   ```bash
   # macOS/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   # or
   ipconfig getifaddr en0

   # Windows
   ipconfig | findstr IPv4
   ```

   Example output: `192.168.1.4`

2. Update frontend `.env` to use local IP:
   ```env
   VITE_BACKEND_URL=http://192.168.1.4:3001
   ```

3. Restart frontend dev server:
   ```bash
   npm run dev -- --host
   ```

4. Access frontend from desktop using local IP:
   ```
   http://192.168.1.4:5173
   ```

**Steps:**

1. On desktop: Click "Add Device" → "Mobile / Tablet"
2. QR code appears
3. On mobile: Open camera app and scan QR code
4. Mobile browser opens registration page
5. Enter device name (e.g., "iPhone 14")
6. Click "Create Passkey"
7. Authenticate with Face ID/Touch ID on mobile
8. Desktop shows "Device registered successfully!"
9. Verify device appears in list on desktop

**Expected Result:** Mobile device added, shows in list with "mobile" type.

### Test 3: Remove Device

1. In device list, click "Remove" on any device (except last one)
2. Confirm removal in dialog
3. Verify device is removed from list

**Expected Result:** Device removed, list updates automatically.

### Test 4: Browser Native Picker

**Note:** This requires having multiple passkeys registered for the same account.

1. Register 2+ devices for the same account
2. Go to Send Transaction screen
3. Enter recipient and amount
4. Click "Sign with Passkey"
5. Browser should show picker with all available passkeys
6. Select one and authenticate

**Expected Result:** Browser shows native picker, transaction signed with selected device.

## Development Tips

### Debugging Device Registration

Enable verbose logging in browser console:

```javascript
// In browser console
localStorage.setItem('debug', 'ethaura:*')
```

Check backend logs:
```bash
# Backend terminal shows:
📱 Adding device: MacBook Pro (desktop) for account 0x123...
✅ Device added successfully
```

### Testing QR Code Flow Locally

**Option 1: Local Network (Recommended)**

Both devices on same WiFi network:

```bash
# Find your local IP
ifconfig | grep "inet " | grep -v 127.0.0.1
# Example: 192.168.1.4

# Update frontend/.env
VITE_BACKEND_URL=http://192.168.1.4:3001

# Start frontend with network access
npm run dev -- --host

# Access from desktop browser
http://192.168.1.4:5173
```

**Option 2: ngrok (Alternative)**

If devices are on different networks:

```bash
# Terminal 1: Start backend
cd backend
npm start

# Terminal 2: Expose backend
ngrok http 3001

# Update frontend/.env
VITE_BACKEND_URL=https://your-ngrok-url.ngrok.io
```

### Database Inspection

View registered devices:

```bash
cd backend
sqlite3 passkey_credentials.db

# List all devices
SELECT device_name, device_type, created_at 
FROM passkey_devices 
WHERE account_address = '0x...';

# List active sessions
SELECT session_id, status, created_at, expires_at 
FROM device_sessions 
WHERE status = 'pending';
```

### Manual Session Cleanup

```bash
# In backend directory
node -e "
const db = require('./database.js');
db.cleanupExpiredSessions().then(() => {
  console.log('Cleanup complete');
  process.exit(0);
});
"
```

## Common Issues

### Issue: QR Code Not Accessible from Mobile

**Solution:** Ensure mobile and desktop are on same WiFi network and using local IP.

```bash
# 1. Find your local IP
ifconfig | grep "inet " | grep -v 127.0.0.1
# Example output: inet 192.168.1.4

# 2. Update frontend/.env
VITE_BACKEND_URL=http://192.168.1.4:3001

# 3. Restart frontend with network access
npm run dev -- --host

# 4. Access from desktop using local IP
# Open browser to: http://192.168.1.4:5173
```

**Checklist:**
- [ ] Both devices on same WiFi network
- [ ] Backend running and accessible
- [ ] Frontend using local IP (not localhost)
- [ ] Accessing frontend from local IP (not localhost)
- [ ] Mobile can ping desktop IP: `ping 192.168.1.4`

### Issue: Session Expired

**Solution:** Sessions expire after 10 minutes. Create a new session.

### Issue: Cannot Create Passkey

**Possible causes:**
- Not using HTTPS or localhost
- Platform authenticator not available
- Browser doesn't support WebAuthn

**Solution:** Use Chrome/Safari/Edge on HTTPS or localhost.

### Issue: Device Not Showing in List

**Solution:** Check browser console and backend logs for errors. Verify Web3Auth is connected.

## API Testing with cURL

### Add Device
```bash
curl -X POST http://localhost:3001/api/devices \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "0x123...",
    "ownerAddress": "0xabc...",
    "signature": "0x...",
    "message": "...",
    "timestamp": 1234567890,
    "deviceName": "Test Device",
    "deviceType": "desktop",
    "credential": {...}
  }'
```

### Get Devices
```bash
curl "http://localhost:3001/api/devices/0x123...?signature=0x...&message=...&timestamp=1234567890&ownerAddress=0xabc..."
```

### Create Session
```bash
curl -X POST http://localhost:3001/api/sessions/create \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "0x123...",
    "ownerAddress": "0xabc...",
    "signature": "0x...",
    "message": "...",
    "timestamp": 1234567890
  }'
```

## Production Deployment

### Backend

1. Set `NODE_ENV=production`
2. Use proper database backup strategy
3. Enable HTTPS
4. Set CORS to specific frontend URL
5. Use environment variables for secrets

### Frontend

1. Build for production: `npm run build`
2. Deploy to CDN or static hosting
3. Ensure HTTPS is enabled
4. Update `VITE_BACKEND_URL` to production backend

### Security Checklist

- [ ] HTTPS enabled on both frontend and backend
- [ ] CORS configured to specific origins
- [ ] Database backups scheduled
- [ ] Session cleanup running
- [ ] Rate limiting on API endpoints
- [ ] Signature verification on all endpoints
- [ ] Input validation and sanitization

## Next Steps

After testing the implementation:

1. **Integration Testing** - Test all flows end-to-end
2. **Documentation** - Update user-facing docs
3. **Deployment** - Deploy to staging environment
4. **User Testing** - Get feedback from beta users
5. **Production** - Deploy to production

## Support

For issues or questions:
- GitHub Issues: https://github.com/hadv/ethaura/issues
- Documentation: `/docs/MULTI_DEVICE_PASSKEYS.md`

