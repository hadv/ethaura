/**
 * CORS Testing Script for EthAura Backend
 * 
 * Usage:
 *   node test-cors.js [backend-url] [frontend-url]
 * 
 * Example:
 *   node test-cors.js http://localhost:3001 https://ethersafe.ngrok.app
 *   node test-cors.js https://ethaura.ngrok.dev https://ethersafe.ngrok.app
 */

const backendUrl = process.argv[2] || 'http://localhost:3001'
const frontendUrl = process.argv[3] || 'https://ethersafe.ngrok.app'

console.log('🧪 EthAura CORS Testing')
console.log('================================')
console.log('')
console.log('Backend URL:', backendUrl)
console.log('Frontend URL:', frontendUrl)
console.log('')

// Test cases
const tests = [
  {
    name: 'Configured Frontend URL',
    origin: frontendUrl,
    shouldPass: true,
  },
  {
    name: 'Localhost (port 3000)',
    origin: 'http://localhost:3000',
    shouldPass: true,
  },
  {
    name: 'Localhost (port 5173)',
    origin: 'http://localhost:5173',
    shouldPass: true,
  },
  {
    name: 'Random ngrok URL',
    origin: 'https://random123.ngrok.app',
    shouldPass: false, // Should fail in production, pass in development
  },
  {
    name: 'Invalid origin',
    origin: 'https://evil.com',
    shouldPass: false,
  },
  {
    name: 'No origin (mobile app)',
    origin: null,
    shouldPass: true,
  },
]

// Run tests
async function runTests() {
  let passed = 0
  let failed = 0

  for (const test of tests) {
    console.log(`\n📝 Test: ${test.name}`)
    console.log(`   Origin: ${test.origin || '(none)'}`)
    console.log(`   Expected: ${test.shouldPass ? 'PASS ✅' : 'FAIL ❌'}`)

    try {
      const headers = {
        'Content-Type': 'application/json',
      }

      if (test.origin) {
        headers['Origin'] = test.origin
      }

      const response = await fetch(`${backendUrl}/health`, {
        method: 'GET',
        headers,
      })

      const data = await response.json()

      if (response.ok) {
        console.log(`   Result: PASS ✅ (HTTP ${response.status})`)
        console.log(`   Response:`, data)
        
        // Check CORS headers
        const corsHeader = response.headers.get('access-control-allow-origin')
        if (corsHeader) {
          console.log(`   CORS Header: ${corsHeader}`)
        }
        
        if (test.shouldPass) {
          passed++
        } else {
          console.log(`   ⚠️  Warning: Expected to fail but passed`)
        }
      } else {
        console.log(`   Result: FAIL ❌ (HTTP ${response.status})`)
        
        if (!test.shouldPass) {
          passed++
        } else {
          failed++
          console.log(`   ⚠️  Error: Expected to pass but failed`)
        }
      }
    } catch (error) {
      console.log(`   Result: FAIL ❌`)
      console.log(`   Error: ${error.message}`)
      
      if (!test.shouldPass) {
        passed++
      } else {
        failed++
      }
    }
  }

  // Summary
  console.log('\n================================')
  console.log('📊 CORS Test Summary')
  console.log('================================')
  console.log(`Total Tests: ${tests.length}`)
  console.log(`Passed: ${passed} ✅`)
  console.log(`Failed: ${failed} ❌`)
  console.log('')

  if (failed === 0) {
    console.log('🎉 All tests passed!')
  } else {
    console.log('⚠️  Some tests failed. Check backend logs for details.')
  }

  console.log('')
  console.log('💡 Tips:')
  console.log('  - Check backend logs for CORS messages')
  console.log('  - Look for "✅ CORS allowed: ..." or "⚠️ CORS blocked: ..."')
  console.log('  - Verify FRONTEND_URL in backend/.env matches:', frontendUrl)
  console.log('  - For production, set NODE_ENV=production in backend/.env')
  console.log('')
}

// Run tests
runTests().catch(console.error)

