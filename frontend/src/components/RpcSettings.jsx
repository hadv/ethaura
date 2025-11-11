import { useState, useMemo } from 'react'
import { ethers } from 'ethers'
import { useNetwork } from '../contexts/NetworkContext'
import { useNetworkHealth } from '../hooks/useNetworkHealth'

function RpcSettings() {
  const { networkInfo, setCustomRpc, clearCustomRpc, getEffectiveRpcUrl } = useNetwork()
  const [rpcUrl, setRpcUrl] = useState(getEffectiveRpcUrl(networkInfo.chainId) || networkInfo.rpcUrl)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const health = useNetworkHealth()

  const isCustom = useMemo(() => rpcUrl !== networkInfo.rpcUrl, [rpcUrl, networkInfo.rpcUrl])

  const validateRpcUrl = (url) => {
    try {
      const u = new URL(url)
      return (u.protocol === 'http:' || u.protocol === 'https:')
    } catch {
      return false
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    setError('')
    try {
      if (!validateRpcUrl(rpcUrl)) {
        throw new Error('Please enter a valid HTTP(S) URL')
      }
      const provider = new ethers.JsonRpcProvider(rpcUrl)
      const start = Date.now()
      const block = await provider.getBlockNumber()
      const latency = Date.now() - start
      setTestResult({ ok: true, block, latency })
    } catch (e) {
      setTestResult({ ok: false })
      setError(e.message)
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      if (!validateRpcUrl(rpcUrl)) {
        throw new Error('Please enter a valid HTTP(S) URL')
      }
      // Quick health check before saving
      const provider = new ethers.JsonRpcProvider(rpcUrl)
      await provider.getBlockNumber()
      setCustomRpc(rpcUrl)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    clearCustomRpc()
    setRpcUrl(networkInfo.rpcUrl)
    setTestResult(null)
    setError('')
  }

  return (
    <div className="settings-section">
      <h3 style={{ marginBottom: 8 }}>RPC Endpoint</h3>
      <p className="section-description" style={{ marginTop: 0 }}>
        Configure a custom Ethereum RPC endpoint for the {networkInfo.name} network. This overrides the default RPC from settings or environment.
      </p>

      <div className="form-group">
        <label>Current RPC URL</label>
        <input
          type="text"
          value={rpcUrl}
          onChange={(e) => setRpcUrl(e.target.value)}
          placeholder="https://..."
          spellCheck={false}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <button className="btn btn-secondary" onClick={handleTest} disabled={testing}>
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Apply'}
        </button>
        <button className="btn" onClick={handleReset}>
          Reset to Default
        </button>
      </div>

      {testResult && testResult.ok && (
        <div className="status-message success">
          ✅ RPC reachable. Latest block: {testResult.block}. Latency: {testResult.latency} ms
        </div>
      )}
      {error && (
        <div className="status-message error">{error}</div>
      )}

      <div className="info-box" style={{ marginTop: 16 }}>
        <strong>Network Health:</strong>
        <div style={{ marginTop: 6, fontSize: 14 }}>
          Status: {health.isHealthy ? 'Healthy' : 'Unreachable'}
          {health.blockNumber !== null && <> • Block: {health.blockNumber}</>}
        </div>
      </div>
    </div>
  )
}

export default RpcSettings

