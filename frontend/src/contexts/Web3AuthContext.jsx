import { createContext, useContext, useState, useEffect } from 'react';
import { Web3Auth } from '@web3auth/modal';
import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } from '@web3auth/base';
import { EthereumPrivateKeyProvider } from '@web3auth/ethereum-provider';
import { createWalletClient, custom } from 'viem';
import { sepolia } from 'viem/chains';

const Web3AuthContext = createContext(null);

export const useWeb3Auth = () => {
  const context = useContext(Web3AuthContext);
  if (!context) {
    throw new Error('useWeb3Auth must be used within Web3AuthProvider');
  }
  return context;
};

export const Web3AuthProvider = ({ children }) => {
  const [web3auth, setWeb3auth] = useState(null);
  const [provider, setProvider] = useState(null);
  const [walletClient, setWalletClient] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [address, setAddress] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [initError, setInitError] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        // Configure Ethereum provider for Sepolia
        const chainConfig = {
          chainNamespace: CHAIN_NAMESPACES.EIP155,
          chainId: '0xaa36a7', // Sepolia chain ID (11155111)
          rpcTarget: import.meta.env.VITE_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo',
          displayName: 'Sepolia Testnet',
          blockExplorerUrl: 'https://sepolia.etherscan.io',
          ticker: 'ETH',
          tickerName: 'Ethereum',
        };

        const privateKeyProvider = new EthereumPrivateKeyProvider({
          config: { chainConfig },
        });

        // Initialize Web3Auth
        const web3authInstance = new Web3Auth({
          clientId: import.meta.env.VITE_WEB3AUTH_CLIENT_ID || 'BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ', // Demo client ID
          web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
          chainConfig,
          privateKeyProvider,
          uxMode: 'redirect', // Use redirect mode instead of popup to avoid COOP issues
          uiConfig: {
            appName: 'EthAura - P256 Account Abstraction',
            mode: 'light',
            loginMethodsOrder: ['google', 'facebook', 'twitter', 'email_passwordless'],
            logoLight: 'https://web3auth.io/images/web3authlog.png',
            logoDark: 'https://web3auth.io/images/web3authlogodark.png',
            defaultLanguage: 'en',
            theme: {
              primary: '#768729',
            },
          },
        });

        await web3authInstance.initModal();
        setWeb3auth(web3authInstance);

        // Check if already connected
        if (web3authInstance.connected) {
          const web3authProvider = web3authInstance.provider;
          setProvider(web3authProvider);

          // Create wallet client
          const client = createWalletClient({
            chain: sepolia,
            transport: custom(web3authProvider),
          });
          setWalletClient(client);

          // Get user info
          const user = await web3authInstance.getUserInfo();
          setUserInfo(user);

          // Get address
          const [addr] = await client.getAddresses();
          setAddress(addr);
          setIsConnected(true);
        }
      } catch (error) {
        console.error('Error initializing Web3Auth:', error);
        setInitError(error.message || 'Failed to initialize Web3Auth');
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const login = async () => {
    if (!web3auth) {
      console.error('Web3Auth not initialized');
      return;
    }

    try {
      const web3authProvider = await web3auth.connect();
      setProvider(web3authProvider);

      // Create wallet client
      const client = createWalletClient({
        chain: sepolia,
        transport: custom(web3authProvider),
      });
      setWalletClient(client);

      // Get user info
      const user = await web3auth.getUserInfo();
      setUserInfo(user);

      // Get address
      const [addr] = await client.getAddresses();
      setAddress(addr);
      setIsConnected(true);

      return { address: addr, userInfo: user };
    } catch (error) {
      console.error('Error logging in:', error);
      throw error;
    }
  };

  const logout = async () => {
    if (!web3auth) {
      console.error('Web3Auth not initialized');
      return;
    }

    try {
      await web3auth.logout();
      setProvider(null);
      setWalletClient(null);
      setUserInfo(null);
      setAddress(null);
      setIsConnected(false);
    } catch (error) {
      console.error('Error logging out:', error);
      throw error;
    }
  };

  const signMessage = async (message) => {
    if (!walletClient || !address) {
      throw new Error('Wallet not connected');
    }

    try {
      const signature = await walletClient.signMessage({
        account: address,
        message,
      });
      return signature;
    } catch (error) {
      console.error('Error signing message:', error);
      throw error;
    }
  };

  const signTypedData = async (typedData) => {
    if (!walletClient || !address) {
      throw new Error('Wallet not connected');
    }

    try {
      const signature = await walletClient.signTypedData({
        account: address,
        ...typedData,
      });
      return signature;
    } catch (error) {
      console.error('Error signing typed data:', error);
      throw error;
    }
  };

  const getPrivateKey = async () => {
    if (!provider) {
      throw new Error('Provider not available');
    }

    try {
      // Get private key from Web3Auth provider
      const privateKey = await provider.request({
        method: 'eth_private_key',
      });
      return privateKey;
    } catch (error) {
      console.error('Error getting private key:', error);
      throw error;
    }
  };

  const value = {
    web3auth,
    provider,
    walletClient,
    userInfo,
    address,
    isLoading,
    isConnected,
    login,
    logout,
    signMessage,
    signTypedData,
    getPrivateKey,
  };

  // Show error state if initialization failed
  if (initError) {
    return (
      <Web3AuthContext.Provider value={value}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          color: 'white',
          fontSize: '18px',
          flexDirection: 'column',
          gap: '20px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <div>❌ Web3Auth Initialization Error</div>
          <div style={{ fontSize: '14px', opacity: 0.8, maxWidth: '600px' }}>
            {initError}
          </div>
          <div style={{ fontSize: '12px', opacity: 0.6 }}>
            Check the console for more details
          </div>
        </div>
      </Web3AuthContext.Provider>
    );
  }

  // Show loading state while initializing
  if (isLoading) {
    return (
      <Web3AuthContext.Provider value={value}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          color: 'white',
          fontSize: '18px',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div>🔄 Initializing Web3Auth...</div>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>This may take a few seconds</div>
        </div>
      </Web3AuthContext.Provider>
    );
  }

  return (
    <Web3AuthContext.Provider value={value}>
      {children}
    </Web3AuthContext.Provider>
  );
};

