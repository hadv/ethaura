# EthAura Docker Quick Start Guide

Get EthAura running in production with Docker in under 10 minutes!

## Prerequisites

- Linux server (Ubuntu 22.04 recommended)
- 8 GB RAM minimum
- 200 GB SSD storage
- Docker and Docker Compose installed

## Quick Installation

### 1. Install Docker (if not already installed)

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### 2. Clone Repository

```bash
git clone https://github.com/hadv/ethaura.git
cd ethaura
```

### 3. Configure Environment

```bash
# Copy environment template
cp .env.production.example .env.production

# Edit configuration (use your favorite editor)
nano .env.production
```

**Minimum required configuration:**

```bash
# Network
NETWORK=mainnet
SERVER_IP=YOUR_SERVER_PUBLIC_IP

# RPC URL (get from https://www.alchemy.com/)
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# Web3Auth (get from https://dashboard.web3auth.io/)
VITE_WEB3AUTH_CLIENT_ID=your_web3auth_client_id

# Helios checkpoint (get latest from https://beaconcha.in)
HELIOS_CHECKPOINT=0x85e6151a246e8fdba36db27a0c7678a575346272fe978c9281e13a8b26cdfa68

# Monitoring
GRAFANA_PASSWORD=your_secure_password
```

### 4. Deploy

```bash
# Option 1: Automated deployment (recommended)
make docker-deploy

# Option 2: Manual deployment
make docker-build
make docker-start
```

### 5. Verify

```bash
# Check service status
make docker-health

# View logs
make docker-logs
```

## Access Your Application

- **Frontend**: http://your-server-ip
- **Grafana**: http://your-server-ip:3001
- **Prometheus**: http://your-server-ip:9090

## What's Running?

The Docker setup includes:

1. **Nimbus** - Ethereum consensus node (syncing takes 4-8 hours)
2. **Helios** - Light client providing trustless RPC
3. **Frontend** - React application served via Nginx
4. **Prometheus** - Metrics collection
5. **Grafana** - Monitoring dashboards

## Common Commands

```bash
# Start services
make docker-start

# Stop services
make docker-stop

# Restart services
make docker-restart

# View logs
make docker-logs

# Check health
make docker-health

# Backup data
make docker-backup

# Clean everything
make docker-clean
```

## Monitoring Sync Progress

Nimbus will take 4-8 hours to sync. Monitor progress:

```bash
# Watch Nimbus logs
docker compose logs -f nimbus

# Check sync status
docker compose exec nimbus wget -qO- http://localhost:5052/eth/v1/node/syncing
```

## Production Checklist

- [ ] Configure `.env.production` with real values
- [ ] Set strong `GRAFANA_PASSWORD`
- [ ] Configure firewall (allow ports 80, 443, 9000)
- [ ] Set up SSL/TLS certificates (see DOCKER_SETUP.md)
- [ ] Configure backups (cron job for `make docker-backup`)
- [ ] Monitor Nimbus sync progress
- [ ] Test frontend access
- [ ] Set up monitoring alerts

## SSL/TLS Setup (Optional but Recommended)

```bash
# Install certbot
sudo apt-get install certbot

# Get certificate
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/nginx/ssl/

# Update nginx.conf (uncomment HTTPS section)
nano docker/nginx/nginx.conf

# Restart frontend
docker compose restart frontend
```

## Firewall Configuration

```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow Nimbus P2P
sudo ufw allow 9000/tcp
sudo ufw allow 9000/udp

# Enable firewall
sudo ufw enable
```

## Backup Setup

Set up automatic daily backups:

```bash
# Create cron job
crontab -e

# Add this line (backup daily at 2 AM)
0 2 * * * cd /path/to/ethaura && make docker-backup
```

## Troubleshooting

### Nimbus not syncing

```bash
# Check logs
docker compose logs nimbus

# Check peers
docker compose exec nimbus wget -qO- http://localhost:5052/eth/v1/node/peer_count

# Restart
docker compose restart nimbus
```

### Helios not connecting

```bash
# Check if Nimbus is ready
docker compose exec nimbus wget -qO- http://localhost:5052/eth/v1/node/health

# Check Helios logs
docker compose logs helios

# Update checkpoint if needed
# Edit .env.production and update HELIOS_CHECKPOINT
docker compose restart helios
```

### Frontend not loading

```bash
# Check logs
docker compose logs frontend

# Rebuild
docker compose build frontend
docker compose up -d frontend
```

### Out of disk space

```bash
# Check disk usage
df -h
docker system df

# Clean up
docker system prune -a
```

## Development Mode

For local development with Sepolia testnet:

```bash
# Copy dev environment
cp .env.example .env

# Configure for Sepolia
nano .env

# Start dev environment
make docker-dev

# Access frontend
open http://localhost:3000
```

## Resource Usage

Expected resource consumption:

- **CPU**: 2-4 cores (during sync: 4-8 cores)
- **RAM**: 6-8 GB
- **Disk**: 100-150 GB (Nimbus) + 10 GB (other services)
- **Network**: 25+ Mbps

## Cost Estimate

- **VPS**: $22-48/month (Hetzner, DigitalOcean, etc.)
- **Alchemy RPC**: $0-50/month
- **Total**: $22-98/month

## Next Steps

1. ✅ Wait for Nimbus to sync (4-8 hours)
2. ✅ Configure SSL/TLS for production
3. ✅ Set up automated backups
4. ✅ Configure monitoring alerts in Grafana
5. ✅ Test the application
6. ✅ Deploy smart contracts (if needed)

## Support

- **Documentation**: See [DOCKER_SETUP.md](DOCKER_SETUP.md) for detailed guide
- **Issues**: https://github.com/hadv/ethaura/issues
- **Logs**: `make docker-logs`

## Security Notes

- Never commit `.env.production` to version control
- Use strong passwords for all services
- Enable HTTPS in production
- Keep Docker and images updated
- Monitor logs for suspicious activity
- Set up firewall rules

---

**Ready to deploy? Run `make docker-deploy` and you're good to go! 🚀**

