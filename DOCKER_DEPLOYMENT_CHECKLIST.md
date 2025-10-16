# EthAura Docker Production Deployment Checklist

Use this checklist to ensure a complete and secure production deployment.

## Pre-Deployment

### Server Setup
- [ ] Linux server provisioned (Ubuntu 22.04 LTS recommended)
- [ ] Minimum 8 GB RAM, 16 GB recommended
- [ ] Minimum 200 GB SSD storage
- [ ] Stable network connection (25+ Mbps)
- [ ] SSH access configured
- [ ] Non-root user with sudo privileges created

### Software Installation
- [ ] Docker installed (version 20.10+)
- [ ] Docker Compose installed (version 2.0+)
- [ ] Git installed
- [ ] Verify installations:
  ```bash
  docker --version
  docker compose version
  git --version
  ```

### Repository Setup
- [ ] Repository cloned: `git clone https://github.com/hadv/ethaura.git`
- [ ] Changed to project directory: `cd ethaura`
- [ ] Latest code pulled: `git pull origin main`

## Configuration

### Environment Variables
- [ ] Copied `.env.production.example` to `.env.production`
- [ ] Set `NETWORK=mainnet` (or `sepolia` for testing)
- [ ] Set `SERVER_IP` to your server's public IP
- [ ] Configured `MAINNET_RPC_URL` with Alchemy/Infura API key
- [ ] Set `VITE_WEB3AUTH_CLIENT_ID` from Web3Auth dashboard
- [ ] Updated `HELIOS_CHECKPOINT` with recent checkpoint from beaconcha.in
- [ ] Set strong `GRAFANA_PASSWORD`
- [ ] Configured contract addresses (if already deployed)
- [ ] Verified all required variables are set

### Directory Structure
- [ ] Created logs directories: `mkdir -p logs/{nimbus,helios,nginx}`
- [ ] Created SSL directory: `mkdir -p docker/nginx/ssl`
- [ ] Created Grafana directories: `mkdir -p docker/grafana/{provisioning,dashboards}`
- [ ] Created backups directory: `mkdir -p backups`

### Security Configuration
- [ ] Reviewed `.env.production` - no default/example values remain
- [ ] Ensured `.env.production` is in `.gitignore`
- [ ] Set file permissions: `chmod 600 .env.production`
- [ ] Generated strong passwords for all services

## Firewall Setup

### UFW Configuration
- [ ] UFW installed: `sudo apt-get install ufw`
- [ ] Allow SSH: `sudo ufw allow 22/tcp`
- [ ] Allow HTTP: `sudo ufw allow 80/tcp`
- [ ] Allow HTTPS: `sudo ufw allow 443/tcp`
- [ ] Allow Nimbus P2P TCP: `sudo ufw allow 9000/tcp`
- [ ] Allow Nimbus P2P UDP: `sudo ufw allow 9000/udp`
- [ ] Enable firewall: `sudo ufw enable`
- [ ] Verify rules: `sudo ufw status`

### Port Security
- [ ] Monitoring ports (9090, 3001) NOT exposed to public
- [ ] Plan to use SSH tunneling for monitoring access
- [ ] Documented SSH tunnel commands for team

## SSL/TLS Setup (Production Only)

### Domain Configuration
- [ ] Domain name registered and configured
- [ ] DNS A record points to server IP
- [ ] DNS propagation verified: `dig your-domain.com`

### Certificate Installation
- [ ] Certbot installed: `sudo apt-get install certbot`
- [ ] Certificate obtained: `sudo certbot certonly --standalone -d your-domain.com`
- [ ] Certificates copied to `docker/nginx/ssl/`
- [ ] Certificate permissions set: `chmod 644 docker/nginx/ssl/*.pem`
- [ ] Nginx config updated with domain name
- [ ] HTTPS server block uncommented in `nginx.conf`
- [ ] HTTP to HTTPS redirect enabled

### Certificate Renewal
- [ ] Auto-renewal tested: `sudo certbot renew --dry-run`
- [ ] Renewal cron job verified: `sudo systemctl status certbot.timer`

## Deployment

### Build and Start
- [ ] Made scripts executable: `chmod +x scripts/docker-*.sh`
- [ ] Ran deployment script: `make docker-deploy`
  - OR manually:
    - [ ] Built images: `make docker-build`
    - [ ] Started services: `make docker-start`
- [ ] All services started successfully
- [ ] No errors in deployment output

### Service Verification
- [ ] Checked service status: `docker compose ps`
- [ ] All services show "running" status
- [ ] Health checks passing (may take a few minutes)
- [ ] Ran health check: `make docker-health`

### Nimbus Sync
- [ ] Nimbus started and syncing
- [ ] Monitoring sync progress: `docker compose logs -f nimbus`
- [ ] Peer count > 50: `docker compose exec nimbus wget -qO- http://localhost:5052/eth/v1/node/peer_count`
- [ ] Estimated sync time noted (4-8 hours)
- [ ] Sync completion verified

### Helios Verification
- [ ] Helios connected to Nimbus
- [ ] RPC responding: `curl -X POST http://localhost:8545 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'`
- [ ] Block number returned successfully
- [ ] No errors in Helios logs

### Frontend Verification
- [ ] Frontend accessible: `curl http://localhost`
- [ ] Health endpoint responding: `curl http://localhost/health`
- [ ] Web interface loads in browser
- [ ] No console errors in browser
- [ ] Web3Auth login works
- [ ] Contract interactions functional

## Monitoring Setup

### Prometheus
- [ ] Prometheus accessible: `curl http://localhost:9090/-/healthy`
- [ ] Nimbus metrics being collected
- [ ] Targets showing as "UP" in Prometheus UI
- [ ] Metrics visible in Prometheus

### Grafana
- [ ] Grafana accessible via SSH tunnel: `ssh -L 3001:localhost:3001 user@server`
- [ ] Login successful with configured password
- [ ] Prometheus datasource configured
- [ ] Dashboards loading
- [ ] Metrics displaying correctly

### Alerts (Optional)
- [ ] Alert rules configured
- [ ] Alertmanager set up (if using)
- [ ] Test alerts sent and received
- [ ] Alert notification channels configured

## Backup Configuration

### Backup Setup
- [ ] Backup script tested: `make docker-backup`
- [ ] Backup directory has sufficient space
- [ ] Backup retention policy configured
- [ ] Cron job created for automated backups:
  ```bash
  0 2 * * * cd /path/to/ethaura && make docker-backup
  ```
- [ ] Backup notifications configured (optional)

### Backup Verification
- [ ] Test backup created successfully
- [ ] Backup files exist in `backups/` directory
- [ ] Backup file sizes reasonable
- [ ] Test restore performed on test system
- [ ] Restore procedure documented

### Off-site Backup (Recommended)
- [ ] Off-site backup location configured
- [ ] Automated sync to off-site storage
- [ ] Encryption for off-site backups
- [ ] Off-site backup tested

## Security Hardening

### System Security
- [ ] System packages updated: `sudo apt-get update && sudo apt-get upgrade`
- [ ] Automatic security updates enabled
- [ ] SSH key-based authentication configured
- [ ] SSH password authentication disabled
- [ ] Fail2ban installed and configured
- [ ] Root login disabled

### Docker Security
- [ ] Docker daemon secured
- [ ] Docker socket not exposed
- [ ] Container resource limits set
- [ ] Non-root users in containers where possible
- [ ] Security scanning performed: `docker scan`

### Application Security
- [ ] All default passwords changed
- [ ] Strong passwords used (16+ characters)
- [ ] Secrets not in version control
- [ ] HTTPS enforced (if SSL configured)
- [ ] Security headers configured in Nginx
- [ ] CORS properly configured

## Documentation

### Internal Documentation
- [ ] Deployment date and version documented
- [ ] Server details documented (IP, provider, specs)
- [ ] Access credentials stored securely (password manager)
- [ ] Team members granted appropriate access
- [ ] Runbook created for common operations
- [ ] Incident response plan documented

### Monitoring Documentation
- [ ] Monitoring access documented
- [ ] Alert thresholds documented
- [ ] Escalation procedures defined
- [ ] On-call rotation established (if applicable)

## Testing

### Functional Testing
- [ ] Frontend loads correctly
- [ ] User can create passkey
- [ ] User can deploy account
- [ ] User can send transaction
- [ ] All features working as expected

### Performance Testing
- [ ] Page load times acceptable
- [ ] RPC response times < 1 second
- [ ] No memory leaks observed
- [ ] CPU usage within limits
- [ ] Disk I/O acceptable

### Disaster Recovery Testing
- [ ] Backup restore tested
- [ ] Service restart tested
- [ ] Failover procedures tested (if applicable)
- [ ] Recovery time objectives met

## Post-Deployment

### Monitoring
- [ ] Services monitored for 24 hours
- [ ] No critical errors in logs
- [ ] Resource usage stable
- [ ] Sync completed successfully
- [ ] All health checks passing

### Optimization
- [ ] Resource usage reviewed
- [ ] Unnecessary services disabled
- [ ] Logs rotation configured
- [ ] Performance tuning applied if needed

### Maintenance Schedule
- [ ] Daily monitoring tasks scheduled
- [ ] Weekly maintenance tasks scheduled
- [ ] Monthly update schedule created
- [ ] Checkpoint update reminders set (every 1-2 weeks)

## Final Verification

### Checklist Review
- [ ] All items in this checklist completed
- [ ] No outstanding issues or warnings
- [ ] Team briefed on deployment
- [ ] Documentation updated
- [ ] Deployment marked as successful

### Sign-off
- [ ] Deployment reviewed by: ________________
- [ ] Date: ________________
- [ ] Production ready: YES / NO
- [ ] Notes: ________________________________

## Emergency Contacts

Document emergency contacts and procedures:

- **Server Provider Support**: ________________
- **Team Lead**: ________________
- **On-call Engineer**: ________________
- **Escalation Path**: ________________

## Rollback Plan

In case of issues:

1. Stop services: `make docker-stop`
2. Restore from backup: `[document restore procedure]`
3. Investigate issues: `make docker-logs`
4. Contact team: `[contact information]`

---

**Deployment Status**: ⬜ Not Started | ⬜ In Progress | ⬜ Complete

**Deployment Date**: ________________

**Deployed By**: ________________

**Notes**: 
```
[Add any deployment-specific notes here]
```

