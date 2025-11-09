import { useMemo, useState } from 'react'
import '../styles/DonutChart.css'

/**
 * PieChart Component
 * Displays a circular pie chart for portfolio distribution
 *
 * @param {Array} data - Array of { label, value, color, icon }
 * @param {number} size - Diameter of the chart in pixels (default: 200)
 */
function DonutChart({ data, size = 200 }) {
  const [hoveredSegment, setHoveredSegment] = useState(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []

    // Calculate total value
    const total = data.reduce((sum, item) => sum + item.value, 0)
    if (total === 0) return []

    // Calculate angles and paths for each segment
    let currentAngle = -90 // Start from top (12 o'clock)
    const radius = size / 2
    const centerX = radius
    const centerY = radius

    return data.map((item, index) => {
      const percentage = (item.value / total) * 100
      const angle = (percentage / 100) * 360
      const endAngle = currentAngle + angle

      // Calculate arc path for pie slice
      const startX = centerX + radius * Math.cos((currentAngle * Math.PI) / 180)
      const startY = centerY + radius * Math.sin((currentAngle * Math.PI) / 180)
      const endX = centerX + radius * Math.cos((endAngle * Math.PI) / 180)
      const endY = centerY + radius * Math.sin((endAngle * Math.PI) / 180)

      const largeArcFlag = angle > 180 ? 1 : 0

      // SVG path for pie slice (from center to arc)
      const path = [
        `M ${centerX} ${centerY}`,
        `L ${startX} ${startY}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`,
        'Z',
      ].join(' ')

      const result = {
        ...item,
        percentage,
        path,
        color: item.color || getColorForIndex(index),
      }

      currentAngle = endAngle
      return result
    })
  }, [data, size])

  if (!data || data.length === 0) {
    return (
      <div className="donut-chart-empty">
        <div className="empty-circle" style={{ width: size, height: size }}>
          <span>No Data</span>
        </div>
      </div>
    )
  }

  const handleMouseEnter = (segment, event) => {
    setHoveredSegment(segment)
    const rect = event.currentTarget.getBoundingClientRect()
    setTooltipPosition({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    })
  }

  const handleMouseMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setTooltipPosition({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    })
  }

  const handleMouseLeave = () => {
    setHoveredSegment(null)
  }

  return (
    <div className="donut-chart-container">
      {/* SVG Pie Chart */}
      <div className="donut-chart" onMouseLeave={handleMouseLeave}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {chartData.map((segment, index) => (
            <g key={index}>
              <path
                d={segment.path}
                fill={segment.color}
                className="donut-segment"
                style={{ '--segment-color': segment.color }}
                onMouseEnter={(e) => handleMouseEnter(segment, e)}
                onMouseMove={handleMouseMove}
              />
            </g>
          ))}
        </svg>

        {/* Tooltip */}
        {hoveredSegment && (
          <div
            className="pie-tooltip"
            style={{
              left: `${tooltipPosition.x + 10}px`,
              top: `${tooltipPosition.y - 10}px`,
            }}
          >
            <div className="pie-tooltip-header">
              {hoveredSegment.icon && (
                <img src={hoveredSegment.icon} alt={hoveredSegment.label} className="pie-tooltip-icon" />
              )}
              <span className="pie-tooltip-label">{hoveredSegment.label}</span>
            </div>
            <div className="pie-tooltip-value">
              ${hoveredSegment.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="pie-tooltip-percentage">
              {hoveredSegment.percentage.toFixed(1)}% of portfolio
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="donut-legend">
        {chartData.map((item, index) => (
          <div key={index} className="legend-item">
            <div className="legend-color" style={{ backgroundColor: item.color }}></div>
            <div className="legend-info">
              <div className="legend-label">
                {item.icon && (
                  <span className="legend-icon">
                    {typeof item.icon === 'string' && item.icon.startsWith('/') ? (
                      <img src={item.icon} alt={item.label} />
                    ) : (
                      item.icon
                    )}
                  </span>
                )}
                <span className="legend-name">{item.label}</span>
              </div>
              <div className="legend-value">
                <span className="legend-percentage">{item.percentage.toFixed(1)}%</span>
                <span className="legend-amount">
                  ${item.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Helper function to generate colors for segments
function getColorForIndex(index) {
  const colors = [
    '#667eea', // Purple-blue
    '#764ba2', // Purple
    '#f093fb', // Pink
    '#4facfe', // Light blue
    '#43e97b', // Green
    '#fa709a', // Pink-red
    '#fee140', // Yellow
    '#30cfd0', // Cyan
    '#a8edea', // Light cyan
    '#fbc2eb', // Light pink
  ]
  return colors[index % colors.length]
}

export default DonutChart

