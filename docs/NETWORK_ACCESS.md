# Network Access for Mobile Testing

## Default Configuration

Vite is configured to listen on **all network interfaces** (`host: '0.0.0.0'` in `vite.config.js`).

When you run `npm run dev`, Vite shows all available network interfaces:

```
  ➜  Local:   http://localhost:3000/
  ➜  Network: http://10.33.33.1:3000/      ← VPN interface
  ➜  Network: http://192.168.1.4:3000/     ← WiFi interface
```

**This is normal and expected!** Your app is accessible from all interfaces.

## For Mobile Testing

### Quick Setup

1. **Find your WiFi IP:**
   ```bash
   ipconfig getifaddr en0  # macOS
   ipconfig                # Windows
   ```
   Example: `192.168.1.4`

2. **Update `frontend/.env`:**
   ```env
   VITE_BACKEND_URL=http://192.168.1.4:3001
   ```

3. **Start services:**
   ```bash
   # Use the automated script
   ./scripts/start-local-network.sh
   
   # Or manually:
   cd backend && npm start &
   cd frontend && npm run dev
   ```

4. **Use the WiFi URL:**
   - Desktop: `http://192.168.1.4:3000`
   - Mobile: `http://192.168.1.4:3000` (same URL)

### Which URL to Use?

From the Vite output, **use your WiFi IP** (usually `192.168.x.x`), not VPN:

```
  ➜  Network: http://10.33.33.1:3000/      ← VPN (ignore)
  ➜  Network: http://192.168.1.4:3000/     ← WiFi (use this)
```

**Why?** Mobile devices need to be on the same WiFi network to access your dev server.

## Troubleshooting

### Mobile Can't Connect

1. **Check same WiFi network:**
   - Desktop and mobile must be on the same WiFi
   - VPN can interfere - try disconnecting VPN

2. **Check firewall:**
   ```bash
   # macOS: Allow Node.js
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add $(which node)
   ```

3. **Test backend:**
   ```bash
   # From mobile browser
   http://192.168.1.4:3001/health
   # Should return: {"status":"ok"}
   ```

### Too Many Network Interfaces Showing

This is normal if you have VPN, Docker, VirtualBox, etc. Just use your WiFi IP (usually `192.168.x.x`).

The server listens on all interfaces for maximum compatibility, but you only need to use one URL.

## How It Works

```javascript
// vite.config.js
export default defineConfig({
  server: {
    host: '0.0.0.0',  // Listen on all interfaces
    port: 3000,
  },
});
```

- `host: '0.0.0.0'` means "listen on all network interfaces"
- Vite will show all available IPs in the output
- You choose which one to use (WiFi for mobile testing)
- The server is accessible from any of the listed IPs

## Alternative: ngrok

If local network doesn't work (corporate network, complex VPN setup):

```bash
# Terminal 1: Start backend
cd backend && npm start

# Terminal 2: Expose with ngrok
ngrok http 3001

# Terminal 3: Update frontend and start
# Copy the ngrok HTTPS URL
echo "VITE_BACKEND_URL=https://abc123.ngrok.io" > frontend/.env
cd frontend && npm run dev
```

Then access the frontend from any device using the ngrok URL.

