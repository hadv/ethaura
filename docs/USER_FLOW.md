# EthAura User Flow

This document describes the complete user flow for creating and using an EthAura smart contract wallet.

## Overview

EthAura provides a flexible, progressive security model where users can start simple and add more security features as needed. The flow follows these steps:

1. **Social Login** (Required)
2. **Add Passkey** (Optional)
3. **Create Account** (Choose security level)
4. **Use Account** (Send transactions, manage guardians)
5. **Recovery** (If you lose access)

---

## Step 1: Social Login with Web3Auth

**Required:** Yes  
**Purpose:** Authenticate user and generate an Ethereum wallet address

### User Actions:
1. Click "Login with Web3Auth"
2. Choose social provider (Google, Facebook, Twitter, Email)
3. Complete OAuth flow
4. Web3Auth generates an Ethereum private key from social login

### Result:
- User is authenticated
- Owner address is generated (e.g., `0x1234...5678`)
- This address will be the primary owner of the smart contract wallet

---

## Step 2: Add Passkey for 2FA (Optional)

**Required:** No  
**Purpose:** Add biometric authentication for enhanced security

### User Actions:
1. Click "Add Passkey" button
2. Browser prompts for biometric authentication (Touch ID, Face ID, Windows Hello)
3. Device creates a P-256 keypair in secure enclave
4. Public key is extracted and stored

### Result:
- Passkey credential is created and stored locally
- P-256 public key (x, y coordinates) is available
- User can now create accounts with passkey support

### Skip This Step?
**Yes!** Users can skip this step and create a simple account with just social login. They can add a passkey later if needed.

---

## Step 3: Create Your Smart Account

**Required:** Yes
**Purpose:** Deploy a P256Account smart contract wallet

### ✅ Good News: Your Address Stays the Same!

**The counterfactual address is calculated using CREATE2 based on:**
- Factory address
- **Owner address (your social login)**
- **Salt (usually 0)**

**IMPORTANT: The address does NOT depend on your passkey choice!**

**This means:**
- **Same owner** = **Same address** (regardless of passkey)
- You can add or change passkey later without changing your address
- You can receive funds first, then decide on security level later

**Example Flow:**
1. Create "Social Login Only" account → Address A
2. Receive 10 ETH at Address A
3. Later, you want to add a passkey for security
4. ✅ **You can!** Call `proposePublicKeyUpdate()` to add a passkey
5. Your 10 ETH stays at Address A (now with passkey support)

**✅ Flexible Security:**
- Start with any account type
- Add or change passkey later via `proposePublicKeyUpdate()`
- Enable or disable 2FA anytime via `enableTwoFactor()` / `disableTwoFactor()`
- Your address never changes!

### Three Account Types:

#### Option 1: Social Login Only (Simple)
**Security Level:** Basic  
**Signatures Required:** Owner signature only

**Pros:**
- ✅ Quick and easy setup
- ✅ Familiar login experience
- ✅ Can add passkey later

**Cons:**
- ⚠️ Single point of failure
- ⚠️ Less secure than 2FA

**Use Case:** Getting started, small amounts, testing

**User Actions:**
1. Click "Create Simple Account"
2. Account address is calculated (counterfactual deployment)
3. Account will deploy on first transaction

**Smart Contract State:**
```solidity
qx = 0x0
qy = 0x0
owner = <social_login_address>
twoFactorEnabled = false
```

---

#### Option 2: With Passkey (Recommended)
**Security Level:** Basic (same as owner-only)
**Signatures Required:** Owner signature only (2FA disabled)

**Pros:**
- ✅ Passkey registered and ready
- ✅ Can enable 2FA later for dual signatures
- ✅ Same UX as simple account for now

**Cons:**
- ⚠️ Currently uses owner signature only (2FA disabled)
- ⚠️ Passkey not used until 2FA is enabled

**Use Case:** Preparing for future 2FA, want passkey registered but not enforced yet

**Prerequisites:**
- Must have created a passkey in Step 2

**User Actions:**
1. Click "Create Account with Passkey"
2. Account address is calculated with passkey public key
3. Account will deploy on first transaction

**Smart Contract State:**
```solidity
qx = <passkey_public_key_x>
qy = <passkey_public_key_y>
owner = <social_login_address>
twoFactorEnabled = false
```

**Transaction Signing:**
- User signs with social login (owner signature) ONLY
- Passkey is registered but NOT used for signing
- To use passkey, must enable 2FA later

---

#### Option 3: With 2FA (Most Secure)
**Security Level:** Maximum  
**Signatures Required:** Owner signature AND Passkey signature

**Pros:**
- ✅ Maximum security (dual signatures)
- ✅ Protects against social login compromise
- ✅ Recommended for large amounts

**Cons:**
- ⚠️ Requires both signatures for every transaction
- ⚠️ Slightly more complex UX

**Use Case:** Large amounts, maximum security, long-term storage

**Prerequisites:**
- Must have created a passkey in Step 2

**User Actions:**
1. Click "Create Account with 2FA"
2. Account address is calculated with passkey public key
3. Account will deploy on first transaction

**Smart Contract State:**
```solidity
qx = <passkey_public_key_x>
qy = <passkey_public_key_y>
owner = <social_login_address>
twoFactorEnabled = true
```

**Transaction Signing:**
- User MUST sign with passkey (WebAuthn signature)
- AND user MUST sign with social login (owner signature)
- BOTH signatures are required

---

## Step 4: Use Your Account

### Fund Your Account
1. Copy your account address
2. Send Sepolia ETH from:
   - Sepolia Faucet: https://sepoliafaucet.com
   - Your existing wallet (MetaMask, etc.)
   - A centralized exchange

### Send Transactions
1. Enter recipient address and amount
2. Click "Send Transaction"
3. Sign with required method(s):
   - **Social Login Only:** Sign with Web3Auth
   - **With Passkey (no 2FA):** Sign with Web3Auth OR Passkey
   - **With 2FA:** Sign with BOTH Web3Auth AND Passkey
4. Transaction is submitted to ERC-4337 EntryPoint
5. Account deploys automatically on first transaction (if not already deployed)

### Manage Guardians
1. Add trusted addresses as guardians
2. Set recovery threshold (e.g., 2 out of 3 guardians)
3. Guardians can help recover your account if you lose access

---

## Security Comparison

| Feature | Social Login Only | With Passkey (2FA Off) | With 2FA |
|---------|------------------|----------------------|----------|
| **Setup Complexity** | ⭐ Simple | ⭐⭐ Easy | ⭐⭐⭐ Moderate |
| **Transaction UX** | ⭐ One signature | ⭐ One signature | ⭐⭐⭐ Two signatures |
| **Security Level** | ⭐ Basic | ⭐ Basic | ⭐⭐⭐ Maximum |
| **Social Login Compromise** | ❌ Funds lost | ❌ Funds lost | ✅ Protected |
| **Passkey Required** | ❌ No | ✅ Yes | ✅ Yes |
| **Passkey Used for Signing** | ❌ No | ❌ No (2FA disabled) | ✅ Yes (required) |
| **Can Enable 2FA Later** | ❌ No* | ✅ Yes | N/A |

*Cannot enable 2FA later because no passkey is registered (qx=0, qy=0)

---

## Progressive Security Enhancement

EthAura supports progressive security enhancement:

### Path 1: Start Simple (Cannot Add 2FA Later)
1. Create "Social Login Only" account (qx=0, qy=0)
2. Use it for small amounts
3. ⚠️ **Cannot enable 2FA later** (no passkey registered)
4. Would need to create a new account to use 2FA

### Path 2: Start with Passkey, Enable 2FA Later
1. Create "With Passkey" account (qx!=0, qy!=0, 2FA=false)
2. Use it with owner signature only (same as simple account)
3. Later: Enable 2FA to require both owner AND passkey signatures
4. ✅ **Best for progressive security**

### Path 3: Maximum Security from Day 1
1. Create "With 2FA" account (qx!=0, qy!=0, 2FA=true)
2. Always require both owner AND passkey signatures
3. Maximum protection from the start
4. ✅ **Best for large amounts**

---

## Technical Details

### Counterfactual Deployment
- Account address is calculated using CREATE2
- Account is NOT deployed until first transaction
- Users can receive funds before deployment
- Deployment happens automatically on first UserOperation

### Signature Formats

**Owner-only mode (65 bytes):**
```
ECDSA signature from owner (r || s || v)
```

**Passkey mode without 2FA (variable length):**
```
WebAuthn signature:
r (32) || s (32) || authDataLen (2) || challengeIndex (2) || 
authenticatorData || clientDataJSON
```

**Passkey mode with 2FA (variable length):**
```
WebAuthn signature + Owner signature:
r (32) || s (32) || authDataLen (2) || challengeIndex (2) || 
authenticatorData || clientDataJSON || ownerSig (65)
```

### Challenge Verification
When 2FA is enabled, the contract verifies:
1. ✅ WebAuthn signature is cryptographically valid
2. ✅ Challenge in clientDataJSON matches userOpHash
3. ✅ Owner signature is valid
4. ✅ Owner signature matches the account owner

This prevents replay attacks and ensures the passkey is actually authorizing the specific transaction.

---

## Recommendations

### For New Users
- Start with "Social Login Only" to get familiar
- ⚠️ Note: Cannot add 2FA later (would need new account)
- Good for testing and small amounts

### For Security-Conscious Users
- Start with "With 2FA" from day 1
- Maximum security from the start
- Add multiple guardians
- Use hardware security keys if available

### For Progressive Security
- Start with "With Passkey" (2FA disabled)
- Use owner signature only initially
- Enable 2FA later when you need maximum security
- ✅ **Recommended approach** for most users

---

## Step 5: Account Recovery

**Purpose:** Recover access if you lose your device, passkey, or Web3Auth access

### Recovery Scenarios

#### Scenario 1: Lost Device (but still have Web3Auth)

**What you can do:**
1. Login with Web3Auth → get owner address
2. Recalculate account address: `factory.getAddress(0, 0, owner, 0)`
3. ✅ **If 2FA disabled:** Sign with owner immediately
4. ❌ **If 2FA enabled:** Use guardian recovery (see below)

#### Scenario 2: Lost Passkey (2FA enabled)

**What you need:**
- Guardians must initiate recovery
- Wait 48-hour timelock
- Execute recovery to set new passkey or remove passkey

**Recovery flow:**
1. Guardian calls `initiateRecovery(newQx, newQy, owner)`
2. Other guardians approve via `approveRecovery(requestNonce)`
3. Wait 48 hours
4. Anyone calls `executeRecovery(requestNonce)`
5. ✅ **Access restored!**

#### Scenario 3: Lost Web3Auth Access

**What you need:**
- Guardians must initiate recovery
- Set new owner address

**Recovery flow:**
1. Guardian calls `initiateRecovery(qx, qy, newOwner)`
2. Other guardians approve
3. Wait 48 hours
4. Execute recovery
5. ✅ **New owner can access account!**

### Important Notes

- ⚠️ **Set up guardians BEFORE you lose access**
- ⚠️ **Without guardians, recovery is impossible**
- ⚠️ **48-hour timelock protects against malicious recovery**

**For detailed recovery instructions, see [RECOVERY_GUIDE.md](./RECOVERY_GUIDE.md)**

---

## Next Steps

After creating your account:
1. ✅ Fund your account with Sepolia ETH
2. ✅ **Add guardians for recovery** (CRITICAL!)
3. ✅ Send your first transaction
4. ✅ Consider enabling 2FA for larger amounts
5. ✅ Test recovery process with small amounts

