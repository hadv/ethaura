import { ethers } from 'ethers'

// Account public key (from contract)
const qx = '0x14ba16c414fadfe3f109f2aa34532e6965236c95c0dc23d0d4f180efa16eb135'
const qy = '0xdb6138076d6f015b30c99c2bf526440a6d2f13a39081c163169ff8750f156ac5'

// Signature components
const r = '0x926cdc4cdcb9147db93299fb4a12b46b7339844423e916ff8c23ca54644ac466'
const s = '0x557be02b2138de8d0cff36928bc43872e373a67a0d0e677b60b485da2d71ed2e'

console.log('Account Public Key:')
console.log('  qx:', qx)
console.log('  qy:', qy)
console.log('')
console.log('Signature:')
console.log('  r:', r)
console.log('  s:', s)
console.log('')

// To verify, we need:
// 1. authenticatorData
// 2. clientDataJSON
// 3. The message hash = sha256(authenticatorData || sha256(clientDataJSON))

console.log('To verify this signature, please provide:')
console.log('1. authenticatorData (hex)')
console.log('2. clientDataJSON (string)')
console.log('')
console.log('These should be in the console logs when you signed the transaction.')

