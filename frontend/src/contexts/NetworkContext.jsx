import { createContext, useContext, useState, useEffect } from 'react';
import { getNetworkName, getNetworkIcon, getNetworkColor } from '../utils/network';

const NetworkContext = createContext(null);

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within NetworkProvider');
  }
  return context;
};

// Available networks configuration
// NOTE: Factory contracts are only deployed on testnets (Sepolia)
// Other networks are shown for future expansion but will show "Network not supported" error
export const AVAILABLE_NETWORKS = [
  {
    chainId: 1,
    name: 'Ethereum',
    rpcUrl: 'https://eth.llamarpc.com',
    bundlerUrl: 'https://api.pimlico.io/v2/1/rpc?apikey=YOUR_API_KEY',
    explorerUrl: 'https://etherscan.io',
    factoryAddress: import.meta.env.VITE_FACTORY_ADDRESS,
    supported: false, // Factory not yet deployed on mainnet
  },
  {
    chainId: 10,
    name: 'Optimism',
    rpcUrl: 'https://mainnet.optimism.io',
    bundlerUrl: 'https://api.pimlico.io/v2/optimism/rpc?apikey=YOUR_API_KEY',
    explorerUrl: 'https://optimistic.etherscan.io',
    factoryAddress: import.meta.env.VITE_FACTORY_ADDRESS,
    supported: false, // Factory not yet deployed on Optimism
  },
  {
    chainId: 137,
    name: 'Polygon',
    rpcUrl: 'https://polygon-rpc.com',
    bundlerUrl: 'https://api.pimlico.io/v2/polygon/rpc?apikey=YOUR_API_KEY',
    explorerUrl: 'https://polygonscan.com',
    factoryAddress: import.meta.env.VITE_FACTORY_ADDRESS,
    supported: false, // Factory not yet deployed on Polygon
  },
  {
    chainId: 42161,
    name: 'Arbitrum',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    bundlerUrl: 'https://api.pimlico.io/v2/arbitrum/rpc?apikey=YOUR_API_KEY',
    explorerUrl: 'https://arbiscan.io',
    factoryAddress: import.meta.env.VITE_FACTORY_ADDRESS,
    supported: false, // Factory not yet deployed on Arbitrum
  },
  {
    chainId: 11155111,
    name: 'Sepolia',
    rpcUrl: import.meta.env.VITE_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo',
    bundlerUrl: import.meta.env.VITE_BUNDLER_URL || 'https://api.pimlico.io/v2/sepolia/rpc?apikey=YOUR_API_KEY',
    explorerUrl: 'https://sepolia.etherscan.io',
    factoryAddress: import.meta.env.VITE_FACTORY_ADDRESS,
    supported: true, // Factory is deployed on Sepolia
  },
];

export const NetworkProvider = ({ children }) => {
  // Get default network from env or use Sepolia
  const defaultChainId = parseInt(import.meta.env.VITE_CHAIN_ID || '11155111');

  // Load selected network from localStorage or use default
  const [selectedNetwork, setSelectedNetwork] = useState(() => {
    const stored = localStorage.getItem('ethaura_selected_network');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Validate that the stored network exists in AVAILABLE_NETWORKS
        const network = AVAILABLE_NETWORKS.find(n => n.chainId === parsed.chainId);
        if (network) {
          return network;
        }
      } catch (e) {
        console.error('Failed to parse stored network:', e);
      }
    }
    // Default to the network from env or Sepolia
    return AVAILABLE_NETWORKS.find(n => n.chainId === defaultChainId) || AVAILABLE_NETWORKS[0];
  });

  // Custom RPC overrides per chainId
  const [customRpcs, setCustomRpcs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ethaura_custom_rpcs') || '{}');
    } catch (e) {
      console.warn('Failed to parse custom RPCs from storage, resetting');
      return {};
    }
  });

  // Persist selections
  useEffect(() => {
    localStorage.setItem('ethaura_selected_network', JSON.stringify(selectedNetwork));
    console.log('🌐 Network changed to:', selectedNetwork.name, `(Chain ID: ${selectedNetwork.chainId})`);
  }, [selectedNetwork]);

  useEffect(() => {
    localStorage.setItem('ethaura_custom_rpcs', JSON.stringify(customRpcs));
  }, [customRpcs]);

  const switchNetwork = (chainId) => {
    const network = AVAILABLE_NETWORKS.find(n => n.chainId === chainId);
    if (network) {
      setSelectedNetwork(network);
      return true;
    }
    console.error('Network not found:', chainId);
    return false;
  };

  const validateRpcUrl = (url) => {
    try {
      const u = new URL(url);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const setCustomRpcForChain = (chainId, url) => {
    if (!validateRpcUrl(url)) {
      throw new Error('Invalid RPC URL');
    }
    setCustomRpcs(prev => ({ ...prev, [chainId]: { rpcUrl: url } }));
  };

  const clearCustomRpcForChain = (chainId) => {
    setCustomRpcs(prev => {
      const next = { ...prev };
      delete next[chainId];
      return next;
    });
  };




  const setCustomRpc = (url) => setCustomRpcForChain(selectedNetwork.chainId, url);
  const clearCustomRpc = () => clearCustomRpcForChain(selectedNetwork.chainId);

  const getEffectiveRpcUrl = (chainId) => customRpcs?.[chainId]?.rpcUrl || (AVAILABLE_NETWORKS.find(n => n.chainId === chainId)?.rpcUrl);

  const getNetworkInfo = () => {
    const effectiveRpcUrl = getEffectiveRpcUrl(selectedNetwork.chainId);
    return {
      ...selectedNetwork,
      rpcUrl: effectiveRpcUrl,
      icon: getNetworkIcon(selectedNetwork.chainId),
      color: getNetworkColor(selectedNetwork.chainId),
    };
  };

  const value = {
    selectedNetwork,
    networkInfo: getNetworkInfo(),
    availableNetworks: AVAILABLE_NETWORKS,
    switchNetwork,
    // RPC controls
    customRpcs,
    setCustomRpc,
    clearCustomRpc,
    setCustomRpcForChain,
    clearCustomRpcForChain,
    getEffectiveRpcUrl,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
};

