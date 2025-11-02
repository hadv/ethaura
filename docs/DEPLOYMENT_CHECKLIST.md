# Deployment Checklist

Use this checklist to ensure a smooth deployment of ΞTHΛURΛ.

## Pre-Deployment

### Environment Setup
- [ ] Foundry installed and updated (`foundryup`)
- [ ] Node.js >= 18 installed
- [ ] Git repository cloned
- [ ] Dependencies installed (`make install`)
- [ ] `.env` file created and configured
- [ ] Sepolia ETH obtained from faucet

### Configuration
- [ ] `SEPOLIA_RPC_URL` set in `.env`
- [ ] `PRIVATE_KEY` set in `.env` (funded with Sepolia ETH)
- [ ] `ETHERSCAN_API_KEY` set in `.env`
- [ ] `ENTRYPOINT_ADDRESS` verified (0x0000000071727De22E5E9d8BAf0edAc6f37da032)

### Testing
- [ ] All contracts compile (`make build`)
- [ ] All tests pass (`make test`)
- [ ] Gas report reviewed (`make test-gas`)
- [ ] Test coverage acceptable (`make coverage`)
- [ ] No compiler warnings

## Deployment to Sepolia

### Pre-Flight Checks
- [ ] Network is Sepolia (chain ID: 11155111)
- [ ] Deployer account has sufficient ETH (>0.01 ETH recommended)
- [ ] P256 precompile available on Sepolia (post-Fusaka)
- [ ] EntryPoint v0.7 deployed at expected address

### Deploy Factory
- [ ] Run deployment script (`make deploy-sepolia`)
- [ ] Transaction confirmed on Etherscan
- [ ] Factory address saved
- [ ] Contract verified on Etherscan
- [ ] Deployment gas cost recorded

### Verify Deployment
- [ ] Factory contract visible on Etherscan
- [ ] Source code verified
- [ ] Constructor arguments correct
- [ ] EntryPoint address matches

## Post-Deployment

### Testing on Testnet
- [ ] Create test account via factory
- [ ] Verify account address is deterministic
- [ ] Fund test account with Sepolia ETH
- [ ] Add deposit to EntryPoint
- [ ] Execute test transaction
- [ ] Verify signature validation works
- [ ] Check gas costs are reasonable

### Frontend Configuration
- [ ] Update frontend `.env` with factory address
- [ ] Update frontend `.env` with RPC URL
- [ ] Build frontend (`cd frontend && npm run build`)
- [ ] Test frontend locally (`npm run dev`)
- [ ] Verify passkey creation works
- [ ] Verify account deployment works
- [ ] Verify transaction signing works

### Documentation
- [ ] Update README with deployed addresses
- [ ] Document any deployment issues
- [ ] Update CHANGELOG with deployment info
- [ ] Create deployment announcement

## Production Readiness (Mainnet)

### Security
- [ ] **Security audit completed** ⚠️ CRITICAL
- [ ] Audit findings addressed
- [ ] Bug bounty program launched
- [ ] Incident response plan documented
- [ ] Emergency pause mechanism tested
- [ ] Multi-sig setup for ownership
- [ ] Insurance coverage evaluated

### Testing
- [ ] Extensive testnet testing (>1000 transactions)
- [ ] Fuzz testing completed
- [ ] Integration testing with bundlers
- [ ] Load testing performed
- [ ] Edge cases tested
- [ ] Failure modes documented

### Infrastructure
- [ ] Monitoring setup (Tenderly/Defender)
- [ ] Alerting configured
- [ ] Backup RPC providers configured
- [ ] Bundler infrastructure ready
- [ ] Frontend hosted on reliable platform
- [ ] CDN configured for frontend
- [ ] Database backup strategy

### Legal & Compliance
- [ ] Legal review completed
- [ ] Terms of service prepared
- [ ] Privacy policy prepared
- [ ] Compliance requirements met
- [ ] User agreements ready

### Communication
- [ ] Announcement prepared
- [ ] Documentation finalized
- [ ] Support channels ready
- [ ] Community informed
- [ ] Social media posts scheduled

## Mainnet Deployment

### Pre-Deployment
- [ ] All production readiness items complete
- [ ] Final security review
- [ ] Deployment plan reviewed
- [ ] Rollback plan prepared
- [ ] Team on standby

### Deployment
- [ ] Deploy to mainnet
- [ ] Verify contracts
- [ ] Transfer ownership to multi-sig
- [ ] Setup monitoring
- [ ] Test with small amounts first
- [ ] Gradual rollout plan

### Post-Deployment
- [ ] Monitor for 48 hours
- [ ] Check all metrics
- [ ] Respond to issues quickly
- [ ] Collect user feedback
- [ ] Document lessons learned

## Verification Steps

### Contract Verification
```bash
# Verify factory
forge verify-contract \
  --chain-id 11155111 \
  --compiler-version v0.8.23 \
  --constructor-args $(cast abi-encode "constructor(address)" 0x0000000071727De22E5E9d8BAf0edAc6f37da032) \
  <FACTORY_ADDRESS> \
  src/P256AccountFactory.sol:P256AccountFactory
```

### Functional Testing
```bash
# Check precompile
cast call <FACTORY_ADDRESS> "isPrecompileAvailable()(bool)" --rpc-url sepolia

# Create account
cast send <FACTORY_ADDRESS> \
  "createAccount(bytes32,bytes32,address,uint256)" \
  <QX> <QY> <OWNER> 0 \
  --rpc-url sepolia \
  --private-key $PRIVATE_KEY

# Get account address
cast call <FACTORY_ADDRESS> \
  "getAddress(bytes32,bytes32,address,uint256)(address)" \
  <QX> <QY> <OWNER> 0 \
  --rpc-url sepolia
```

## Rollback Plan

### If Issues Found
1. [ ] Pause new account creation (if possible)
2. [ ] Notify users immediately
3. [ ] Document the issue
4. [ ] Prepare fix
5. [ ] Test fix thoroughly
6. [ ] Deploy new version
7. [ ] Migrate users if needed

### Communication
- [ ] Status page updated
- [ ] Users notified via email
- [ ] Social media announcement
- [ ] Discord/Telegram update
- [ ] Post-mortem published

## Monitoring Checklist

### Metrics to Track
- [ ] Number of accounts created
- [ ] Transaction success rate
- [ ] Average gas costs
- [ ] Signature verification failures
- [ ] Contract balance
- [ ] EntryPoint deposits

### Alerts to Configure
- [ ] Failed transactions spike
- [ ] Unusual gas costs
- [ ] Contract balance low
- [ ] Signature verification failures
- [ ] Precompile unavailable
- [ ] RPC provider issues

## Support Checklist

### Documentation
- [ ] User guide published
- [ ] FAQ updated
- [ ] Troubleshooting guide ready
- [ ] API documentation complete

### Support Channels
- [ ] Discord server active
- [ ] GitHub Discussions enabled
- [ ] Email support configured
- [ ] Status page setup

### Team Readiness
- [ ] Support team trained
- [ ] On-call rotation scheduled
- [ ] Escalation process defined
- [ ] Response time SLAs set

## Success Criteria

### Deployment Success
- [ ] Factory deployed and verified
- [ ] Test account created successfully
- [ ] Transaction executed successfully
- [ ] Gas costs within expected range
- [ ] No critical issues found

### User Success
- [ ] Users can create passkeys
- [ ] Users can deploy accounts
- [ ] Users can send transactions
- [ ] User experience is smooth
- [ ] Support requests are minimal

## Notes

### Deployment Date
- Date: _______________
- Network: Sepolia / Mainnet
- Deployer: _______________

### Addresses
- Factory: _______________
- Test Account: _______________
- EntryPoint: 0x0000000071727De22E5E9d8BAf0edAc6f37da032

### Gas Costs
- Factory Deployment: _______________ gas
- Account Creation: _______________ gas
- Transaction: _______________ gas

### Issues Encountered
1. _______________
2. _______________
3. _______________

### Lessons Learned
1. _______________
2. _______________
3. _______________

---

## Final Checklist

Before going live:
- [ ] All items above completed
- [ ] Team sign-off obtained
- [ ] Legal approval received
- [ ] Security audit passed
- [ ] Monitoring active
- [ ] Support ready
- [ ] Communication prepared

**Deployment approved by:**
- Technical Lead: _______________
- Security Lead: _______________
- Product Lead: _______________

**Date:** _______________

---

**Remember:** Take your time, test thoroughly, and don't rush to production!

