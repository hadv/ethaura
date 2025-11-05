# Backend Quick Start Guide

## Prerequisites

- Node.js 18+ installed
- npm or yarn

## Quick Setup (Development)

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Create Environment File

```bash
cp .env.example .env
```

The default `.env` file is already configured for local development:
```env
PORT=3001
NODE_ENV=development
DATABASE_PATH=./data/passkeys.db
FRONTEND_URL=http://localhost:5173
JWT_SECRET=your_jwt_secret_here_change_in_production
```

### 3. Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Or production mode
npm start
```

You should see:
```
🚀 EthAura Backend Server running on port 3001
📊 Environment: development
🌐 CORS enabled for: http://localhost:5173
```

### 4. Test the Server

```bash
# Health check
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": 1699123456789,
  "uptime": 1.234
}
```

## Frontend Configuration

Update your frontend `.env` file:

```bash
cd ../frontend
```

Add to `.env`:
```env
VITE_BACKEND_URL=http://localhost:3001
```

## Running Both Frontend and Backend

### Terminal 1 - Backend
```bash
cd backend
npm run dev
```

### Terminal 2 - Frontend
```bash
cd frontend
npm run dev
```

Now visit http://localhost:5173 and the frontend will automatically use the backend for passkey storage!

## Verify It's Working

1. Login with Web3Auth
2. Create a passkey
3. Check backend terminal - you should see:
   ```
   📝 Storing passkey for user: 0x...
   ```
4. Check frontend console - you should see:
   ```
   ✅ Passkey credential saved to server
   ```
5. Refresh the page
6. Check frontend console - you should see:
   ```
   🔄 Loading passkey credential from server...
   ✅ Loaded passkey credential from server
   ```

## Troubleshooting

### Port Already in Use

If port 3001 is already in use, change it in `.env`:
```env
PORT=3002
```

And update frontend `.env`:
```env
VITE_BACKEND_URL=http://localhost:3002
```

### CORS Errors

Make sure `FRONTEND_URL` in backend `.env` matches your frontend URL exactly:
```env
FRONTEND_URL=http://localhost:5173
```

### Database Issues

If you encounter database issues, delete and recreate:
```bash
rm -rf data/
# Restart the server - it will create a new database
```

## Production Deployment

See [README.md](./README.md) for production deployment instructions.

## API Documentation

See [README.md](./README.md) for complete API documentation.

