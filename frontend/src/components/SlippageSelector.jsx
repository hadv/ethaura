import { useState, useEffect } from 'react'
import { Settings, AlertTriangle } from 'lucide-react'
import '../styles/SlippageSelector.css'

const PRESET_SLIPPAGE = [
  { value: 0.1, label: '0.1%', description: 'Low slippage, may fail' },
  { value: 0.5, label: '0.5%', description: 'Recommended' },
  { value: 1, label: '1%', description: 'High slippage' },
  { value: 3, label: '3%', description: 'Very high' },
  { value: 5, label: '5%', description: 'Extreme' },
]

const STORAGE_KEY = 'ethaura_slippage_preference'

function SlippageSelector({ value, onChange, className = '' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const [isCustom, setIsCustom] = useState(false)

  // Load saved preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const savedValue = parseFloat(saved)
        if (!isNaN(savedValue) && savedValue > 0) {
          // Check if it's a preset value
          const isPreset = PRESET_SLIPPAGE.some(preset => preset.value === savedValue)
          if (!isPreset) {
            setIsCustom(true)
            setCustomValue(savedValue.toString())
          }
          onChange(savedValue)
        }
      }
    } catch (error) {
      console.error('Failed to load slippage preference:', error)
    }
  }, [])

  // Save preference when value changes
  useEffect(() => {
    if (value > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, value.toString())
      } catch (error) {
        console.error('Failed to save slippage preference:', error)
      }
    }
  }, [value])

  const handlePresetClick = (presetValue) => {
    setIsCustom(false)
    setCustomValue('')
    onChange(presetValue)
  }

  const handleCustomChange = (e) => {
    const inputValue = e.target.value
    setCustomValue(inputValue)
    
    const numValue = parseFloat(inputValue)
    if (!isNaN(numValue) && numValue > 0 && numValue <= 50) {
      setIsCustom(true)
      onChange(numValue)
    }
  }

  const handleCustomBlur = () => {
    const numValue = parseFloat(customValue)
    if (isNaN(numValue) || numValue <= 0) {
      // Reset to default if invalid
      setIsCustom(false)
      setCustomValue('')
      onChange(0.5)
    }
  }

  const isHighSlippage = value > 1

  return (
    <div className={`slippage-selector ${className}`}>
      <button
        className="slippage-trigger"
        onClick={() => setIsOpen(!isOpen)}
        title="Slippage Settings"
      >
        <Settings size={18} />
        <span>{value}%</span>
      </button>

      {isOpen && (
        <>
          <div className="slippage-backdrop" onClick={() => setIsOpen(false)} />
          <div className="slippage-dropdown">
            <div className="slippage-header">
              <h4>Slippage Tolerance</h4>
              <button className="slippage-close" onClick={() => setIsOpen(false)}>×</button>
            </div>

            {isHighSlippage && (
              <div className="slippage-warning">
                <AlertTriangle size={16} />
                <span>High slippage tolerance may result in unfavorable rates</span>
              </div>
            )}

            <div className="slippage-presets">
              {PRESET_SLIPPAGE.map((preset) => (
                <button
                  key={preset.value}
                  className={`slippage-preset ${!isCustom && value === preset.value ? 'active' : ''}`}
                  onClick={() => handlePresetClick(preset.value)}
                >
                  <span className="preset-label">{preset.label}</span>
                  {preset.description && (
                    <span className="preset-description">{preset.description}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="slippage-custom">
              <label htmlFor="custom-slippage">Custom</label>
              <div className="custom-input-wrapper">
                <input
                  id="custom-slippage"
                  type="number"
                  min="0"
                  max="50"
                  step="0.1"
                  value={customValue}
                  onChange={handleCustomChange}
                  onBlur={handleCustomBlur}
                  placeholder="0.5"
                  className={isCustom ? 'active' : ''}
                />
                <span className="input-suffix">%</span>
              </div>
            </div>

            <div className="slippage-info">
              <p>Your transaction will revert if the price changes unfavorably by more than this percentage.</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default SlippageSelector

