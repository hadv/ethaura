/**
 * Generate an identicon (visual hash) for a wallet address
 * Returns an SVG string that can be used as a data URL
 */

/**
 * Simple hash function to convert address to a number
 */
function hashCode(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * Generate a muted color from an address (Ledger-style)
 */
function generateColor(address, index) {
  const hash = hashCode(address + index)
  const hue = hash % 360
  const saturation = 40 + (hash % 20) // Muted saturation: 40-60%
  const lightness = 65 + (hash % 10) // Softer tone: 65-75%
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

/**
 * Generate identicon SVG for a wallet address
 * @param {string} address - Ethereum wallet address
 * @param {number} size - Size of the identicon in pixels (default: 48)
 * @returns {string} SVG data URL
 */
export function generateIdenticon(address, size = 48) {
  if (!address) {
    // Return a default gray circle if no address
    return `data:image/svg+xml,${encodeURIComponent(`
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${size}" height="${size}" fill="#e5e7eb"/>
      </svg>
    `)}`
  }

  // Normalize address
  const normalizedAddress = address.toLowerCase().replace('0x', '')

  // Grid size (8x8 grid, mirrored for symmetry)
  const gridSize = 8
  const cellSize = size / gridSize

  // Generate background color (muted)
  const bgColor = generateColor(normalizedAddress, 0)

  // Generate multiple colors for variety (8 colors for more variation)
  const baseHue = hashCode(normalizedAddress) % 360
  const colors = []
  for (let i = 0; i < 8; i++) {
    const hue = (baseHue + i * 45) % 360 // Spread colors across spectrum (45° apart)
    const saturation = 40 + (hashCode(normalizedAddress + i) % 20) // 40-60%
    const lightness = 35 + (hashCode(normalizedAddress + i * 2) % 20) // 35-55%
    colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`)
  }

  // Generate pattern from address (32 cells for 8x4 half grid)
  // Each cell gets its own unique color based on position
  const cells = []
  for (let i = 0; i < 32; i++) {
    const hash = hashCode(normalizedAddress.slice(i * 2, i * 2 + 2) + i)
    cells.push({
      filled: hash % 2 === 0,
      colorIndex: hashCode(normalizedAddress + i) % colors.length
    })
  }

  // Build SVG
  let svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">`
  svg += `<rect width="${size}" height="${size}" fill="${bgColor}"/>`

  // Draw symmetric pattern (8x8 grid, mirrored)
  let cellIndex = 0
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < Math.ceil(gridSize / 2); x++) {
      if (cells[cellIndex].filled) {
        const xPos = x * cellSize
        const yPos = y * cellSize
        const color = colors[cells[cellIndex].colorIndex]

        // Draw left side
        svg += `<rect x="${xPos}" y="${yPos}" width="${cellSize}" height="${cellSize}" fill="${color}"/>`

        // Mirror to right side (except middle column)
        if (x < Math.floor(gridSize / 2)) {
          const mirrorX = (gridSize - 1 - x) * cellSize
          svg += `<rect x="${mirrorX}" y="${yPos}" width="${cellSize}" height="${cellSize}" fill="${color}"/>`
        }
      }
      cellIndex++
    }
  }
  
  svg += '</svg>'
  
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/**
 * React component wrapper for identicon
 */
export function Identicon({ address, size = 48, className = '' }) {
  const dataUrl = generateIdenticon(address, size)
  
  return (
    <img 
      src={dataUrl} 
      alt="Wallet identicon"
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: '50%' }}
    />
  )
}

