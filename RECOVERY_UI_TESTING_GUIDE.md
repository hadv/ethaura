# 🧪 Recovery UI - Testing Guide

## Prerequisites

1. **Account Setup**
   - Create a P256Account with Web3Auth
   - Have at least 2 guardian addresses available
   - Fund account with Sepolia ETH

2. **Guardian Setup**
   - Add guardians using Guardian Manager
   - Set threshold (e.g., 2 out of 3)
   - Verify guardians are set correctly

## Test Scenarios

### Test 1: Guardian Status Display

**Steps:**
1. Open Recovery Manager
2. Check guardian status card

**Expected Results:**
- ✅ Total guardians displayed correctly
- ✅ Threshold shown (e.g., "2 of 3")
- ✅ Your status shows "✅ Guardian" or "⚠️ Not a Guardian"

### Test 2: Propose Recovery (Passkey Update)

**Setup:**
- You must be a guardian
- Have new passkey coordinates ready

**Steps:**
1. Click "Propose Recovery"
2. Select "Update Passkey"
3. Enter new Passkey X coordinate
4. Enter new Passkey Y coordinate
5. Enter current owner address
6. Click "📝 Propose Recovery"

**Expected Results:**
- ✅ Status shows "Initiating recovery..."
- ✅ Transaction submitted to blockchain
- ✅ Status shows "✅ Recovery initiated successfully!"
- ✅ Recovery appears in pending list with nonce 0

### Test 3: Propose Recovery (Owner Update)

**Setup:**
- You must be a guardian
- Have new owner address ready

**Steps:**
1. Click "Propose Recovery"
2. Select "Update Owner"
3. Enter new owner address
4. Click "📝 Propose Recovery"

**Expected Results:**
- ✅ Status shows "Initiating recovery..."
- ✅ Transaction submitted
- ✅ Status shows "✅ Recovery initiated successfully!"
- ✅ Recovery appears in pending list

### Test 4: Approve Recovery

**Setup:**
- Another guardian must propose recovery first
- You must be a different guardian

**Steps:**
1. Open Recovery Manager
2. Find pending recovery in list
3. Click "✅ Approve"

**Expected Results:**
- ✅ Status shows "Approving recovery request..."
- ✅ Transaction submitted
- ✅ Status shows "✅ Recovery approved successfully!"
- ✅ Approval count increases in pending list

### Test 5: Multiple Approvals

**Setup:**
- Threshold is 2 of 3
- Recovery has 1 approval

**Steps:**
1. Have second guardian approve
2. Watch approval count update

**Expected Results:**
- ✅ Approval count shows "2/3 Approvals"
- ✅ "🚀 Execute" button appears (if timelock expired)
- ✅ "⏳ Timelock" badge shows if timelock active

### Test 6: Timelock Countdown

**Setup:**
- Recovery just proposed
- Threshold met

**Steps:**
1. Check pending recovery
2. Note timelock countdown
3. Wait a few minutes
4. Refresh page

**Expected Results:**
- ✅ Countdown shows "Xh Ym remaining"
- ✅ Countdown decreases over time
- ✅ After 24 hours: "Ready to execute"

### Test 7: Execute Recovery

**Setup:**
- Threshold met (2/3 approvals)
- 24-hour timelock expired

**Steps:**
1. Find ready recovery in list
2. Click "🚀 Execute"

**Expected Results:**
- ✅ Status shows "Executing recovery request..."
- ✅ Transaction submitted
- ✅ Status shows "✅ Recovery executed successfully!"
- ✅ Recovery disappears from pending list

### Test 8: Error Handling - Invalid Address

**Steps:**
1. Click "Propose Recovery"
2. Enter invalid owner address (not 0x format)
3. Click "📝 Propose Recovery"

**Expected Results:**
- ✅ Error message: "Please enter a valid owner address"
- ✅ Transaction not submitted

### Test 9: Error Handling - Missing Passkey

**Steps:**
1. Click "Propose Recovery"
2. Select "Update Passkey"
3. Leave passkey fields empty
4. Click "📝 Propose Recovery"

**Expected Results:**
- ✅ Error message: "Please enter new passkey coordinates"
- ✅ Transaction not submitted

### Test 10: Error Handling - Not Guardian

**Setup:**
- You are not a guardian

**Steps:**
1. Open Recovery Manager
2. Try to click "Propose Recovery"

**Expected Results:**
- ✅ Button disabled or error shown
- ✅ Error message: "Only guardians can initiate recovery"

### Test 11: Mobile Responsiveness

**Steps:**
1. Open Recovery Manager on mobile device
2. Check layout
3. Try to propose recovery
4. Check button sizes

**Expected Results:**
- ✅ Layout is single column
- ✅ Buttons are full-width and touch-friendly
- ✅ Text is readable
- ✅ Forms are easy to fill

### Test 12: Real-Time Updates

**Setup:**
- Have two browser windows open
- One as guardian 1, one as guardian 2

**Steps:**
1. Guardian 1 proposes recovery
2. Check Guardian 2's window
3. Guardian 2 approves
4. Check Guardian 1's window

**Expected Results:**
- ✅ Recovery appears in Guardian 2's list
- ✅ Approval count updates in Guardian 1's list
- ✅ Status messages appear correctly

## Performance Tests

### Test 13: Large Number of Recoveries

**Setup:**
- Create 10+ pending recoveries

**Steps:**
1. Open Recovery Manager
2. Check if list loads quickly
3. Scroll through list

**Expected Results:**
- ✅ List loads within 2 seconds
- ✅ Scrolling is smooth
- ✅ No UI freezing

### Test 14: Network Latency

**Setup:**
- Simulate slow network (DevTools)

**Steps:**
1. Propose recovery on slow network
2. Watch status messages

**Expected Results:**
- ✅ Status messages update
- ✅ Loading indicators show
- ✅ No timeout errors

## Edge Cases

### Test 15: Malicious Recovery Cancellation

**Setup:**
- Recovery proposed
- Owner still has passkey access

**Steps:**
1. Owner cancels recovery via passkey
2. Check recovery status

**Expected Results:**
- ✅ Recovery marked as cancelled
- ✅ Disappears from pending list
- ✅ Status message shows cancellation

### Test 16: Multiple Pending Recoveries

**Setup:**
- Create 3 different recovery requests

**Steps:**
1. View pending recoveries list
2. Approve different ones
3. Execute different ones

**Expected Results:**
- ✅ All recoveries shown correctly
- ✅ Can approve/execute independently
- ✅ Approval counts correct for each

## Checklist

- [ ] Guardian status displays correctly
- [ ] Can propose passkey recovery
- [ ] Can propose owner recovery
- [ ] Can approve recovery
- [ ] Approval count updates
- [ ] Timelock countdown works
- [ ] Can execute recovery
- [ ] Error messages appear
- [ ] Mobile layout works
- [ ] Real-time updates work
- [ ] Performance is good
- [ ] Edge cases handled

## Troubleshooting

### Recovery not appearing
- Refresh page
- Check account is deployed
- Verify you're a guardian

### Approve button disabled
- Check if already approved
- Check if threshold already met
- Check if timelock expired

### Execute button not showing
- Check if threshold met
- Check if 24 hours passed
- Refresh page

### Transaction fails
- Check gas balance
- Check network connection
- Check contract address

## Success Criteria

✅ All tests pass
✅ No console errors
✅ UI responsive on all devices
✅ Real-time updates work
✅ Error handling works
✅ Performance acceptable
✅ User experience smooth

## Next Steps

1. Run all tests
2. Document any issues
3. Fix bugs if found
4. Get user feedback
5. Deploy to production

