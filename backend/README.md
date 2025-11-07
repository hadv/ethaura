# EthAura Backend Server

Backend server for persistent storage of passkey credentials. This solves the issue of passkey credentials being lost when stored in browser localStorage.

## Features

- **Persistent Storage**: SQLite database for reliable credential storage
- **Production-Ready SQLite**: WAL mode, busy timeout, optimized PRAGMAs
- **Automatic Backups**: Scheduled backups every 24 hours (configurable)
- **Signature-Based Authentication**: Users must sign requests with their wallet to prove ownership
- **Rate Limiting**: Protection against abuse
- **CORS Support**: Configured for frontend integration
- **Security Headers**: Helmet.js for security best practices
- **Performance Monitoring**: Query metrics and database statistics
- **Graceful Shutdown**: Proper cleanup on SIGINT/SIGTERM

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=3001
NODE_ENV=development
DATABASE_PATH=./data/passkeys.db
FRONTEND_URL=http://localhost:5173
JWT_SECRET=your_secure_random_string_here
```

### 3. Start Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## API Endpoints

### Health Check

```
GET /health
```

Returns server status.

### Store Passkey Credential

```
POST /api/passkeys
Content-Type: application/json

{
  "userId": "0x1234...",
  "signature": "0xabcd...",
  "message": "EthAura Passkey Storage\nTimestamp: 1234567890\nUser: 0x1234...",
  "timestamp": 1234567890,
  "credential": {
    "id": "credential_id",
    "rawId": "base64_encoded_raw_id",
    "publicKey": {
      "x": "0x...",
      "y": "0x..."
    },
    "response": {
      "attestationObject": "base64_encoded",
      "clientDataJSON": "base64_encoded"
    }
  }
}
```

### Retrieve Passkey Credential

```
GET /api/passkeys/:userId?signature=0x...&message=...&timestamp=...
```

Query parameters:
- `signature`: Wallet signature
- `message`: Signed message (format: "EthAura Passkey Retrieval\nTimestamp: {timestamp}\nUser: {userId}")
- `timestamp`: Unix timestamp in milliseconds

### Delete Passkey Credential

```
DELETE /api/passkeys
Content-Type: application/json

{
  "userId": "0x1234...",
  "signature": "0xabcd...",
  "message": "EthAura Passkey Storage\nTimestamp: 1234567890\nUser: 0x1234...",
  "timestamp": 1234567890
}
```

## Authentication

All API requests require signature-based authentication:

1. **Create Message**: Format a message with timestamp and user ID
2. **Sign Message**: Sign with user's wallet (Web3Auth provider)
3. **Include in Request**: Send signature, message, and timestamp
4. **Server Verifies**: Server recovers address from signature and validates

Example message format:
```
EthAura Passkey Storage
Timestamp: 1699123456789
User: 0x1234567890abcdef1234567890abcdef12345678
```

## Database Schema

```sql
CREATE TABLE passkey_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  credential_id TEXT NOT NULL,
  raw_id TEXT NOT NULL,
  public_key_x TEXT NOT NULL,
  public_key_y TEXT NOT NULL,
  attestation_object TEXT,
  client_data_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

## Security Considerations

1. **Signature Verification**: All requests must be signed by the user's wallet
2. **Timestamp Validation**: Signatures expire after 5 minutes
3. **Rate Limiting**: 100 requests per 15 minutes per IP
4. **CORS**: Only configured frontend URL can access the API
5. **Input Validation**: All inputs are validated before processing

## Production Deployment

**See [PRODUCTION.md](./PRODUCTION.md) for complete production deployment guide.**

Quick checklist:
1. Set `NODE_ENV=production` in `.env`
2. Use a strong `JWT_SECRET` (generate with: `openssl rand -base64 32`)
3. Configure proper `FRONTEND_URL`
4. Configure `BACKUP_DIR` and `BACKUP_INTERVAL_HOURS`
5. Use HTTPS (reverse proxy with nginx/caddy)
6. Automatic backups are enabled by default
7. Monitor logs and database stats
8. Consider PostgreSQL for >1000 concurrent users

### SQLite Production Optimizations

This backend is production-ready with SQLite:
- ✅ WAL mode enabled (concurrent reads during writes)
- ✅ 5-second busy timeout (prevents "database locked" errors)
- ✅ 64MB cache for better performance
- ✅ Automatic backups every 24 hours
- ✅ Graceful shutdown handling
- ✅ Performance monitoring

### New API Endpoints

**Get Database Statistics**
```
GET /api/admin/stats
```

Returns query count, error count, total credentials, and last backup time.

**Create Manual Backup** (development only)
```
POST /api/admin/backup
```

Creates an immediate backup of the database.

## Troubleshooting

### Database locked error
- SQLite uses WAL mode for better concurrency
- If issues persist, consider PostgreSQL

### CORS errors
- Verify `FRONTEND_URL` matches your frontend origin
- Check browser console for specific CORS errors

### Signature verification fails
- Ensure message format is exact
- Check timestamp is recent (< 5 minutes)
- Verify userId matches the signing address

## Development

### Database Location

Development: `./data/passkeys.db`

To reset database:
```bash
rm -rf data/
```

### Logs

All requests are logged with timestamp and method.

### Admin Endpoint (Development Only)

```
GET /api/admin/credentials
```

Returns all stored credentials (disabled in production).

