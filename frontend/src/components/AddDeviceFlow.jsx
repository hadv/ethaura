import { useState } from 'react'
import AddCurrentDevice from './AddCurrentDevice'
import AddMobileDevice from './AddMobileDevice'
import '../styles/AddDeviceFlow.css'

function AddDeviceFlow({ accountAddress, onComplete, onCancel }) {
  const [selectedOption, setSelectedOption] = useState(null)

  if (!selectedOption) {
    return (
      <div className="add-device-flow">
        <div className="flow-header">
          <h2>Add New Device</h2>
          <p>Choose how you want to add a passkey:</p>
        </div>

        <div className="option-cards">
          {/* Option 1: Current Device */}
          <button
            className="option-card"
            onClick={() => setSelectedOption('current')}
          >
            <div className="option-icon">💻</div>
            <h3>This Device</h3>
            <p>Add a passkey on this browser/device</p>
            <ul className="option-benefits">
              <li>Quick and easy</li>
              <li>Works immediately</li>
              <li>Uses Touch ID / Face ID / Windows Hello</li>
            </ul>
          </button>

          {/* Option 2: Mobile/Tablet */}
          <button
            className="option-card"
            onClick={() => setSelectedOption('mobile')}
          >
            <div className="option-icon">📱</div>
            <h3>Mobile / Tablet</h3>
            <p>Scan QR code to add passkey on another device</p>
            <ul className="option-benefits">
              <li>Use your phone or tablet</li>
              <li>Scan QR code with camera</li>
              <li>Sign transactions on the go</li>
            </ul>
          </button>
        </div>

        <div className="flow-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (selectedOption === 'current') {
    return (
      <AddCurrentDevice
        accountAddress={accountAddress}
        onComplete={onComplete}
        onCancel={() => setSelectedOption(null)}
      />
    )
  }

  if (selectedOption === 'mobile') {
    return (
      <AddMobileDevice
        accountAddress={accountAddress}
        onComplete={onComplete}
        onCancel={() => setSelectedOption(null)}
      />
    )
  }

  return null
}

export default AddDeviceFlow

