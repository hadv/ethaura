# 🐳 EthAura Docker Production Deployment

Complete Docker Compose setup for deploying EthAura in production with full infrastructure.

## 📚 Documentation Index

Choose the guide that fits your needs:

### Quick Start
- **[DOCKER_QUICKSTART.md](DOCKER_QUICKSTART.md)** - Get running in 10 minutes
  - Prerequisites and installation
  - Minimal configuration
  - Quick deployment commands

### Comprehensive Guide
- **[DOCKER_SETUP.md](DOCKER_SETUP.md)** - Complete deployment guide
  - Detailed architecture
  - Step-by-step instructions
  - Troubleshooting
  - Maintenance procedures

### Reference
- **[DOCKER_DEPLOYMENT_SUMMARY.md](DOCKER_DEPLOYMENT_SUMMARY.md)** - Complete overview
  - All files created
  - Architecture diagram
  - Quick reference

### Checklist
- **[DOCKER_DEPLOYMENT_CHECKLIST.md](DOCKER_DEPLOYMENT_CHECKLIST.md)** - Production checklist
  - Pre-deployment tasks
  - Security hardening
  - Post-deployment verification

### Configuration
- **[docker/README.md](docker/README.md)** - Docker configuration reference
  - Directory structure
  - Customization guide
  - Security best practices

## 🚀 Quick Start

### 1. Install Docker

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo apt-get install docker-compose-plugin
```

### 2. Configure

```bash
cp .env.production.example .env.production
nano .env.production  # Edit with your values
```

### 3. Deploy

```bash
make docker-deploy
```

### 4. Access

- Frontend: http://your-server
- Grafana: http://your-server:3001
- Prometheus: http://your-server:9090

## 🏗️ What's Included

### Services

1. **Nimbus Consensus Node**
   - Ethereum beacon chain node
   - Provides trustless consensus data
   - Syncs in 4-8 hours

2. **Helios Light Client**
   - Trustless RPC endpoint
   - Cryptographically verifies all data
   - Connects to Nimbus + Alchemy

3. **Frontend (React + Nginx)**
   - Production-optimized build
   - SSL/TLS support
   - Security headers

4. **Prometheus**
   - Metrics collection
   - Monitors all services
   - 30-day retention

5. **Grafana**
   - Monitoring dashboards
   - Pre-configured datasources
   - Custom dashboards

### Features

✅ **Production-Ready**
- Multi-stage Docker builds
- Health checks for all services
- Resource limits configured
- Automatic restarts

✅ **Secure**
- SSL/TLS support
- Security headers
- Firewall configuration
- Secrets management

✅ **Monitored**
- Prometheus metrics
- Grafana dashboards
- Health check scripts
- Log aggregation

✅ **Maintainable**
- Automated backups
- Easy updates
- Comprehensive documentation
- Helper scripts

## 📋 Essential Commands

```bash
# Deployment
make docker-deploy          # Full automated deployment
make docker-start           # Start all services
make docker-stop            # Stop all services
make docker-restart         # Restart all services

# Monitoring
make docker-logs            # View logs (all services)
make docker-health          # Check service health

# Maintenance
make docker-backup          # Backup all volumes
make docker-clean           # Clean Docker resources
make docker-build           # Rebuild images

# Development
make docker-dev             # Start dev environment
```

## 🔧 Configuration Files

### Core Files

```
.
├── docker-compose.yml              # Production configuration
├── docker-compose.dev.yml          # Development configuration
├── .env.production.example         # Environment template
└── .dockerignore                   # Build optimization
```

### Docker Services

```
docker/
├── frontend/
│   └── Dockerfile                  # Frontend production build
├── helios/
│   ├── Dockerfile                  # Helios light client
│   └── entrypoint.sh              # Startup script
├── nginx/
│   └── nginx.conf                 # Web server config
├── prometheus/
│   └── prometheus.yml             # Metrics config
└── grafana/
    └── provisioning/              # Auto-configuration
```

### Helper Scripts

```
scripts/
├── docker-deploy.sh               # Automated deployment
├── docker-backup.sh               # Backup automation
└── docker-health-check.sh         # Health monitoring
```

## 🎯 Deployment Modes

### Production (Mainnet)

```bash
# Configure for mainnet
NETWORK=mainnet

# Deploy
make docker-deploy
```

**Requirements:**
- 8+ GB RAM
- 200+ GB SSD
- Stable network
- 4-8 hours for sync

### Development (Sepolia)

```bash
# Configure for Sepolia
NETWORK=sepolia

# Deploy dev environment
make docker-dev
```

**Requirements:**
- 4+ GB RAM
- 50+ GB SSD
- Faster sync (~1 hour)

## 🔒 Security

### Firewall Setup

```bash
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw allow 9000/tcp    # Nimbus P2P
sudo ufw allow 9000/udp    # Nimbus P2P
sudo ufw enable
```

### SSL/TLS Setup

```bash
# Get certificate
sudo certbot certonly --standalone -d your-domain.com

# Copy to Docker
sudo cp /etc/letsencrypt/live/your-domain.com/*.pem docker/nginx/ssl/

# Enable HTTPS in nginx.conf
# Restart
docker compose restart frontend
```

### Security Checklist

- [ ] Strong passwords set
- [ ] `.env.production` not in git
- [ ] Firewall configured
- [ ] SSL/TLS enabled
- [ ] Monitoring ports secured
- [ ] Regular updates scheduled

## 💾 Backup & Restore

### Automated Backup

```bash
# Manual backup
make docker-backup

# Scheduled backup (cron)
0 2 * * * cd /path/to/ethaura && make docker-backup
```

### Restore

```bash
# Restore specific volume
docker run --rm \
  -v ethaura_nimbus-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/nimbus-data-YYYYMMDD.tar.gz -C /data
```

## 📊 Monitoring

### Access Monitoring

```bash
# SSH tunnel for Grafana
ssh -L 3001:localhost:3001 user@your-server

# Open in browser
open http://localhost:3001
```

### Key Metrics

- Nimbus sync status
- Peer count (should be > 50)
- Memory usage
- Disk usage
- RPC response time

## 🐛 Troubleshooting

### Check Status

```bash
make docker-health
docker compose ps
```

### View Logs

```bash
make docker-logs
docker compose logs -f [service-name]
```

### Common Issues

**Nimbus not syncing:**
```bash
docker compose logs nimbus
docker compose restart nimbus
```

**Helios not connecting:**
```bash
# Check if Nimbus is ready
docker compose exec nimbus wget -qO- http://localhost:5052/eth/v1/node/health

# Update checkpoint if needed
nano .env.production  # Update HELIOS_CHECKPOINT
docker compose restart helios
```

**Frontend not loading:**
```bash
docker compose logs frontend
docker compose build frontend
docker compose up -d frontend
```

## 💰 Cost Estimate

| Component | Cost |
|-----------|------|
| VPS (8GB RAM, 200GB SSD) | $22-48/month |
| Alchemy RPC | $0-50/month |
| **Total** | **$22-98/month** |

### Recommended Providers

- **Hetzner**: €22/month (best value)
- **DigitalOcean**: $48/month
- **Linode**: $48/month
- **AWS/GCP**: $100+/month

## 📈 Resource Usage

### Expected Usage

- **CPU**: 2-4 cores (4-8 during sync)
- **RAM**: 6-8 GB
- **Disk**: 100-150 GB (Nimbus) + 10-20 GB (other)
- **Network**: 25+ Mbps

### Monitoring Usage

```bash
# Real-time stats
docker stats

# Disk usage
docker system df
df -h
```

## 🔄 Updates

### Update Services

```bash
# Pull latest images
docker compose pull

# Restart with new images
docker compose up -d

# Clean old images
docker image prune -a
```

### Update Checkpoint

```bash
# Get latest from https://beaconcha.in
# Update in .env.production
nano .env.production

# Restart Helios
docker compose restart helios
```

## 📞 Support

### Documentation
- [DOCKER_QUICKSTART.md](DOCKER_QUICKSTART.md) - Quick start
- [DOCKER_SETUP.md](DOCKER_SETUP.md) - Comprehensive guide
- [DOCKER_DEPLOYMENT_CHECKLIST.md](DOCKER_DEPLOYMENT_CHECKLIST.md) - Checklist

### Help
- **Logs**: `make docker-logs`
- **Health**: `make docker-health`
- **Issues**: https://github.com/hadv/ethaura/issues

## ✅ Next Steps

1. Read [DOCKER_QUICKSTART.md](DOCKER_QUICKSTART.md)
2. Configure `.env.production`
3. Run `make docker-deploy`
4. Wait for Nimbus sync (4-8 hours)
5. Configure SSL/TLS
6. Set up backups
7. Test application

---

**Ready to deploy? Start with [DOCKER_QUICKSTART.md](DOCKER_QUICKSTART.md)! 🚀**

