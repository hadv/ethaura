import { createContext, useContext, useState, useEffect } from 'react';
import { Web3Auth } from '@web3auth/modal';
import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } from '@web3auth/base';
import { EthereumPrivateKeyProvider } from '@web3auth/ethereum-provider';
import { createWalletClient, custom } from 'viem';
import { sepolia } from 'viem/chains';
import { useNetwork } from './NetworkContext.jsx';

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

  const { networkInfo, setCustomRpcsBulk } = useNetwork();

  useEffect(() => {
    const init = async () => {
      try {
        const chainIdHex = '0x' + Number(networkInfo?.chainId || 11155111).toString(16);

        // Configure Ethereum provider from selected network
        const chainConfig = {
          chainNamespace: CHAIN_NAMESPACES.EIP155,
          chainId: chainIdHex,
          rpcTarget: networkInfo?.rpcUrl || import.meta.env.VITE_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo',
          displayName: networkInfo?.name || 'Sepolia Testnet',
          blockExplorerUrl: networkInfo?.explorerUrl || 'https://sepolia.etherscan.io',
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
          uxMode: 'redirect',
          uiConfig: {
            appName: 'ΞTHΛURΛ - P256 Account Abstraction',
            mode: 'light',
            loginMethodsOrder: ['google', 'facebook', 'twitter', 'email_passwordless'],
            logoLight: 'https://web3auth.io/images/web3authlog.png',
            logoDark: 'https://web3auth.io/images/web3authlogodark.png',
            defaultLanguage: 'en',
            theme: { primary: '#768729' },
            modalConfig: { modalZIndex: '2147483647' },
          },
          sessionTime: 86400,
          enableLogging: false,
        });

        // Initialize
        if (typeof web3authInstance.initModal === 'function') {
          await web3authInstance.initModal();
        } else if (typeof web3authInstance.init === 'function') {
          await web3authInstance.init();
        } else {
          throw new Error('No initialization method found on Web3Auth instance');
        }

        setWeb3auth(web3authInstance);

        if (web3authInstance.connected) {
          const web3authProvider = web3authInstance.provider;
          setProvider(web3authProvider);

          const client = createWalletClient({
            chain: sepolia, // TODO: map to selected chain if needed
            transport: custom(web3authProvider),
          });
          setWalletClient(client);

          const user = await web3authInstance.getUserInfo();
          setUserInfo(user);

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
    // Re-init when network changes
  }, [networkInfo]);

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
        chain: sepolia, // TODO: map to selected chain if needed
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

  // Sign raw hash without Ethereum message prefix
  const signRawHash = async (hash) => {
    if (!provider || !address) {
      throw new Error('Wallet not connected');
    }

    try {
      console.log('🔐 Signing raw hash (NO PREFIX):', hash);

      // Get private key from Web3Auth
      let privateKey = await provider.request({
        method: 'eth_private_key',
      });

      console.log('🔐 Got private key from Web3Auth:', privateKey);

      // Ensure private key has 0x prefix
      if (!privateKey.startsWith('0x')) {
        privateKey = '0x' + privateKey;
      }

      console.log('🔐 Private key with prefix:', privateKey);

      // Import ethers to sign directly
      const { ethers } = await import('ethers');

      // Ensure hash has 0x prefix
      let hashToSign = hash;
      if (!hashToSign.startsWith('0x')) {
        hashToSign = '0x' + hashToSign;
      }

      console.log('🔐 Hash to sign:', hashToSign);

      // Create a signing key from the private key
      const signingKey = new ethers.SigningKey(privateKey);

      // Sign the hash directly without any prefix
      // This uses ECDSA signing directly on the hash
      const signature = signingKey.sign(hashToSign);

      // Convert to compact format: r || s || v
      const compactSig = signature.serialized;

      console.log('🔐 Raw hash signature (direct ECDSA):', compactSig);
      console.log('🔐 Signature components:', {
        r: signature.r,
        s: signature.s,
        v: signature.v,
      });

      return compactSig;
    } catch (error) {
      console.error('Error signing raw hash:', error);
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
    signRawHash,
    signTypedData,
    getPrivateKey,
  };

  // Don't block rendering - let the app handle loading states
  return (
    <Web3AuthContext.Provider value={value}>
      {children}
    </Web3AuthContext.Provider>
  );
};

