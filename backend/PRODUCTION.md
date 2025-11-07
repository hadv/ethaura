# Production Deployment Guide

## SQLite Production Optimizations

This backend has been optimized for production use with SQLite. Here's what's been implemented:

### ✅ Implemented Optimizations

1. **WAL Mode (Write-Ahead Logging)**
   - Enables concurrent reads during writes
   - Better performance and concurrency
   - Automatically enabled on startup

2. **Busy Timeout**
   - 5-second timeout instead of immediate failure
   - Prevents "database locked" errors under load
   - Configurable via `BUSY_TIMEOUT_MS`

3. **Performance PRAGMAs**
   - `synchronous = NORMAL` (safe with WAL mode)
   - `cache_size = -64000` (64MB cache)
   - `temp_store = MEMORY` (faster temp operations)

4. **Automatic Backups**
   - Scheduled backups every 24 hours (configurable)
   - Uses `VACUUM INTO` for atomic backups
   - Fallback to file copy if needed
   - Backups stored in `./data/backups/`

5. **Graceful Shutdown**
   - Handles SIGINT and SIGTERM
   - Closes database connections properly
   - Stops backup scheduler

6. **Performance Monitoring**
   - Tracks query count and error count
   - Database statistics endpoint
   - Last backup timestamp

## Environment Variables

```env
# Server
PORT=3001
NODE_ENV=production

# Database
DATABASE_PATH=/var/lib/ethaura/passkeys.db

# Backups
BACKUP_DIR=/var/lib/ethaura/backups
BACKUP_INTERVAL_HOURS=24

# Security
FRONTEND_URL=https://yourdomain.com
JWT_SECRET=your_very_secure_random_string_here
```

## Deployment Checklist

### 1. Server Setup

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Create application directory
sudo mkdir -p /var/lib/ethaura
sudo chown $USER:$USER /var/lib/ethaura

# Clone and setup
cd /var/lib/ethaura
git clone <your-repo> backend
cd backend
npm install --production
```

### 2. Configure Environment

```bash
# Copy and edit .env
cp .env.example .env
nano .env

# Set production values:
# - NODE_ENV=production
# - Strong JWT_SECRET (use: openssl rand -base64 32)
# - Correct FRONTEND_URL
# - Absolute paths for DATABASE_PATH and BACKUP_DIR
```

### 3. Setup Systemd Service

Create `/etc/systemd/system/ethaura-backend.service`:

```ini
[Unit]
Description=EthAura Backend Server
After=network.target

[Service]
Type=simple
User=ethaura
WorkingDirectory=/var/lib/ethaura/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/ethaura

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ethaura-backend
sudo systemctl start ethaura-backend
sudo systemctl status ethaura-backend
```

### 4. Setup Nginx Reverse Proxy

Create `/etc/nginx/sites-available/ethaura-backend`:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL certificates (use certbot)
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and restart:

```bash
sudo ln -s /etc/nginx/sites-available/ethaura-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 5. Setup SSL with Let's Encrypt

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

### 6. Setup Backup Monitoring

Create a cron job to verify backups:

```bash
# Edit crontab
crontab -e

# Add daily backup verification (9 AM)
0 9 * * * /var/lib/ethaura/backend/scripts/verify-backup.sh
```

Create `/var/lib/ethaura/backend/scripts/verify-backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/var/lib/ethaura/backups"
LATEST_BACKUP=$(ls -t $BACKUP_DIR/*.db 2>/dev/null | head -1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "ERROR: No backups found!"
    exit 1
fi

# Check if backup is less than 25 hours old
BACKUP_AGE=$(( $(date +%s) - $(stat -c %Y "$LATEST_BACKUP") ))
MAX_AGE=$((25 * 3600))

if [ $BACKUP_AGE -gt $MAX_AGE ]; then
    echo "ERROR: Latest backup is too old: $LATEST_BACKUP"
    exit 1
fi

echo "OK: Latest backup is fresh: $LATEST_BACKUP"
```

Make it executable:

```bash
chmod +x /var/lib/ethaura/backend/scripts/verify-backup.sh
```

## Monitoring

### Database Statistics

```bash
# Get database stats
curl https://api.yourdomain.com/api/admin/stats
```

Response:
```json
{
  "success": true,
  "stats": {
    "total_credentials": 150,
    "oldest_credential": 1699123456789,
    "newest_credential": 1699999999999,
    "queryCount": 1523,
    "errorCount": 2,
    "lastBackupTime": 1699888888888,
    "dbPath": "/var/lib/ethaura/passkeys.db"
  }
}
```

### Logs

```bash
# View logs
sudo journalctl -u ethaura-backend -f

# View last 100 lines
sudo journalctl -u ethaura-backend -n 100
```

## Backup and Restore

### Manual Backup

```bash
# Create manual backup
curl -X POST https://api.yourdomain.com/api/admin/backup
```

### Restore from Backup

```bash
# Stop service
sudo systemctl stop ethaura-backend

# Restore backup
cp /var/lib/ethaura/backups/passkeys-2024-01-15T10-00-00-000Z.db \
   /var/lib/ethaura/passkeys.db

# Start service
sudo systemctl start ethaura-backend
```

### Offsite Backup

Setup daily offsite backup to S3/Backblaze:

```bash
# Install rclone
curl https://rclone.org/install.sh | sudo bash

# Configure rclone (follow prompts)
rclone config

# Add to crontab (daily at 2 AM)
0 2 * * * rclone sync /var/lib/ethaura/backups remote:ethaura-backups
```

## Performance Tuning

### For Higher Load

If you experience high load (>100 concurrent users):

1. **Increase cache size**:
   ```sql
   PRAGMA cache_size = -128000; -- 128MB
   ```

2. **Monitor write contention**:
   ```bash
   # Check for "database locked" errors in logs
   sudo journalctl -u ethaura-backend | grep "locked"
   ```

3. **Consider PostgreSQL migration** if:
   - Consistent write contention
   - Need horizontal scaling
   - >1000 concurrent users

## Security Hardening

1. **Firewall**: Only allow port 443
   ```bash
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

2. **Fail2ban**: Protect against brute force
   ```bash
   sudo apt-get install fail2ban
   ```

3. **Regular updates**:
   ```bash
   sudo apt-get update && sudo apt-get upgrade
   npm audit fix
   ```

4. **File permissions**:
   ```bash
   chmod 600 /var/lib/ethaura/passkeys.db
   chmod 700 /var/lib/ethaura/backups
   ```

## Troubleshooting

### Database Locked Errors

If you see "database locked" errors:

1. Check WAL mode is enabled:
   ```bash
   sqlite3 /var/lib/ethaura/passkeys.db "PRAGMA journal_mode;"
   # Should return: wal
   ```

2. Increase busy timeout in `database.js`

3. Check for long-running queries

### High Memory Usage

SQLite cache uses memory. Adjust if needed:

```javascript
// In database.js, reduce cache size
PRAGMA cache_size = -32000; // 32MB instead of 64MB
```

### Backup Failures

Check disk space:
```bash
df -h /var/lib/ethaura
```

Check permissions:
```bash
ls -la /var/lib/ethaura/backups
```

## Migration to PostgreSQL

If you outgrow SQLite, migration script:

```bash
# Export data
sqlite3 /var/lib/ethaura/passkeys.db .dump > dump.sql

# Import to PostgreSQL
psql -U postgres -d ethaura < dump.sql
```

Then update `database.js` to use `pg` instead of `sqlite3`.

