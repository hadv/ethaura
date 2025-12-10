import { useState, useEffect, useRef } from 'react'
import { Clock, AlertTriangle } from 'lucide-react'
import { clientDb } from '../lib/clientDatabase'
import '../styles/DeadlineSelector.css'

const PRESET_DEADLINES = [
  { value: 5, label: '5 min', description: 'Quick' },
  { value: 10, label: '10 min', description: 'Default' },
  { value: 20, label: '20 min', description: 'Medium' },
  { value: 30, label: '30 min', description: 'Long' },
]

const STORAGE_KEY = 'deadline_preference'

function DeadlineSelector({ value, onChange, className = '' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const isInitialMount = useRef(true)

  // Load saved preference on mount
  useEffect(() => {
    const loadPreference = async () => {
      try {
        const saved = await clientDb.getSetting(STORAGE_KEY)
        if (saved) {
          const savedValue = parseInt(saved, 10)
          if (!isNaN(savedValue) && savedValue > 0) {
            // Check if it's a preset value
            const isPreset = PRESET_DEADLINES.some(preset => preset.value === savedValue)
            if (!isPreset) {
              setIsCustom(true)
              setCustomValue(savedValue.toString())
            }
            onChange(savedValue)
          }
        }
      } catch (error) {
        console.error('Failed to load deadline preference:', error)
      }
    }
    loadPreference()
  }, [])

  // Save preference when value changes (skip initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    if (value > 0) {
      const savePreference = async () => {
        try {
          await clientDb.setSetting(STORAGE_KEY, value.toString())
        } catch (error) {
          console.error('Failed to save deadline preference:', error)
        }
      }
      savePreference()
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
    
    const numValue = parseInt(inputValue, 10)
    if (!isNaN(numValue) && numValue > 0 && numValue <= 120) {
      setIsCustom(true)
      onChange(numValue)
    }
  }

  const handleCustomBlur = () => {
    const numValue = parseInt(customValue, 10)
    if (isNaN(numValue) || numValue <= 0) {
      // Reset to default if invalid
      setIsCustom(false)
      setCustomValue('')
      onChange(10)
    }
  }

  const isShortDeadline = value < 5
  const isLongDeadline = value > 30

  return (
    <div className={`deadline-selector ${className}`}>
      <button
        className="deadline-trigger"
        onClick={() => setIsOpen(!isOpen)}
        title="Transaction Deadline"
      >
        <Clock size={18} />
        <span>{value} min</span>
      </button>

      {isOpen && (
        <>
          <div className="deadline-backdrop" onClick={() => setIsOpen(false)} />
          <div className="deadline-dropdown">
            <div className="deadline-header">
              <h4>Transaction Deadline</h4>
              <button className="deadline-close" onClick={() => setIsOpen(false)}>×</button>
            </div>

            {isShortDeadline && (
              <div className="deadline-warning">
                <AlertTriangle size={16} />
                <span>Very short deadline may cause transaction to fail</span>
              </div>
            )}

            {isLongDeadline && (
              <div className="deadline-warning long">
                <AlertTriangle size={16} />
                <span>Long deadline increases risk of price changes</span>
              </div>
            )}

            <div className="deadline-presets">
              {PRESET_DEADLINES.map((preset) => (
                <button
                  key={preset.value}
                  className={`deadline-preset ${!isCustom && value === preset.value ? 'active' : ''}`}
                  onClick={() => handlePresetClick(preset.value)}
                >
                  <span className="preset-label">{preset.label}</span>
                  {preset.description && (
                    <span className="preset-description">{preset.description}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="deadline-custom">
              <label htmlFor="custom-deadline">Custom</label>
              <div className="custom-input-wrapper">
                <input
                  id="custom-deadline"
                  type="number"
                  min="1"
                  max="120"
                  step="1"
                  value={customValue}
                  onChange={handleCustomChange}
                  onBlur={handleCustomBlur}
                  placeholder="10"
                  className={isCustom ? 'active' : ''}
                />
                <span className="input-suffix">min</span>
              </div>
            </div>

            <div className="deadline-info">
              <p>Your transaction will revert if it is pending for more than this time.</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default DeadlineSelector

