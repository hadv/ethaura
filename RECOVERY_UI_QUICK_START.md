# 🔐 Recovery UI - Quick Start Guide

## What is the Recovery Manager?

The Recovery Manager is a UI component that allows guardians to propose, approve, and execute wallet recovery transactions. It's used when users lose access to their passkeys or Web3Auth accounts.

## Key Concepts

### Guardians
- Trusted addresses that can help recover your account
- Owner is automatically the first guardian
- Can add more guardians for better security

### Recovery Request
- A proposal to change the passkey or owner
- Requires multiple guardian approvals (based on threshold)
- Has a 24-hour timelock before execution

### Threshold
- Number of guardian approvals needed
- Example: 2 out of 3 guardians must approve

## How to Use

### 1. Check Guardian Status
When you open the Recovery Manager, you'll see:
- Total number of guardians
- Approval threshold (e.g., "2 of 3")
- Whether you're a guardian

### 2. Propose Recovery (If You're a Guardian)

**Step 1:** Click "Propose Recovery"

**Step 2:** Choose recovery type:
- **Update Passkey**: Set new passkey coordinates (qx, qy)
- **Update Owner**: Change account owner address

**Step 3:** Enter the new values:
- For passkey: Enter new X and Y coordinates
- For owner: Enter new owner address

**Step 4:** Click "📝 Propose Recovery"

**Result:** Recovery request created with a nonce (ID)

### 3. Approve Recovery (If You're a Guardian)

**Step 1:** Look at "Pending Recovery Requests"

**Step 2:** Find the recovery you want to approve

**Step 3:** Click "✅ Approve"

**Result:** Your approval is recorded, approval count increases

### 4. Wait for Timelock

The recovery has a 24-hour timelock. During this time:
- ⏳ Countdown shows time remaining
- ⚠️ Owner can cancel if malicious
- 🔒 Prevents immediate compromise

### 5. Execute Recovery

**When ready:**
- Approval count ≥ threshold
- 24 hours have passed

**Step 1:** Click "🚀 Execute"

**Result:** Recovery executed, account updated!

## Recovery Scenarios

### Scenario 1: Lost Passkey
```
1. Guardian proposes recovery with new passkey
2. Other guardians approve
3. Wait 24 hours
4. Execute recovery
5. ✅ New passkey active!
```

### Scenario 2: Lost Web3Auth
```
1. Guardian proposes recovery with new owner
2. Other guardians approve
3. Wait 24 hours
4. Execute recovery
5. ✅ New owner can access account!
```

### Scenario 3: Malicious Recovery
```
1. Owner sees malicious recovery proposal
2. Owner cancels recovery (via passkey)
3. ❌ Recovery cancelled!
```

## Status Indicators

### Badges
- 🟢 **✅ Guardian** - You are a guardian
- 🟡 **⚠️ Not a Guardian** - You cannot propose/approve
- 🔵 **2/3 Approvals** - Current approval count
- 🟠 **⏳ Timelock Active** - Waiting for 24 hours

### Buttons
- **📝 Propose Recovery** - Create new recovery request
- **✅ Approve** - Approve pending recovery
- **🚀 Execute** - Execute ready recovery

## Important Notes

⚠️ **Security Reminders:**
1. Only guardians can propose recovery
2. Multiple guardians must approve
3. 24-hour timelock prevents immediate compromise
4. Owner can cancel malicious recoveries
5. Anyone can execute when ready

✅ **Best Practices:**
1. Set up guardians before you need them
2. Choose trusted guardians
3. Set appropriate threshold (e.g., 2 of 3)
4. Monitor pending recovery requests
5. Cancel malicious recoveries immediately

## Troubleshooting

### "Only guardians can initiate recovery"
- You are not a guardian for this account
- Ask the owner to add you as a guardian

### "Please enter a valid owner address"
- The address format is incorrect
- Use full 0x... format

### "Recovery not found"
- The recovery request nonce is invalid
- Check the pending recoveries list

### "Timelock not expired"
- 24 hours haven't passed yet
- Wait for the countdown to reach zero

### "Insufficient approvals"
- Not enough guardians have approved
- Wait for more guardians to approve

## Advanced Features

### Batch Operations
- Approve multiple recoveries
- Execute multiple recoveries

### Recovery History
- View past recovery requests
- See who approved/executed

### Notifications
- Get alerts for new recovery proposals
- Receive reminders before timelock expires

## Integration with Other Features

### Guardian Manager
- Add/remove guardians
- Set threshold
- View guardian list

### Account Manager
- Create account
- View account info
- Fund account

### Transaction Sender
- Send transactions
- Use 2FA
- View transaction history

## FAQ

**Q: Can I cancel a recovery I proposed?**
A: No, only the owner can cancel via passkey signature.

**Q: What if all guardians are compromised?**
A: Owner can cancel recovery if they still have passkey access.

**Q: Can I change guardians after recovery?**
A: Yes, the new owner can manage guardians.

**Q: What if timelock expires and no one executes?**
A: Recovery request remains pending until executed or cancelled.

**Q: Can I propose multiple recoveries?**
A: Yes, but only one can be executed at a time.

## Next Steps

1. ✅ Set up guardians (use Guardian Manager)
2. ✅ Set appropriate threshold
3. ✅ Test recovery flow with test guardians
4. ✅ Monitor pending recoveries regularly
5. ✅ Keep guardian contact info updated

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review the full documentation
3. Check contract events on block explorer
4. Contact support team

