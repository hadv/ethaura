import { useState, useRef, useEffect } from 'react';
import { useNetwork } from '../contexts/NetworkContext';
import { getNetworkIcon, isTestnet } from '../utils/network';
import '../styles/NetworkSelector.css';

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

  return (
    <div className="network-selector-container" ref={dropdownRef}>
      <div
        className="network-selector"
        onClick={() => { setIsOpen(!isOpen); }}
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
            const isCurrentTestnet = isTestnet(network.chainId);
            const isPreviousMainnet = index > 0 && !isTestnet(availableNetworks[index - 1].chainId);
            // Show separator only once: before the first testnet (when previous network was mainnet)
            const showSeparator = isCurrentTestnet && isPreviousMainnet;

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

