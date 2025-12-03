/**
 * ModuleManager - Component for managing ERC-7579 modules
 */

import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { useNetwork } from '../contexts/NetworkContext'
import { useModularAccountManager } from '../hooks/useModularAccount'
import { MODULE_TYPE } from '../lib/constants'
import { Layers, Check, X, AlertCircle, Loader2, Settings, Zap, Shield } from 'lucide-react'
import '../styles/ModuleManager.css'

function ModuleManager({ accountAddress, isModular = false }) {
  const { networkInfo } = useNetwork()
  const manager = useModularAccountManager()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modules, setModules] = useState({
    validator: null,
    executors: [],
    hooks: [],
    fallbacks: [],
  })
  const [accountInfo, setAccountInfo] = useState(null)

  // Load installed modules
  const loadModules = useCallback(async () => {
    if (!manager || !accountAddress || !isModular) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Get account info
      const info = await manager.getAccountInfo(accountAddress)
      setAccountInfo(info)

      // Get installed validator
      const validator = await manager.getInstalledValidator(accountAddress)

      // Get global hook
      const globalHook = await manager.getGlobalHook(accountAddress)

      // Check if session key module is installed
      let sessionKeyInstalled = false
      if (networkInfo.sessionKeyModuleAddress) {
        sessionKeyInstalled = await manager.isModuleInstalled(
          accountAddress,
          MODULE_TYPE.EXECUTOR,
          networkInfo.sessionKeyModuleAddress
        )
      }

      setModules({
        validator: validator && validator !== ethers.ZeroAddress ? {
          address: validator,
          name: validator === networkInfo.validatorModuleAddress ? 'P256MFAValidator' : 'Unknown Validator',
          type: MODULE_TYPE.VALIDATOR,
        } : null,
        executors: sessionKeyInstalled ? [{
          address: networkInfo.sessionKeyModuleAddress,
          name: 'SessionKeyExecutor',
          type: MODULE_TYPE.EXECUTOR,
        }] : [],
        hooks: globalHook && globalHook !== ethers.ZeroAddress ? [{
          address: globalHook,
          name: 'Global Hook',
          type: MODULE_TYPE.HOOK,
        }] : [],
        fallbacks: [],
      })
    } catch (err) {
      console.error('Failed to load modules:', err)
      setError('Failed to load module information')
    } finally {
      setLoading(false)
    }
  }, [manager, accountAddress, isModular, networkInfo])

  useEffect(() => {
    loadModules()
  }, [loadModules])

  // If not a modular account, show info message
  if (!isModular) {
    return (
      <div className="module-manager">
        <div className="module-header">
          <Layers className="header-icon" size={24} />
          <h2>Module Management</h2>
        </div>
        <div className="module-info-message">
          <AlertCircle size={20} />
          <p>This is a legacy P256Account. Module management is only available for ERC-7579 modular accounts.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="module-manager">
        <div className="module-header">
          <Layers className="header-icon" size={24} />
          <h2>Module Management</h2>
        </div>
        <div className="module-loading">
          <Loader2 className="spinner" size={24} />
          <p>Loading modules...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="module-manager">
        <div className="module-header">
          <Layers className="header-icon" size={24} />
          <h2>Module Management</h2>
        </div>
        <div className="module-error">
          <AlertCircle size={20} />
          <p>{error}</p>
          <button onClick={loadModules}>Retry</button>
        </div>
      </div>
    )
  }

  const formatAddress = (addr) => {
    if (!addr) return 'None'
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const getModuleIcon = (type) => {
    switch (type) {
      case MODULE_TYPE.VALIDATOR: return <Shield size={18} />
      case MODULE_TYPE.EXECUTOR: return <Zap size={18} />
      case MODULE_TYPE.HOOK: return <Settings size={18} />
      default: return <Layers size={18} />
    }
  }

  return (
    <div className="module-manager">
      <div className="module-header">
        <Layers className="header-icon" size={24} />
        <h2>Module Management</h2>
      </div>

      <div className="module-description">
        <p>Manage the modules installed on your ERC-7579 modular smart account.</p>
      </div>

      {/* Account Status */}
      <div className="module-section">
        <h3>Account Status</h3>
        <div className="status-grid">
          <div className="status-item">
            <span className="status-label">Deployed</span>
            <span className={`status-value ${accountInfo?.deployed ? 'active' : ''}`}>
              {accountInfo?.deployed ? <Check size={16} /> : <X size={16} />}
              {accountInfo?.deployed ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">MFA Enabled</span>
            <span className={`status-value ${accountInfo?.mfaEnabled ? 'active' : ''}`}>
              {accountInfo?.mfaEnabled ? <Check size={16} /> : <X size={16} />}
              {accountInfo?.mfaEnabled ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </div>

      {/* Validator Module */}
      <div className="module-section">
        <h3>Validator Module</h3>
        <p className="section-description">The validator module handles signature verification for transactions.</p>
        {modules.validator ? (
          <div className="module-card">
            <div className="module-icon">{getModuleIcon(MODULE_TYPE.VALIDATOR)}</div>
            <div className="module-info">
              <span className="module-name">{modules.validator.name}</span>
              <span className="module-address">{formatAddress(modules.validator.address)}</span>
            </div>
            <span className="module-status installed">Installed</span>
          </div>
        ) : (
          <div className="module-empty">No validator module installed</div>
        )}
      </div>

      {/* Executor Modules */}
      <div className="module-section">
        <h3>Executor Modules</h3>
        <p className="section-description">Executor modules can perform actions on behalf of your account.</p>
        {modules.executors.length > 0 ? (
          <div className="module-list">
            {modules.executors.map((mod, idx) => (
              <div key={idx} className="module-card">
                <div className="module-icon">{getModuleIcon(MODULE_TYPE.EXECUTOR)}</div>
                <div className="module-info">
                  <span className="module-name">{mod.name}</span>
                  <span className="module-address">{formatAddress(mod.address)}</span>
                </div>
                <span className="module-status installed">Installed</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="module-empty">No executor modules installed</div>
        )}
      </div>

      {/* Hook Modules */}
      <div className="module-section">
        <h3>Hook Modules</h3>
        <p className="section-description">Hook modules can add pre/post execution checks to transactions.</p>
        {modules.hooks.length > 0 ? (
          <div className="module-list">
            {modules.hooks.map((mod, idx) => (
              <div key={idx} className="module-card">
                <div className="module-icon">{getModuleIcon(MODULE_TYPE.HOOK)}</div>
                <div className="module-info">
                  <span className="module-name">{mod.name}</span>
                  <span className="module-address">{formatAddress(mod.address)}</span>
                </div>
                <span className="module-status installed">Installed</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="module-empty">No hook modules installed</div>
        )}
      </div>
    </div>
  )
}

export default ModuleManager

