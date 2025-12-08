import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { getNetworkName, getNetworkIcon, getNetworkColor } from '../utils/network';
import { clientDb } from '../lib/clientDatabase';

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
    // ERC-7579 modular account contracts
    modularFactoryAddress: import.meta.env.VITE_MODULAR_FACTORY_ADDRESS,
    validatorModuleAddress: import.meta.env.VITE_VALIDATOR_MODULE_ADDRESS,
    sessionKeyModuleAddress: import.meta.env.VITE_SESSION_KEY_MODULE_ADDRESS,
    supported: false, // Factory not yet deployed on mainnet
  },
  {
    chainId: 10,
    name: 'Optimism',
    rpcUrl: 'https://mainnet.optimism.io',
    bundlerUrl: 'https://api.pimlico.io/v2/optimism/rpc?apikey=YOUR_API_KEY',
    explorerUrl: 'https://optimistic.etherscan.io',
    factoryAddress: import.meta.env.VITE_FACTORY_ADDRESS,
    modularFactoryAddress: import.meta.env.VITE_MODULAR_FACTORY_ADDRESS,
    validatorModuleAddress: import.meta.env.VITE_VALIDATOR_MODULE_ADDRESS,
    sessionKeyModuleAddress: import.meta.env.VITE_SESSION_KEY_MODULE_ADDRESS,
    supported: false, // Factory not yet deployed on Optimism
  },
  {
    chainId: 137,
    name: 'Polygon',
    rpcUrl: 'https://polygon-rpc.com',
    bundlerUrl: 'https://api.pimlico.io/v2/polygon/rpc?apikey=YOUR_API_KEY',
    explorerUrl: 'https://polygonscan.com',
    factoryAddress: import.meta.env.VITE_FACTORY_ADDRESS,
    modularFactoryAddress: import.meta.env.VITE_MODULAR_FACTORY_ADDRESS,
    validatorModuleAddress: import.meta.env.VITE_VALIDATOR_MODULE_ADDRESS,
    sessionKeyModuleAddress: import.meta.env.VITE_SESSION_KEY_MODULE_ADDRESS,
    supported: false, // Factory not yet deployed on Polygon
  },
  {
    chainId: 42161,
    name: 'Arbitrum',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    bundlerUrl: 'https://api.pimlico.io/v2/arbitrum/rpc?apikey=YOUR_API_KEY',
    explorerUrl: 'https://arbiscan.io',
    factoryAddress: import.meta.env.VITE_FACTORY_ADDRESS,
    modularFactoryAddress: import.meta.env.VITE_MODULAR_FACTORY_ADDRESS,
    validatorModuleAddress: import.meta.env.VITE_VALIDATOR_MODULE_ADDRESS,
    sessionKeyModuleAddress: import.meta.env.VITE_SESSION_KEY_MODULE_ADDRESS,
    supported: false, // Factory not yet deployed on Arbitrum
  },
  {
    chainId: 8453,
    name: 'Base',
    rpcUrl: import.meta.env.VITE_BASE_RPC_URL || 'https://mainnet.base.org',
    bundlerUrl: import.meta.env.VITE_BASE_BUNDLER_URL || 'https://api.pimlico.io/v2/base/rpc?apikey=YOUR_API_KEY',
    explorerUrl: 'https://basescan.org',
    factoryAddress: import.meta.env.VITE_FACTORY_ADDRESS,
    modularFactoryAddress: import.meta.env.VITE_MODULAR_FACTORY_ADDRESS,
    validatorModuleAddress: import.meta.env.VITE_VALIDATOR_MODULE_ADDRESS,
    sessionKeyModuleAddress: import.meta.env.VITE_SESSION_KEY_MODULE_ADDRESS,
    supported: false, // Factory will be deployed after Base Sepolia testing
  },
  {
    chainId: 84532,
    name: 'Base Sepolia',
    rpcUrl: import.meta.env.VITE_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
    bundlerUrl: import.meta.env.VITE_BASE_SEPOLIA_BUNDLER_URL || 'https://api.pimlico.io/v2/base-sepolia/rpc?apikey=YOUR_API_KEY',
    explorerUrl: 'https://sepolia.basescan.org',
    factoryAddress: import.meta.env.VITE_BASE_SEPOLIA_FACTORY_ADDRESS || '0xF913EF5101Dcb4fDB9A62666D18593aea5509262',
    // ERC-7579 modular account contracts (to be deployed)
    modularFactoryAddress: import.meta.env.VITE_BASE_SEPOLIA_MODULAR_FACTORY_ADDRESS,
    validatorModuleAddress: import.meta.env.VITE_BASE_SEPOLIA_VALIDATOR_MODULE_ADDRESS,
    sessionKeyModuleAddress: import.meta.env.VITE_BASE_SEPOLIA_SESSION_KEY_MODULE_ADDRESS,
    supported: true, // ✅ Deployed on 2025-11-22
  },
  {
    chainId: 11155111,
    name: 'Sepolia',
    rpcUrl: import.meta.env.VITE_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo',
    bundlerUrl: import.meta.env.VITE_BUNDLER_URL || 'https://api.pimlico.io/v2/sepolia/rpc?apikey=YOUR_API_KEY',
    explorerUrl: 'https://sepolia.etherscan.io',
    factoryAddress: import.meta.env.VITE_FACTORY_ADDRESS,
    // ERC-7579 modular account contracts (to be deployed)
    modularFactoryAddress: import.meta.env.VITE_MODULAR_FACTORY_ADDRESS,
    validatorModuleAddress: import.meta.env.VITE_VALIDATOR_MODULE_ADDRESS,
    sessionKeyModuleAddress: import.meta.env.VITE_SESSION_KEY_MODULE_ADDRESS,
    supported: true, // Factory is deployed on Sepolia
  },
];

export const NetworkProvider = ({ children }) => {
  // Get default network from env or use Sepolia
  const defaultChainId = parseInt(import.meta.env.VITE_CHAIN_ID || '11155111');
  const defaultNetwork = AVAILABLE_NETWORKS.find(n => n.chainId === defaultChainId) || AVAILABLE_NETWORKS[0];

  // Start with default, load from SQLite after mount
  const [selectedNetwork, setSelectedNetwork] = useState(defaultNetwork);
  const [customRpcs, setCustomRpcs] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);
  const isInitialMount = useRef(true);

  // Load settings from SQLite on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load selected network (getSetting already parses JSON)
        const storedNetwork = await clientDb.getSetting('selected_network');
        if (storedNetwork) {
          const network = AVAILABLE_NETWORKS.find(n => n.chainId === storedNetwork.chainId);
          if (network) {
            setSelectedNetwork(network);
          }
        }

        // Load custom RPCs (getSetting already parses JSON)
        const storedRpcs = await clientDb.getSetting('custom_rpcs');
        if (storedRpcs) {
          setCustomRpcs(storedRpcs);
        }
      } catch (e) {
        console.error('Failed to load network settings from SQLite:', e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadSettings();
  }, []);

  // Persist selected network to SQLite (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      return;
    }
    const saveNetwork = async () => {
      try {
        // setSetting handles JSON.stringify internally
        await clientDb.setSetting('selected_network', selectedNetwork);
        console.log('🌐 Network changed to:', selectedNetwork.name, `(Chain ID: ${selectedNetwork.chainId})`);
      } catch (e) {
        console.error('Failed to save network to SQLite:', e);
      }
    };
    saveNetwork();
  }, [selectedNetwork]);

  // Persist custom RPCs to SQLite (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const saveRpcs = async () => {
      try {
        // setSetting handles JSON.stringify internally
        await clientDb.setSetting('custom_rpcs', customRpcs);
      } catch (e) {
        console.error('Failed to save custom RPCs to SQLite:', e);
      }
    };
    saveRpcs();
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

