# Security Flow Diagrams - EthAura P256Account

## 🔄 Normal Transaction Flow

```
┌─────────────┐
│    User     │
└──────┬──────┘
       │ 1. Initiate transaction
       │    (Touch ID / Face ID)
       ▼
┌─────────────────┐
│   WebAuthn      │
│   (Passkey)     │
└──────┬──────────┘
       │ 2. Sign with P-256
       │    (Hardware-backed)
       ▼
┌─────────────────┐
│  UserOperation  │
│   + Signature   │
└──────┬──────────┘
       │ 3. Submit to EntryPoint
       ▼
┌─────────────────┐
│   EntryPoint    │
│   (ERC-4337)    │
└──────┬──────────┘
       │ 4. Validate signature
       │    (P-256 precompile)
       ▼
┌─────────────────┐
│  P256Account    │
│   execute()     │
└──────┬──────────┘
       │ 5. Execute transaction
       ▼
┌─────────────────┐
│  Target Contract│
└─────────────────┘

✅ Owner CANNOT bypass this flow
✅ Passkey signature ALWAYS required
```

## 🚨 Attack Scenario 1: Web3Auth Compromised

```
┌─────────────┐
│  Attacker   │ Gains access to
│             │ user's Google account
└──────┬──────┘
       │ 1. Login to Web3Auth
       │    with stolen credentials
       ▼
┌─────────────────┐
│   Web3Auth      │
│   (Owner Key)   │
└──────┬──────────┘
       │ 2. Try to execute transaction
       │
       ▼
┌─────────────────┐
│  P256Account    │
│   execute()     │
└──────┬──────────┘
       │ ❌ REJECTED!
       │ "OnlyEntryPoint"
       │
       │ 3. Try to propose passkey update
       ▼
┌─────────────────┐
│ proposePublic   │
│ KeyUpdate()     │
└──────┬──────────┘
       │ ✅ Allowed (owner can propose)
       │ ⏰ 48-hour timelock starts
       │
       ▼
┌─────────────────┐
│  Notification   │ 📧 Email/SMS/Push
│   to User       │ "Someone proposed to
└──────┬──────────┘  change your passkey!"
       │
       │ 4. User responds
       ▼
┌─────────────────┐
│     User        │ Uses passkey to
│  (Real Owner)   │ cancel proposal
└──────┬──────────┘
       │ 5. Cancel with passkey signature
       ▼
┌─────────────────┐
│ cancelPending   │
│   Action()      │
└──────┬──────────┘
       │ ✅ Cancelled!
       │ Funds safe!
       ▼
┌─────────────────┐
│  Attack Failed  │
└─────────────────┘

🛡️ Protection: 48-hour timelock + user can cancel
✅ Funds remain safe
```

## 🔑 Recovery Scenario 1: Passkey Lost (Owner-Initiated)

```
┌─────────────┐
│    User     │ Lost phone with
│             │ passkey
└──────┬──────┘
       │ 1. Login to Web3Auth
       │    from new device
       ▼
┌─────────────────┐
│   Web3Auth      │
│   (Owner Key)   │
└──────┬──────────┘
       │ 2. Generate new passkey
       │    on new device
       ▼
┌─────────────────┐
│  New Passkey    │
│  (Qx, Qy)       │
└──────┬──────────┘
       │ 3. Propose update
       ▼
┌─────────────────┐
│ proposePublic   │
│ KeyUpdate()     │
└──────┬──────────┘
       │ ⏰ 48-hour timelock
       │
       │ 4. Wait 48 hours...
       │
       ▼
┌─────────────────┐
│ executePublic   │
│ KeyUpdate()     │
└──────┬──────────┘
       │ ✅ Passkey updated!
       ▼
┌─────────────────┐
│  Access Restored│
└─────────────────┘

⏰ Recovery time: 48 hours
✅ No guardians needed
```

## 🛡️ Recovery Scenario 2: Guardian-Based Recovery

```
┌─────────────┐
│    User     │ Lost BOTH passkey
│             │ AND Web3Auth access
└──────┬──────┘
       │ 1. Contact guardians
       │    (phone/email)
       ▼
┌─────────────────┐
│  Guardian 1     │
│  (Friend)       │
└──────┬──────────┘
       │ 2. Initiate recovery
       │    with user's new passkey
       ▼
┌─────────────────┐
│ initiateRecovery│
│ (newQx, newQy)  │
└──────┬──────────┘
       │ ⏰ 24-hour timelock
       │
       ▼
┌─────────────────┐
│  Guardian 2     │
│  (Family)       │
└──────┬──────────┘
       │ 3. Approve recovery
       ▼
┌─────────────────┐
│ approveRecovery │
│ (nonce: 0)      │
└──────┬──────────┘
       │ Approval count: 2/3
       │ ✅ Threshold met!
       │
       │ 4. Wait 24 hours...
       │
       ▼
┌─────────────────┐
│ executeRecovery │
│ (nonce: 0)      │
└──────┬──────────┘
       │ ✅ Passkey + Owner updated!
       ▼
┌─────────────────┐
│  Access Restored│
└─────────────────┘

⏰ Recovery time: 24 hours (after threshold met)
✅ Decentralized, no single point of failure
```

## 🔐 Security Layers Visualization

```
┌─────────────────────────────────────────────────────────┐
│                    Layer 4: Guardians                   │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Multi-sig recovery (2/3 threshold)                │  │
│  │ 24-hour timelock                                  │  │
│  │ User can cancel with passkey                      │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │ If both passkey + owner lost
                          │
┌─────────────────────────────────────────────────────────┐
│              Layer 3: Timelock Protection               │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 48-hour delay for passkey updates                │  │
│  │ User can cancel malicious proposals               │  │
│  │ Prevents instant takeover                         │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │ If owner key compromised
                          │
┌─────────────────────────────────────────────────────────┐
│          Layer 2: Optional Two-Factor Auth              │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Passkey + Owner signature required                │  │
│  │ For high-value transactions                       │  │
│  │ Extra protection layer                            │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │ Optional enhancement
                          │
┌─────────────────────────────────────────────────────────┐
│            Layer 1: Passkey-First Security              │
│  ┌───────────────────────────────────────────────────┐  │
│  │ ALL transactions require passkey signature        │  │
│  │ Hardware-backed (Secure Enclave, TPM)             │  │
│  │ Biometric authentication (Touch ID, Face ID)      │  │
│  │ Owner CANNOT bypass                               │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## 📊 Decision Tree: What Happens When...

```
User wants to send transaction
│
├─ Has passkey? ──YES──> ✅ Sign with passkey → Execute
│                         (Normal flow)
│
└─ NO ──> Lost passkey
          │
          ├─ Has Web3Auth access? ──YES──> Propose new passkey
          │                                 ⏰ Wait 48 hours
          │                                 ✅ Execute update
          │                                 (Owner-initiated recovery)
          │
          └─ NO ──> Lost both
                    │
                    ├─ Has guardians? ──YES──> Contact guardians
                    │                           Guardian initiates recovery
                    │                           Other guardians approve
                    │                           ⏰ Wait 24 hours
                    │                           ✅ Execute recovery
                    │                           (Guardian recovery)
                    │
                    └─ NO ──> ❌ Funds lost
                              (This is why guardians are critical!)
```

## 🎯 Frontend Integration Flow

```
┌─────────────────────────────────────────────────────────┐
│                    User Opens App                       │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│         Load Pending Actions (3 approaches)             │
│  ┌───────────────────────────────────────────────────┐  │
│  │ 1. On-chain Getter (Initial Load)                │  │
│  │    const [hashes, qxs, qys, times] =              │  │
│  │      await account.getActivePendingActions()      │  │
│  │                                                   │  │
│  │ 2. Event Listening (Real-time Updates)           │  │
│  │    account.on('PublicKeyUpdateProposed', ...)     │  │
│  │                                                   │  │
│  │ 3. Query Past Events (Historical)                │  │
│  │    const events = await account.queryFilter(...)  │  │
│  └───────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Display Pending Actions                    │
│  ┌───────────────────────────────────────────────────┐  │
│  │ ⚠️ Pending Actions (2)                            │  │
│  │                                                   │  │
│  │ 1. Passkey Update                                │  │
│  │    Execute after: 2024-01-15 10:30 AM            │  │
│  │    [Cancel] [View Details]                       │  │
│  │                                                   │  │
│  │ 2. Passkey Update                                │  │
│  │    Execute after: 2024-01-16 02:15 PM            │  │
│  │    [Cancel] [View Details]                       │  │
│  └───────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              User Takes Action                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │ If malicious:                                     │  │
│  │   → Click [Cancel]                                │  │
│  │   → Sign with passkey                             │  │
│  │   → Action cancelled ✅                           │  │
│  │                                                   │  │
│  │ If legitimate:                                    │  │
│  │   → Wait for timelock                             │  │
│  │   → Anyone can execute                            │  │
│  │   → Passkey updated ✅                            │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## 🔄 Array Cleanup Flow

```
┌─────────────────────────────────────────────────────────┐
│         pendingActionHashes Array Management            │
└─────────────────────────────────────────────────────────┘

Initial State:
┌───────────────────────────────────────────────────────┐
│ pendingActionHashes = [hash1, hash2, hash3]           │
│ Length: 3                                             │
└───────────────────────────────────────────────────────┘

After executing hash1:
┌───────────────────────────────────────────────────────┐
│ 1. Mark as executed in mapping                        │
│ 2. Call _removePendingActionHash(hash1)               │
│    - Find hash1 at index 0                            │
│    - Swap with last element (hash3)                   │
│    - Pop last element                                 │
│                                                       │
│ pendingActionHashes = [hash3, hash2]                  │
│ Length: 2                                             │
└───────────────────────────────────────────────────────┘

After cancelling hash2:
┌───────────────────────────────────────────────────────┐
│ 1. Mark as cancelled in mapping                       │
│ 2. Call _removePendingActionHash(hash2)               │
│    - Find hash2 at index 1                            │
│    - Swap with last element (hash2 itself)            │
│    - Pop last element                                 │
│                                                       │
│ pendingActionHashes = [hash3]                         │
│ Length: 1                                             │
└───────────────────────────────────────────────────────┘

✅ Array stays clean and bounded
✅ No gas issues from unbounded growth
✅ getActivePendingActions() returns only active items
```

## 📈 Summary

### Security Flows
- ✅ **Normal transactions** - Passkey signature always required
- ✅ **Web3Auth compromised** - 48h timelock + user can cancel
- ✅ **Passkey lost** - Owner-initiated recovery (48h)
- ✅ **Both lost** - Guardian recovery (24h after threshold)

### Frontend Integration
- ✅ **3 approaches** - On-chain getter, events, query history
- ✅ **Real-time updates** - Event listening
- ✅ **User notifications** - Alert on malicious proposals

### Array Management
- ✅ **Auto cleanup** - Removed when executed/cancelled
- ✅ **Bounded growth** - No gas issues
- ✅ **Efficient enumeration** - Only active items returned

**All flows tested and working! 🎉**

