import { useState, useRef, useEffect } from 'react';
import { useNetwork } from '../contexts/NetworkContext';
import '../styles/NetworkSelector.css';

// Import network icons
import ethereumIcon from '../assets/networks/ethereum.png';
import optimismIcon from '../assets/networks/optimism.png';
import polygonIcon from '../assets/networks/polygon.png';
import arbitrumIcon from '../assets/networks/arbitrum.png';

const NetworkSelector = () => {
  const { networkInfo, availableNetworks, switchNetwork } = useNetwork();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleNetworkChange = (chainId) => {
    switchNetwork(chainId);
    setIsOpen(false);
  };

  // Get network color based on chainId
  const getNetworkColor = (chainId) => {
    switch (chainId) {
      case 11155111: // Sepolia
        return '#627EEA'; // Ethereum blue
      case 1: // Ethereum
        return '#627EEA';
      case 137: // Polygon
        return '#8247E5';
      case 42161: // Arbitrum
        return '#28A0F0';
      case 10: // Optimism
        return '#FF0420';
      default:
        return '#6B7280';
    }
  };

  // Get network icon based on chainId
  const getNetworkIcon = (chainId) => {
    switch (chainId) {
      case 11155111: // Sepolia
      case 1: // Ethereum
        return ethereumIcon;
      case 137: // Polygon
        return polygonIcon;
      case 42161: // Arbitrum
        return arbitrumIcon;
      case 10: // Optimism
        return optimismIcon;
      default:
        return ethereumIcon;
    }
  };

  return (
    <div className="network-selector-container" ref={dropdownRef}>
      <div
        className="network-selector"
        onClick={() => setIsOpen(!isOpen)}
      >
        <img
          src={getNetworkIcon(networkInfo.chainId)}
          alt={networkInfo.name}
          className="network-icon"
        />
        <span className="network-name">{networkInfo.name}</span>
        <svg
          className={`dropdown-arrow ${isOpen ? 'open' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {isOpen && (
        <div className="network-dropdown">
          {availableNetworks.map((network, index) => {
            const isSelected = network.chainId === networkInfo.chainId;
            const isTestnet = network.chainId === 11155111; // Sepolia
            const showSeparator = isTestnet && index > 0;

            return (
              <div key={network.chainId}>
                {showSeparator && <div className="network-separator" />}
                <div
                  className={`network-option ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleNetworkChange(network.chainId)}
                >
                  <div className="network-option-left">
                    <img
                      src={getNetworkIcon(network.chainId)}
                      alt={network.name}
                      className="network-icon"
                    />
                    <span className="network-option-name">{network.name}</span>
                  </div>
                  {isSelected && (
                    <div className="network-selected-check">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="8" fill="black"/>
                        <path d="M5 8L7 10L11 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NetworkSelector;

