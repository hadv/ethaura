# EthAura Scripts

Utility scripts for development and testing.

## start-local-network.sh

Automatically starts EthAura backend and frontend services.

### Usage

```bash
./scripts/start-local-network.sh
```

### What it does

1. **Detects your local IP address** (e.g., 192.168.1.4)
   - macOS: Uses `ipconfig getifaddr en0`
   - Linux: Uses `hostname -I`
   - Windows: Prompts for manual entry

2. **Displays access URLs**
   - Desktop: `http://YOUR_IP:5173`
   - Backend: `http://YOUR_IP:3001`
   - Health check: `http://YOUR_IP:3001/health`

3. **Optionally starts services**
   - Backend on port 3001
   - Frontend on port 5173 with `--host` flag

**Note:** VITE_BACKEND_URL is kept empty to use Vite proxy. Mobile testing requires HTTPS (use ngrok instead of local network).

### Example Output

```
🚀 EthAura Local Network Setup
================================

📱 Detected OS: Mac

🔍 Finding local IP address...
✅ Local IP: 192.168.1.4

ℹ️  VITE_BACKEND_URL is kept empty (uses Vite proxy)
   Mobile testing requires HTTPS (use ngrok instead)

🌐 Access URLs:
   Desktop: http://192.168.1.4:5173
   Backend: http://192.168.1.4:3001
   Health:  http://192.168.1.4:3001/health

Start backend and frontend now? (y/n)
```

### When to use

- Starting backend and frontend services quickly
- Desktop development and testing
- For mobile testing, use ngrok for HTTPS support (WebAuthn requires HTTPS)

### Requirements

- macOS, Linux, or Windows (with bash)
- Node.js and npm installed
- Both devices on same WiFi network

### Troubleshooting

**Script can't detect IP:**
- Manually enter your IP when prompted
- Find it using: `ipconfig getifaddr en0` (macOS) or `ipconfig` (Windows)

**Services won't start:**
- Check if ports 3001 and 5173 are available
- Ensure node_modules are installed
- Run `npm install` in backend and frontend directories

**Mobile can't access:**
- Verify both devices on same WiFi network
- Check firewall settings
- Test health endpoint: `http://YOUR_IP:3001/health`

## Future Scripts

Additional scripts that could be added:

- `backup-database.sh` - Backup passkey database
- `reset-dev-env.sh` - Reset development environment
- `deploy-production.sh` - Production deployment
- `run-tests.sh` - Run all tests

## Contributing

When adding new scripts:
1. Make them executable: `chmod +x scripts/your-script.sh`
2. Add documentation to this README
3. Include error handling and user feedback
4. Test on multiple platforms if possible

