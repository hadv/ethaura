#!/bin/bash
# Backup verification script for EthAura backend
# Checks if the latest backup is fresh and valid

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./data/backups}"
MAX_AGE_HOURS=25
ALERT_EMAIL="${ALERT_EMAIL:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Find latest backup
LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/*.db 2>/dev/null | head -1)

if [ -z "$LATEST_BACKUP" ]; then
    echo -e "${RED}ERROR: No backups found in $BACKUP_DIR${NC}"
    exit 1
fi

# Check backup age
BACKUP_AGE_SECONDS=$(( $(date +%s) - $(stat -f %m "$LATEST_BACKUP" 2>/dev/null || stat -c %Y "$LATEST_BACKUP") ))
BACKUP_AGE_HOURS=$(( BACKUP_AGE_SECONDS / 3600 ))
MAX_AGE_SECONDS=$(( MAX_AGE_HOURS * 3600 ))

echo "Latest backup: $LATEST_BACKUP"
echo "Backup age: ${BACKUP_AGE_HOURS} hours"

if [ $BACKUP_AGE_SECONDS -gt $MAX_AGE_SECONDS ]; then
    echo -e "${RED}ERROR: Latest backup is too old (${BACKUP_AGE_HOURS} hours)${NC}"
    
    # Send alert email if configured
    if [ -n "$ALERT_EMAIL" ]; then
        echo "Backup too old: $LATEST_BACKUP (${BACKUP_AGE_HOURS} hours)" | \
            mail -s "EthAura Backup Alert" "$ALERT_EMAIL"
    fi
    
    exit 1
fi

# Verify backup integrity
echo "Verifying backup integrity..."
if sqlite3 "$LATEST_BACKUP" "PRAGMA integrity_check;" | grep -q "ok"; then
    echo -e "${GREEN}✅ Backup is valid and fresh${NC}"
    echo "Backup file: $LATEST_BACKUP"
    echo "Backup size: $(du -h "$LATEST_BACKUP" | cut -f1)"
    exit 0
else
    echo -e "${RED}ERROR: Backup integrity check failed${NC}"
    exit 1
fi

