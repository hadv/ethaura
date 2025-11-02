# ΞTHΛURΛ Account Recovery Guide

This guide explains how to recover access to your ΞTHΛURΛ account in various scenarios.

## Overview

ΞTHΛURΛ provides multiple recovery mechanisms depending on what you've lost:

1. **Address Recovery** - Recalculate your account address
2. **Fund Access Recovery** - Regain ability to sign transactions
3. **Guardian Recovery** - Change owner or passkey via guardians

---

## Scenario 1: Lost Device (but still have Web3Auth access)

### What You Lost
- ❌ Device with passkey (secure enclave)
- ❌ localStorage data (passkey credential, account address)

### What You Still Have
- ✅ Web3Auth social login (Google, Facebook, etc.)
- ✅ Can get owner address

### Recovery Steps

#### Step 1: Recalculate Account Address

```javascript
// Login with Web3Auth
const ownerAddress = await web3auth.login()
// Gets: 0xABCD...1234 (same owner address as before)

// Recalculate account address
const accountAddress = factory.getAddress(
  0x0, 0x0,      // qx, qy (doesn't matter - not used in calculation)
  ownerAddress,  // Your owner address from Web3Auth
  0n             // salt = 0 (we always use 0)
)
// Gets: 0x5678...9ABC (your account address!)
```

#### Step 2: Check Account Configuration

```javascript
const account = P256Account.attach(accountAddress)
const qx = await account.qx()
const qy = await account.qy()
const twoFactorEnabled = await account.twoFactorEnabled()
```

#### Step 3A: If 2FA is Disabled

✅ **You can access your funds immediately!**

```javascript
// Sign transactions with owner (Web3Auth) only
const userOp = await sdk.signUserOperation(userOp, ownerAddress)
// No passkey needed!
```

#### Step 3B: If 2FA is Enabled

❌ **You cannot sign transactions** (need passkey + owner)

**Solution:** Use Guardian Recovery (see Scenario 3 below)

---

## Scenario 2: Lost Web3Auth Access (but still have device)

### What You Lost
- ❌ Web3Auth social login (lost Google account, etc.)
- ❌ Owner private key
- ❌ Cannot get owner address

### What You Still Have
- ✅ Device with passkey
- ✅ localStorage data

### Recovery Steps

❌ **You cannot recalculate address** (don't have owner address)

**Solution:** Use Guardian Recovery (see Scenario 3 below)

---

## Scenario 3: Guardian Recovery (Lost Passkey or Web3Auth)

### When to Use Guardian Recovery

Use guardian recovery when:
- Lost passkey AND 2FA is enabled (cannot sign transactions)
- Lost Web3Auth access (cannot get owner address)
- Want to change owner or passkey

### Prerequisites

- ✅ You must have set up guardians before losing access
- ✅ Guardians must approve the recovery
- ✅ Must wait 48-hour timelock

### Recovery Flow

#### Step 1: Guardian Initiates Recovery

Any guardian can initiate recovery:

```solidity
// Guardian calls this function
account.initiateRecovery(
  newQx,    // New passkey X coordinate (or 0x0 to remove passkey)
  newQy,    // New passkey Y coordinate (or 0x0 to remove passkey)
  newOwner  // New owner address (or same owner if just changing passkey)
)
```

**Examples:**

**Example 1: User lost passkey, wants to set new passkey**
```solidity
account.initiateRecovery(
  0x1234...5678,  // New passkey qx
  0xABCD...EF01,  // New passkey qy
  currentOwner    // Keep same owner
)
```

**Example 2: User lost passkey, wants to remove passkey (disable 2FA)**
```solidity
account.initiateRecovery(
  0x0,            // Remove passkey
  0x0,            // Remove passkey
  currentOwner    // Keep same owner
)
```

**Example 3: User lost Web3Auth, wants new owner**
```solidity
account.initiateRecovery(
  currentQx,      // Keep same passkey
  currentQy,      // Keep same passkey
  newOwner        // New owner address
)
```

#### Step 2: Other Guardians Approve

Other guardians must approve until threshold is reached:

```solidity
// Each guardian calls this
account.approveRecovery(requestNonce)
```

**Example:**
- Guardian threshold = 2
- Guardian 1 initiates recovery (counts as 1 approval)
- Guardian 2 approves (total = 2 approvals)
- ✅ Threshold reached!

#### Step 3: Wait 48 Hours (Timelock)

The recovery request has a 48-hour timelock to prevent immediate compromise.

**During this time:**
- ⏳ Wait for timelock to expire
- ⚠️ If the recovery is malicious, the owner can cancel it (if they still have access)

#### Step 4: Execute Recovery

After 48 hours, anyone can execute the recovery:

```solidity
account.executeRecovery(requestNonce)
```

**Result:**
- ✅ Passkey updated (qx, qy changed)
- ✅ Owner updated (if changed)
- ✅ User can now sign transactions!

### After Recovery

**If new passkey was set:**
- 2FA remains enabled (if it was enabled before)
- User must sign with new passkey + owner

**If passkey was removed (qx=0, qy=0):**
- User can sign with owner only (even if 2FA is still enabled)
- Reason: Line 259 in P256Account.sol: `if (qx == bytes32(0) || !twoFactorEnabled)`

**If owner was changed:**
- Old owner loses access
- New owner can sign transactions

---

## Scenario 4: Lost Everything (No Guardians)

### What You Lost
- ❌ Device with passkey
- ❌ Web3Auth access
- ❌ No guardians set up

### Recovery

💀 **Funds are lost forever**

**There is no way to recover without:**
- Web3Auth access (to get owner address), OR
- Guardians (to initiate recovery)

**Prevention:**
- ✅ Set up multiple guardians
- ✅ Keep Web3Auth access (don't lose social login)
- ✅ Back up recovery codes for Web3Auth

---

## Guardian Setup Best Practices

### Recommended Guardian Setup

**For personal accounts:**
- Add 3-5 trusted friends/family as guardians
- Set threshold = 2 or 3 (majority)
- Owner is automatically added as first guardian

**For business accounts:**
- Add multiple team members as guardians
- Set threshold = majority (e.g., 3 out of 5)
- Consider using hardware wallets as guardians

### Adding Guardians

```solidity
// Add guardian (only via EntryPoint)
account.addGuardian(guardianAddress)

// Set threshold
account.setGuardianThreshold(2) // Require 2 guardians to approve recovery
```

### Guardian Responsibilities

Guardians should:
- ✅ Verify recovery requests are legitimate (contact account owner)
- ✅ Respond quickly to recovery requests
- ✅ Keep their own accounts secure
- ❌ Never approve suspicious recovery requests

---

## Recovery Comparison Table

| Scenario | Can Recalculate Address? | Can Access Funds? | Recovery Method | Time Required |
|----------|-------------------------|-------------------|-----------------|---------------|
| **Lost device (2FA off)** | ✅ Yes | ✅ Yes | Login with Web3Auth | Immediate |
| **Lost device (2FA on)** | ✅ Yes | ❌ No | Guardian Recovery | 48+ hours |
| **Lost Web3Auth** | ❌ No | ❌ No | Guardian Recovery | 48+ hours |
| **Lost passkey (2FA on)** | ✅ Yes | ❌ No | Guardian Recovery | 48+ hours |
| **Lost everything (no guardians)** | ❌ No | ❌ No | 💀 **Impossible** | N/A |

---

## Technical Details

### Why 48-Hour Timelock?

The 48-hour timelock provides:
- ✅ Time for owner to notice and cancel malicious recovery
- ✅ Balance between security and usability
- ✅ Prevents immediate compromise if guardian is hacked

### Why Owner is Auto-Added as Guardian?

The owner is automatically added as the first guardian because:
- ✅ Owner can initiate recovery immediately (no timelock for owner)
- ✅ Simplifies initial setup
- ✅ Owner can add more guardians later

### Signature Validation Logic

```solidity
// Owner-only mode: no passkey OR passkey configured but 2FA disabled
if (qx == bytes32(0) || !twoFactorEnabled) {
    // Can sign with owner only
    return _recoverSigner(userOpHash, sig) == owner() ? 0 : 1;
}

// Passkey with 2FA: requires both passkey and owner signatures
// ... verify both signatures ...
```

**Key insight:** If `qx == 0` (no passkey), user can sign with owner only, even if `twoFactorEnabled == true`.

This means after guardian recovery that removes the passkey, the user can immediately sign transactions with owner only!

---

## Summary

### Prevention is Better Than Recovery

✅ **Set up guardians BEFORE you lose access**
✅ **Keep Web3Auth access secure**
✅ **Back up recovery codes**
✅ **Test recovery process with small amounts first**

### Recovery Priority

1. **Try Web3Auth login first** (fastest if you still have access)
2. **Use guardian recovery** (if Web3Auth lost or 2FA enabled)
3. **Contact guardians immediately** (don't wait!)

### Key Takeaways

- 🔑 **Address = owner + salt** (can recalculate if you have Web3Auth)
- 🔐 **2FA enabled = need guardian recovery** (cannot sign without passkey)
- 👥 **Guardians are critical** (set them up early!)
- ⏰ **48-hour timelock** (plan ahead, don't panic)
- 💀 **No guardians = no recovery** (funds lost forever)

