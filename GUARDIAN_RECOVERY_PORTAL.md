# Guardian Recovery Portal - Implementation Guide

## 🎉 Overview

The Guardian Recovery Portal is a standalone web interface that allows guardians to help users recover their EthAura smart accounts without needing to log into the main wallet app.

## ✨ Features

- **🦊 Universal Wallet Support**: Connect with MetaMask, Rainbow, Coinbase Wallet, or any WalletConnect-compatible wallet
- **🔐 Two Modes**:
  - **Initiate Mode**: Guardian starts a new recovery request
  - **Approve Mode**: Guardian approves an existing recovery request
- **📤 Shareable Links**: Generate links to share with other guardians
- **⏱️ Timelock Display**: Shows remaining time before recovery can be executed
- **✅ Auto-Execute**: Execute recovery once threshold is met and timelock passes

## 🚀 How to Use

### Mode 1: Initiate Recovery (Guardian Starts Recovery)

**URL Format:**
```
http://localhost:3000/guardian-recovery?account=0x123...
```

**Flow:**
1. User loses access to their account (lost passkey, lost Web3Auth)
2. User contacts their guardian (phone, email, etc.)
3. User shares their account address with guardian
4. Guardian visits: `http://localhost:3000/guardian-recovery?account=<USER_ACCOUNT_ADDRESS>`
5. Guardian connects their wallet (MetaMask, Rainbow, Coinbase, WalletConnect)
6. Portal verifies guardian status
7. Guardian provides new public key (qx, qy) and new owner address
8. Guardian initiates recovery
9. Portal generates shareable link for other guardians
10. Guardian shares link to get more approvals

**Example:**
```
http://localhost:3000/guardian-recovery?account=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0
```

### Mode 2: Approve Recovery (Guardian Approves Existing Request)

**URL Format:**
```
http://localhost:3000/guardian-recovery?account=0x123...&nonce=5
```

**Flow:**
1. Guardian receives link from another guardian
2. Guardian clicks link → Opens portal
3. Guardian connects wallet
4. Portal shows recovery details (account, new public key, approvals, timelock)
5. Guardian reviews and approves with one click
6. If threshold met and timelock passed, guardian can execute recovery

**Example:**
```
http://localhost:3000/guardian-recovery?account=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0&nonce=0
```

## 🛠️ Technical Implementation

### Files Created

1. **Components:**
   - `frontend/src/components/GuardianWalletConnector.jsx` - Wallet connection UI
   - `frontend/src/components/RecoveryInitiator.jsx` - Initiate recovery flow
   - `frontend/src/components/RecoveryApprover.jsx` - Approve/execute recovery flow

2. **Screens:**
   - `frontend/src/screens/GuardianRecoveryPortal.jsx` - Main portal screen

3. **Utilities:**
   - `frontend/src/utils/walletUtils.js` - Wallet connection helpers
   - `frontend/src/utils/recoveryUtils.js` - Recovery contract interaction helpers

4. **Styles:**
   - `frontend/src/styles/GuardianRecoveryPortal.css` - Portal styling

5. **Routing:**
   - Modified `frontend/src/App.jsx` to detect `/guardian-recovery` route

### Smart Contract Functions Used

- `guardians(address)` - Check if address is a guardian
- `getGuardians()` - Get list of all guardians
- `guardianThreshold()` - Get required approval threshold
- `initiateRecovery(bytes32 newQx, bytes32 newQy, address newOwner)` - Start recovery
- `approveRecovery(uint256 requestNonce)` - Approve recovery request
- `executeRecovery(uint256 requestNonce)` - Execute recovery after timelock
- `getRecoveryRequest(uint256 requestNonce)` - Get recovery details
- `hasApprovedRecovery(uint256 requestNonce, address guardian)` - Check approval status

## 🧪 Testing

### Prerequisites

1. Deploy a P256Account with guardians configured
2. Have at least 2 guardian addresses with private keys
3. Run the frontend: `cd frontend && npm run dev`

### Test Scenario 1: Initiate Recovery

1. Open browser: `http://localhost:3000/guardian-recovery?account=<ACCOUNT_ADDRESS>`
2. Connect wallet (MetaMask, etc.) with guardian address
3. Verify guardian status is confirmed
4. Enter new public key coordinates (qx, qy) and new owner address
5. Click "Initiate Recovery"
6. Copy the generated shareable link
7. Verify transaction on Etherscan

### Test Scenario 2: Approve Recovery

1. Use the link from Scenario 1 (or manually construct):
   `http://localhost:3000/guardian-recovery?account=<ACCOUNT>&nonce=0`
2. Connect wallet with a different guardian address
3. Review recovery details
4. Click "Approve Recovery"
5. Verify approval count increases
6. If threshold met and timelock passed, click "Execute Recovery"

### Test Scenario 3: WalletConnect Support

1. Open the portal on mobile browser
2. Click "Connect Wallet"
3. Select WalletConnect option (if using RainbowKit)
4. Scan QR code with mobile wallet app (Trust Wallet, MetaMask Mobile, etc.)
5. Complete recovery flow on mobile

## 🔒 Security Considerations

1. **Guardian Verification**: Portal verifies connected address is a guardian before allowing actions
2. **Network Validation**: Ensures guardian is on correct network (Sepolia/Mainnet)
3. **Timelock Enforcement**: 24-hour timelock enforced by smart contract
4. **Threshold Requirement**: Multiple guardian approvals required (configurable)
5. **No Private Keys**: Portal never handles private keys, only wallet signatures

## 📝 URL Parameters

| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| `account` | Optional* | P256Account address to recover | `0x742d35...` |
| `nonce` | Optional | Recovery request nonce (for approve mode) | `0`, `1`, `2` |
| `network` | Optional | Network name (default: sepolia) | `sepolia`, `mainnet` |

*Note: `account` is optional for initiate mode (can be entered manually), but recommended for better UX.

## 🎨 UI/UX Features

- **Responsive Design**: Works on desktop, tablet, and mobile
- **Real-time Status**: Shows approval count, timelock countdown
- **Error Handling**: Clear error messages for common issues
- **Loading States**: Visual feedback during transactions
- **Copy to Clipboard**: Easy link sharing
- **Network Indicator**: Shows current network and allows switching

## 🚧 Known Limitations

1. **Recovery Nonce Extraction**: Currently hardcoded to 0, needs to parse from event logs
2. **Production Routing**: May need server-side redirect configuration for production deployment
3. **WalletConnect Modal**: Using basic injected provider, could enhance with RainbowKit modal
4. **Mobile Optimization**: Could improve mobile UX with better touch targets

## 🔮 Future Enhancements

1. **QR Code Generation**: Generate QR codes for easy mobile sharing
2. **Email/SMS Integration**: Send recovery links via email/SMS
3. **Push Notifications**: Notify guardians when approval needed
4. **Multi-Network Support**: Support multiple networks in one portal
5. **Recovery History**: Show past recovery requests
6. **Guardian Dashboard**: Dedicated dashboard for guardians to manage all their accounts

## 📚 Related Documentation

- [GitHub Issue #84](https://github.com/hadv/ethaura/issues/84) - Original feature request
- [P256Account.sol](../src/P256Account.sol) - Smart contract implementation
- [WalletConnect Integration](./WALLETCONNECT_IMPLEMENTATION.md) - WalletConnect setup guide

## 🤝 Contributing

To contribute to the Guardian Recovery Portal:

1. Test the portal with different wallets
2. Report bugs via GitHub issues
3. Suggest UX improvements
4. Submit PRs for enhancements

## 📞 Support

For questions or issues:
- Open a GitHub issue
- Contact the development team
- Check the documentation

---

**Built with ❤️ for EthAura - Secure, Guardian-Based Account Recovery**

