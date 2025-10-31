#!/usr/bin/env node

const { ethers } = require('ethers');

async function main() {
  const accountAddress = process.argv[2] || '0xa68aC8C74F2AC44A0071C4D943cd02DF2687318b';
  
  // Use Sepolia RPC
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'https://rpc.sepolia.org');
  
  const accountABI = [
    'function owner() view returns (address)',
    'function qx() view returns (bytes32)',
    'function qy() view returns (bytes32)',
    'function twoFactorEnabled() view returns (bool)',
  ];
  
  const contract = new ethers.Contract(accountAddress, accountABI, provider);
  
  console.log('📋 Checking account state for:', accountAddress);
  console.log('');
  
  try {
    const [owner, qx, qy, twoFactorEnabled] = await Promise.all([
      contract.owner(),
      contract.qx(),
      contract.qy(),
      contract.twoFactorEnabled(),
    ]);
    
    console.log('✅ On-chain state:');
    console.log('  Owner:', owner);
    console.log('  qx:', qx);
    console.log('  qy:', qy);
    console.log('  twoFactorEnabled:', twoFactorEnabled);
    console.log('');
    
    const hasPasskey = qx !== '0x0000000000000000000000000000000000000000000000000000000000000000';
    console.log('📊 Computed values:');
    console.log('  hasPasskey:', hasPasskey);
    console.log('  Expected signature mode:', !hasPasskey || !twoFactorEnabled ? 'OWNER-ONLY (65 bytes)' : 'PASSKEY + OWNER (WebAuthn + 65 bytes)');
    console.log('');
    
    // Check if signature from logs would work
    if (process.argv[3] && process.argv[4]) {
      const hash = process.argv[3];
      const signature = process.argv[4];
      
      console.log('🔍 Verifying signature from logs:');
      console.log('  Hash:', hash);
      console.log('  Signature:', signature);
      
      const recoveredAddress = ethers.recoverAddress(hash, signature);
      console.log('  Recovered address:', recoveredAddress);
      console.log('  Contract owner:', owner);
      console.log('  Addresses match:', recoveredAddress.toLowerCase() === owner.toLowerCase());
    }
  } catch (error) {
    console.error('❌ Error reading contract:', error.message);
  }
}

main().catch(console.error);

