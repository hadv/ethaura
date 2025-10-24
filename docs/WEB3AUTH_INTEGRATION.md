# Web3Auth Integration with 2FA

## 📋 Overview

This document describes the integration of Web3Auth for social login with P256Account's Two-Factor Authentication (2FA) feature.

**Key Features**:
- 🔐 Social login as primary authentication (Google, Facebook, Twitter, Email)
- 🔑 Automatic wallet creation (no seed phrases!)
- 🔒 Passkey as Two-Factor Authentication (2FA)
- ✅ Transparent user consent for all signatures
- ✅ Seamless user experience

---

## 🏗️ Architecture

### Authentication Flow

```
1. User clicks "Login with Social Account"
   ↓
2. Web3Auth modal opens → User selects login method
   ↓
3. User authenticates (Google/Facebook/Twitter/Email)
   ↓
4. Web3Auth generates Ethereum wallet (private key managed securely)
   ├─> This becomes the PRIMARY owner account
   └─> Used to sign all transactions
   ↓
5. User adds Passkey (Touch ID/Face ID) as 2FA
   ├─> Passkey provides biometric authentication
   └─> Enhances security with dual signatures
   ↓
6. Deploy P256Account with:
   - qx, qy: from Passkey public key
   - owner: from Web3Auth wallet address (PRIMARY)
   ↓
7. 2FA enabled automatically
   ├─> Social Login: Primary authentication
   └─> Passkey: Two-Factor Authentication
   ↓
8. User can now send transactions with dual signatures
```

### Transaction Signing Flow (2FA)

```
1. User initiates transaction
   ↓
2. Create UserOperation
   ↓
3. Compute userOpHash
   ↓
4. Sign with Passkey (P-256 signature) - 2FA Step 1
   ├─> User prompted for biometric (Touch ID/Face ID)
   └─> Get r, s values
   ↓
5. Show signature confirmation dialog
   ├─> Display transaction details
   ├─> Show what user is signing
   ├─> Request user consent
   └─> User clicks "Confirm & Sign"
   ↓
6. Sign with Web3Auth wallet (ECDSA signature) - 2FA Step 2
   ├─> User has confirmed and consented
   └─> Get 65-byte signature (r + s + v)
   ↓
7. Combine signatures
   ├─> P-256: r (32) + s (32) = 64 bytes
   ├─> ECDSA: r (32) + s (32) + v (1) = 65 bytes
   └─> Combined: 64 + 65 = 129 bytes
   ↓
8. Submit UserOperation to bundler
   ↓
9. EntryPoint validates both signatures
   ├─> Verify P-256 signature (passkey)
   └─> Verify ECDSA signature (owner)
   ↓
10. Transaction executed ✅
```

---

## 🚀 Setup

### 1. Get Web3Auth Client ID

1. Go to [Web3Auth Dashboard](https://dashboard.web3auth.io/)
2. Create a new project
3. Select "Plug and Play" → "Web"
4. Configure:
   - **Project Name**: EthAura
   - **Network**: Sapphire Devnet (for testing) or Mainnet (for production)
   - **Whitelist URLs**: 
     - `http://localhost:5173` (development)
     - Your production domain
5. Copy the **Client ID**

### 2. Configure Environment Variables

Create `frontend/.env`:

```bash
# Web3Auth Configuration
VITE_WEB3AUTH_CLIENT_ID=your_client_id_here

# Network Configuration
VITE_CHAIN_ID=11155111
VITE_RPC_URL=https://rpc.sepolia.org

# Contract Addresses
VITE_FACTORY_ADDRESS=your_factory_address
VITE_ENTRYPOINT_ADDRESS=0x0000000071727De22E5E9d8BAf0edAc6f37da032
```

### 3. Install Dependencies

```bash
cd frontend
npm install @web3auth/modal @web3auth/base @web3auth/ethereum-provider @web3auth/openlogin-adapter
```

---

## 💻 Implementation

### Web3Auth Context

The `Web3AuthContext` provides:

```javascript
const {
  web3auth,           // Web3Auth instance
  provider,           // Ethereum provider
  walletClient,       // Viem wallet client
  userInfo,           // User profile (name, email, picture)
  address,            // Wallet address
  isLoading,          // Loading state
  isConnected,        // Connection state
  login,              // Login function
  logout,             // Logout function
  signMessage,        // Sign message function
  signTypedData,      // Sign typed data function
  getPrivateKey,      // Get private key (use with caution!)
} = useWeb3Auth();
```

### Login Component

```jsx
import { useWeb3Auth } from '../contexts/Web3AuthContext';

function MyComponent() {
  const { isConnected, userInfo, address, login, logout } = useWeb3Auth();

  if (isConnected) {
    return (
      <div>
        <img src={userInfo.profileImage} alt="Profile" />
        <p>Name: {userInfo.name}</p>
        <p>Email: {userInfo.email}</p>
        <p>Wallet: {address}</p>
        <button onClick={logout}>Logout</button>
      </div>
    );
  }

  return <button onClick={login}>Login with Web3Auth</button>;
}
```

### Signing with 2FA

```javascript
import { useWeb3Auth } from '../contexts/Web3AuthContext';
import { signWithPasskey, derToRS } from '../utils/webauthn';
import { combineTwoFactorSignatures } from '../utils/signatureUtils';

async function signTransaction(userOpHash, credential) {
  const { signMessage } = useWeb3Auth();

  // 1. Sign with Passkey (P-256)
  const passkeySignatureRaw = await signWithPasskey(credential, userOpHash);
  const { r, s } = derToRS(passkeySignatureRaw.signature);

  // 2. Sign with Web3Auth wallet (ECDSA)
  const ownerSignature = await signMessage(userOpHash);

  // 3. Combine signatures
  const combinedSignature = combineTwoFactorSignatures(
    { r: '0x' + r, s: '0x' + s },
    ownerSignature
  );

  return combinedSignature; // 129 bytes
}
```

---

## 🔒 Security Considerations

### 1. **Private Key Management**

Web3Auth manages private keys securely:
- **Multi-Party Computation (MPC)**: Key shares distributed across multiple nodes
- **Threshold Signatures**: No single point of failure
- **Non-custodial**: User always has control

### 2. **2FA Benefits**

- **Passkey**: Device-bound, biometric-protected
- **Web3Auth**: Social login, MPC-secured
- **Both required**: Attacker needs both factors

### 3. **Attack Scenarios**

| Attack | Passkey Only | Web3Auth Only | 2FA (Both) |
|--------|--------------|---------------|------------|
| Stolen device | ❌ Vulnerable | ✅ Safe | ✅ Safe |
| Compromised social account | ✅ Safe | ❌ Vulnerable | ✅ Safe |
| Phishing | ✅ Safe (WebAuthn) | ⚠️ Depends | ✅ Safe |
| Malware | ⚠️ Depends | ⚠️ Depends | ✅ Safer |

### 4. **Best Practices**

✅ **DO**:
- Enable 2FA for high-value accounts
- Use strong social account passwords
- Enable 2FA on social accounts (Google, etc.)
- Keep devices updated
- Use hardware security keys when possible

❌ **DON'T**:
- Share Web3Auth credentials
- Use public/shared devices for high-value transactions
- Disable 2FA for convenience
- Expose private keys

---

## 📊 User Experience

### Login Flow

1. **User clicks "Login with Social Account"**
   - Web3Auth modal opens
   - User sees login options (Google, Facebook, Twitter, Email)

2. **User selects login method**
   - Redirected to provider (e.g., Google)
   - Authenticates with existing account

3. **Primary wallet created automatically**
   - No seed phrases to remember
   - Social login becomes primary owner
   - Address displayed immediately

4. **User adds Passkey as 2FA**
   - Prompted for biometric (Touch ID/Face ID)
   - Passkey stored in device's secure enclave
   - Enhances security with two-factor authentication

5. **Account created with 2FA**
   - One-click creation
   - 2FA enabled automatically (Social Login + Passkey)

### Transaction Flow

1. **User enters transaction details**
   - Target address
   - Amount

2. **User clicks "Send Transaction"**
   - Status: "Signing with Passkey..."
   - Biometric prompt appears

3. **User authenticates with biometric (2FA Step 1)**
   - Touch ID/Face ID
   - P-256 signature created

4. **Signature confirmation dialog appears**
   - Shows transaction details (from, to, amount, hash)
   - Displays what user is signing
   - User reviews and confirms

5. **User clicks "Confirm & Sign" (2FA Step 2)**
   - Social login account signs the transaction
   - User has full transparency and control

4. **Web3Auth signs automatically**
   - No additional user prompt
   - ECDSA signature created

5. **Signatures combined**
   - 129-byte signature created
   - Submitted to bundler

6. **Transaction confirmed**
   - EntryPoint validates both signatures
   - Transaction executed

---

## 🎯 Use Cases

### 1. **Consumer Wallets**

Perfect for everyday users:
- ✅ No seed phrases
- ✅ Familiar social login
- ✅ Biometric security
- ✅ 2FA protection

### 2. **Corporate Accounts**

Ideal for business use:
- ✅ Employee social accounts
- ✅ Biometric authentication
- ✅ Dual approval (employee + company)
- ✅ Audit trail

### 3. **DeFi Applications**

Great for DeFi users:
- ✅ Easy onboarding
- ✅ High security (2FA)
- ✅ No seed phrase management
- ✅ Familiar UX

### 4. **Gaming**

Perfect for gamers:
- ✅ Quick login (social)
- ✅ Secure assets (2FA)
- ✅ No crypto knowledge needed
- ✅ Seamless experience

---

## 🔧 Troubleshooting

### Issue: "Web3Auth not initialized"

**Solution**: Make sure `Web3AuthProvider` wraps your app:

```jsx
<Web3AuthProvider>
  <App />
</Web3AuthProvider>
```

### Issue: "Invalid client ID"

**Solution**: 
1. Check `.env` file has correct `VITE_WEB3AUTH_CLIENT_ID`
2. Verify client ID in Web3Auth dashboard
3. Restart dev server after changing `.env`

### Issue: "Wallet not connected"

**Solution**: User must login with Web3Auth before signing

### Issue: "Invalid signature length"

**Solution**: 
- Check passkey signature is 64 bytes (r + s)
- Check owner signature is 65 bytes (r + s + v)
- Combined should be 129 bytes

---

## 📚 Resources

### Web3Auth

- [Web3Auth Documentation](https://web3auth.io/docs/)
- [Web3Auth Dashboard](https://dashboard.web3auth.io/)
- [Web3Auth Examples](https://github.com/Web3Auth/web3auth-pnp-examples)

### ERC-4337

- [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)
- [Account Abstraction Docs](https://docs.alchemy.com/docs/account-abstraction-overview)

### WebAuthn/Passkeys

- [WebAuthn Guide](https://webauthn.guide/)
- [Passkeys.dev](https://passkeys.dev/)

---

## 🎓 Summary

**Web3Auth + Passkey 2FA** provides:

✅ **Best UX**: Social login + biometric auth  
✅ **Best Security**: Two independent factors  
✅ **No Seed Phrases**: Web3Auth manages keys  
✅ **Familiar Flow**: Like existing web apps  
✅ **Production Ready**: Battle-tested infrastructure  

This is the **future of Web3 onboarding**! 🚀

