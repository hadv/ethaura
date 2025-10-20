const { ethers } = require('ethers');

async function testPrecompile() {
  const provider = new ethers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/02wJFpCPmXPrz3Cpaldvn');
  
  // Test data (invalid signature, just to see if precompile responds)
  const hash = '0x' + '00'.repeat(32);
  const r = '0x' + '01'.repeat(32);
  const s = '0x' + '02'.repeat(32);
  const qx = '0x' + '03'.repeat(32);
  const qy = '0x' + '04'.repeat(32);
  
  const input = hash + r.slice(2) + s.slice(2) + qx.slice(2) + qy.slice(2);
  
  console.log('Input length:', input.length);
  console.log('Input:', input);
  
  try {
    const result = await provider.call({
      to: '0x0000000000000000000000000000000000000100',
      data: input
    });
    console.log('✅ Precompile responded:', result);
  } catch (error) {
    console.log('❌ Precompile error:', error.message);
  }
}

testPrecompile();
