import React from 'react'
import { useWalletConnect } from '../contexts/WalletConnectContext'
import '../styles/WalletConnectModal.css'

export const WalletConnectSessions = () => {
  const { sessions, disconnectSession, isInitialized } = useWalletConnect()
  const [disconnecting, setDisconnecting] = React.useState(null)

  if (!isInitialized) {
    return (
      <div className="sessions-container">
        <p className="info-text">Initializing WalletConnect...</p>
      </div>
    )
  }

  const handleDisconnect = async (topic) => {
    setDisconnecting(topic)
    try {
      await disconnectSession(topic)
    } catch (err) {
      console.error('Failed to disconnect:', err)
    } finally {
      setDisconnecting(null)
    }
  }

  if (sessions.length === 0) {
    return (
      <div className="sessions-container">
        <p className="info-text">No active connections</p>
        <p className="small-text">Connect to a dApp to see it here</p>
      </div>
    )
  }

  return (
    <div className="sessions-container">
      <h3>Active Connections ({sessions.length})</h3>
      
      <div className="sessions-list">
        {sessions.map((session) => {
          const { topic, peer, namespaces } = session
          const { metadata } = peer
          
          // Get connected chains
          const chains = Object.values(namespaces)
            .flatMap(ns => ns.chains || [])
            .map(chain => chain.replace('eip155:', ''))

          return (
            <div key={topic} className="session-item">
              <div className="session-info">
                {metadata.icons?.[0] && (
                  <img 
                    src={metadata.icons[0]} 
                    alt={metadata.name}
                    className="session-icon"
                  />
                )}
                <div className="session-details">
                  <h4>{metadata.name}</h4>
                  <p className="session-url">{metadata.url}</p>
                  {chains.length > 0 && (
                    <div className="session-chains">
                      {chains.map((chain, i) => (
                        <span key={i} className="chain-badge">
                          Chain {chain}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <button
                onClick={() => handleDisconnect(topic)}
                disabled={disconnecting === topic}
                className="disconnect-button"
              >
                {disconnecting === topic ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

