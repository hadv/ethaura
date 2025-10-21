# Frontend Integration Guide - Tracking Pending Actions

## 🎯 Problem

**Question:** How does the frontend know which action hashes are pending?

**Answer:** There are 3 approaches, each with different trade-offs.

## 📊 Approach Comparison

| Approach | Pros | Cons | Best For |
|----------|------|------|----------|
| **Event Listening** | Real-time updates, low gas | Requires always-on service | Web apps with backend |
| **Query Past Events** | Simple, no backend needed | Slower, RPC dependent | Simple dApps |
| **On-chain Getter** | Always available, no events | Higher gas cost | Mobile apps, offline-first |

## 🔥 Approach 1: Event Listening (Recommended for Web Apps)

### Setup Event Listeners

```javascript
import { ethers } from 'ethers';

class PendingActionTracker {
    constructor(account, provider) {
        this.account = account;
        this.provider = provider;
        this.pendingActions = new Map();
        this.setupListeners();
    }

    setupListeners() {
        // Listen for new proposals
        this.account.on('PublicKeyUpdateProposed', (actionHash, qx, qy, executeAfter) => {
            console.log('🔔 New proposal detected!');
            
            this.pendingActions.set(actionHash, {
                actionHash,
                qx,
                qy,
                executeAfter: executeAfter.toNumber(),
                status: 'pending',
                createdAt: Date.now()
            });

            // Save to localStorage
            this.savePendingActions();
            
            // Notify user
            this.notifyUser({
                title: '⚠️ Security Alert',
                message: 'Someone proposed to change your passkey',
                actionHash,
                executeAfter: new Date(executeAfter.toNumber() * 1000)
            });
        });

        // Listen for executions
        this.account.on('PublicKeyUpdateExecuted', (actionHash, qx, qy) => {
            console.log('✅ Action executed:', actionHash);
            
            const action = this.pendingActions.get(actionHash);
            if (action) {
                action.status = 'executed';
                this.savePendingActions();
            }
        });

        // Listen for cancellations
        this.account.on('PublicKeyUpdateCancelled', (actionHash) => {
            console.log('❌ Action cancelled:', actionHash);
            
            const action = this.pendingActions.get(actionHash);
            if (action) {
                action.status = 'cancelled';
                this.savePendingActions();
            }
        });
    }

    savePendingActions() {
        const data = Array.from(this.pendingActions.values());
        localStorage.setItem('pendingActions', JSON.stringify(data));
    }

    loadPendingActions() {
        const data = localStorage.getItem('pendingActions');
        if (data) {
            const actions = JSON.parse(data);
            actions.forEach(action => {
                this.pendingActions.set(action.actionHash, action);
            });
        }
    }

    getActivePendingActions() {
        return Array.from(this.pendingActions.values())
            .filter(action => action.status === 'pending');
    }

    notifyUser(notification) {
        // Send push notification, email, SMS, etc.
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.title, {
                body: notification.message,
                icon: '/icon.png',
                tag: notification.actionHash
            });
        }
    }
}

// Usage
const tracker = new PendingActionTracker(account, provider);
tracker.loadPendingActions();

// Get active pending actions
const pending = tracker.getActivePendingActions();
console.log('Active pending actions:', pending);
```

## 🔍 Approach 2: Query Past Events (Simple dApps)

### Fetch Historical Events

```javascript
async function getPendingActionsFromEvents(account) {
    // Get all PublicKeyUpdateProposed events
    const proposedFilter = account.filters.PublicKeyUpdateProposed();
    const proposedEvents = await account.queryFilter(proposedFilter);

    // Get all executed events
    const executedFilter = account.filters.PublicKeyUpdateExecuted();
    const executedEvents = await account.queryFilter(executedFilter);

    // Get all cancelled events
    const cancelledFilter = account.filters.PublicKeyUpdateCancelled();
    const cancelledEvents = await account.queryFilter(cancelledFilter);

    // Build sets of executed and cancelled hashes
    const executedHashes = new Set(
        executedEvents.map(e => e.args.actionHash)
    );
    const cancelledHashes = new Set(
        cancelledEvents.map(e => e.args.actionHash)
    );

    // Filter to get only active pending actions
    const pendingActions = proposedEvents
        .filter(e => {
            const hash = e.args.actionHash;
            return !executedHashes.has(hash) && !cancelledHashes.has(hash);
        })
        .map(e => ({
            actionHash: e.args.actionHash,
            qx: e.args.qx,
            qy: e.args.qy,
            executeAfter: e.args.executeAfter.toNumber(),
            blockNumber: e.blockNumber,
            transactionHash: e.transactionHash
        }));

    return pendingActions;
}

// Usage
const pendingActions = await getPendingActionsFromEvents(account);
console.log('Pending actions:', pendingActions);

// Display in UI
pendingActions.forEach(action => {
    const timeRemaining = action.executeAfter - Math.floor(Date.now() / 1000);
    console.log(`Action ${action.actionHash}:`);
    console.log(`  Can execute in: ${timeRemaining / 3600} hours`);
    console.log(`  New Qx: ${action.qx}`);
    console.log(`  New Qy: ${action.qy}`);
});
```

## 📦 Approach 3: On-chain Getter (Best for Mobile/Offline)

### Use Built-in Getter Functions

```javascript
async function getActivePendingActions(account) {
    // Call the on-chain getter function
    const [actionHashes, qxValues, qyValues, executeAfters] = 
        await account.getActivePendingActions();

    // Transform to objects
    const pendingActions = actionHashes.map((hash, i) => ({
        actionHash: hash,
        qx: qxValues[i],
        qy: qyValues[i],
        executeAfter: executeAfters[i].toNumber(),
        canExecute: executeAfters[i].toNumber() <= Math.floor(Date.now() / 1000)
    }));

    return pendingActions;
}

// Usage
const pendingActions = await getActivePendingActions(account);
console.log('Active pending actions:', pendingActions);

// Check if any can be executed now
const executable = pendingActions.filter(a => a.canExecute);
if (executable.length > 0) {
    console.log('⏰ These actions can be executed now:', executable);
}
```

### Get Individual Action Details

```javascript
async function getActionDetails(account, actionHash) {
    const [qx, qy, executeAfter, executed, cancelled] = 
        await account.getPendingPublicKeyUpdate(actionHash);

    return {
        actionHash,
        qx,
        qy,
        executeAfter: executeAfter.toNumber(),
        executed,
        cancelled,
        status: executed ? 'executed' : (cancelled ? 'cancelled' : 'pending'),
        canExecute: executeAfter.toNumber() <= Math.floor(Date.now() / 1000)
    };
}

// Usage
const details = await getActionDetails(account, actionHash);
console.log('Action details:', details);
```

## 🎨 Complete React Example

```jsx
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

function PendingActionsPanel({ account }) {
    const [pendingActions, setPendingActions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPendingActions();
        setupEventListeners();
    }, [account]);

    async function loadPendingActions() {
        try {
            const [hashes, qxs, qys, times] = await account.getActivePendingActions();
            
            const actions = hashes.map((hash, i) => ({
                actionHash: hash,
                qx: qxs[i],
                qy: qys[i],
                executeAfter: times[i].toNumber(),
                canExecute: times[i].toNumber() <= Math.floor(Date.now() / 1000)
            }));

            setPendingActions(actions);
        } catch (error) {
            console.error('Failed to load pending actions:', error);
        } finally {
            setLoading(false);
        }
    }

    function setupEventListeners() {
        account.on('PublicKeyUpdateProposed', () => {
            loadPendingActions(); // Refresh list
        });

        account.on('PublicKeyUpdateExecuted', () => {
            loadPendingActions(); // Refresh list
        });

        account.on('PublicKeyUpdateCancelled', () => {
            loadPendingActions(); // Refresh list
        });
    }

    async function cancelAction(actionHash) {
        try {
            const tx = await account.cancelPendingAction(actionHash);
            await tx.wait();
            alert('Action cancelled successfully!');
        } catch (error) {
            alert('Failed to cancel action: ' + error.message);
        }
    }

    if (loading) return <div>Loading...</div>;

    return (
        <div className="pending-actions-panel">
            <h2>⚠️ Pending Actions ({pendingActions.length})</h2>
            
            {pendingActions.length === 0 ? (
                <p>No pending actions</p>
            ) : (
                <ul>
                    {pendingActions.map(action => (
                        <li key={action.actionHash}>
                            <div>
                                <strong>Action Hash:</strong> {action.actionHash.slice(0, 10)}...
                            </div>
                            <div>
                                <strong>New Qx:</strong> {action.qx.slice(0, 10)}...
                            </div>
                            <div>
                                <strong>Execute After:</strong>{' '}
                                {new Date(action.executeAfter * 1000).toLocaleString()}
                            </div>
                            <div>
                                <strong>Status:</strong>{' '}
                                {action.canExecute ? '✅ Can execute now' : '⏳ Waiting...'}
                            </div>
                            <button onClick={() => cancelAction(action.actionHash)}>
                                ❌ Cancel
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default PendingActionsPanel;
```

## 🔔 Notification System

```javascript
class NotificationService {
    async checkPendingActions(account) {
        const [hashes, qxs, qys, times] = await account.getActivePendingActions();
        
        for (let i = 0; i < hashes.length; i++) {
            const executeAfter = times[i].toNumber();
            const timeRemaining = executeAfter - Math.floor(Date.now() / 1000);
            
            // Alert if action can be executed soon
            if (timeRemaining > 0 && timeRemaining < 3600) { // Less than 1 hour
                this.sendAlert({
                    title: '⚠️ URGENT: Action Executing Soon',
                    message: `A passkey update will execute in ${Math.floor(timeRemaining / 60)} minutes!`,
                    actionHash: hashes[i],
                    severity: 'high'
                });
            }
        }
    }

    sendAlert(alert) {
        // Send via multiple channels
        this.sendPushNotification(alert);
        this.sendEmail(alert);
        this.sendSMS(alert);
    }
}
```

## 📝 Summary

### Choose Your Approach:

1. **Event Listening** - Best for web apps with backend
   - ✅ Real-time updates
   - ✅ Low gas cost
   - ❌ Requires always-on service

2. **Query Past Events** - Best for simple dApps
   - ✅ Simple implementation
   - ✅ No backend needed
   - ❌ Slower, RPC dependent

3. **On-chain Getter** - Best for mobile/offline apps
   - ✅ Always available
   - ✅ No event dependency
   - ❌ Slightly higher gas cost

**Recommendation:** Use **Approach 3 (On-chain Getter)** for initial load, then **Approach 1 (Event Listening)** for real-time updates. This gives you the best of both worlds!

