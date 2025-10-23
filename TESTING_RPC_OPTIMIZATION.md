# 🧪 Testing RPC Optimization

## ✅ Quick Test Checklist

### Test 1: First Transaction
- [ ] Open app at http://localhost:3000/
- [ ] Create passkey
- [ ] Login with Web3Auth
- [ ] Fund account with 0.1 ETH
- [ ] Send 0.001 ETH transaction
- [ ] Check console (F12) for:
  - ✅ No "503 Service Unavailable" errors
  - ✅ Batched RPC calls (3 calls in parallel)
  - ✅ Transaction succeeds

### Test 2: Second Transaction (within 30s)
- [ ] Send another 0.001 ETH transaction
- [ ] Check console for:
  - ✅ "Using cached account info" message
  - ✅ Fewer RPC calls
  - ✅ Transaction succeeds

### Test 3: Multiple Rapid Transactions
- [ ] Send 5 transactions in quick succession
- [ ] Check:
  - ✅ No rate limit errors
  - ✅ All transactions succeed
  - ✅ Console shows cache hits

### Test 4: Cache Expiry (after 30s)
- [ ] Wait 30+ seconds
- [ ] Send another transaction
- [ ] Check console for:
  - ✅ Fresh RPC calls (cache expired)
  - ✅ New account info fetched
  - ✅ Transaction succeeds

---

## 🔍 Console Output to Look For

### Batched RPC Calls
```
📝 Account code check: {
  accountAddress: "0x5B390C8DD95781be9F8f8B9aBC469e90e6d7DFBE",
  codeLength: 2000,
  hasCode: true,
  isDeployedFlag: false
}
```

### Cache Hit
```
📦 Using cached deployed status for 0x5B390C8DD95781be9F8f8B9aBC469e90e6d7DFBE
📦 Using cached account info for 0x5B390C8DD95781be9F8f8B9aBC469e90e6d7DFBE
```

### Successful Transaction
```
✅ Transaction confirmed! Account deployed + Transaction executed
```

---

## ⚠️ What NOT to See

❌ `503 Service Unavailable`  
❌ `Internal server error. Forwarder error: 1000`  
❌ `JsonRpcProvider failed to detect network`  
❌ Multiple sequential RPC calls  

---

## 📊 Performance Metrics

### Before Optimization
- Component mount: 5 RPC calls
- Send transaction: 6+ RPC calls
- Total: 11+ RPC calls per transaction

### After Optimization
- Component mount: 3 RPC calls (cached)
- Send transaction: 4 RPC calls (batched)
- Total: 7 RPC calls per transaction
- **Reduction: ~36%**

---

## 🚀 Expected Behavior

1. **First load**: Normal RPC calls
2. **Subsequent actions (within 30s)**: Cached data used
3. **After 30s**: Fresh RPC calls
4. **After transaction**: Cache cleared, fresh data fetched
5. **Multiple transactions**: Smooth, no rate limiting

---

## 🐛 Troubleshooting

### Still seeing rate limit errors?
1. Check if Alchemy is actually down (check status page)
2. Try switching to a different RPC provider
3. Clear browser cache and reload
4. Check if cache is working (look for "Using cached" messages)

### Cache not working?
1. Check browser console for errors
2. Verify cache expiry is 30 seconds
3. Check if `clearCache()` is being called after transactions

### Transactions still slow?
1. Check network tab for RPC call timing
2. Verify calls are batched (should see 1 call instead of 3)
3. Check if bundler is responding quickly

---

## 📝 Notes

- Cache expires after 30 seconds
- Cache is cleared after successful transactions
- Batching reduces 3 calls to 1 parallel call
- This should reduce rate limit hits by ~40-50%

**Status:** Ready for testing! 🚀

