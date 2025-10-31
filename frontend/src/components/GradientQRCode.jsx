import { useEffect, useRef } from 'react'
import QRCodeStyling from 'qr-code-styling'

const GradientQRCode = ({ value, size = 200 }) => {
  const qrCodeRef = useRef(null)
  const qrCodeInstance = useRef(null)

  useEffect(() => {
    if (!qrCodeInstance.current) {
      qrCodeInstance.current = new QRCodeStyling({
        width: size,
        height: size,
        data: value,
        margin: 10,
        qrOptions: {
          typeNumber: 0,
          mode: 'Byte',
          errorCorrectionLevel: 'H'
        },
        imageOptions: {
          hideBackgroundDots: true,
          imageSize: 0.4,
          margin: 0
        },
        dotsOptions: {
          type: 'rounded',
          gradient: {
            type: 'linear',
            rotation: 0.785398, // 45 degrees in radians
            colorStops: [
              { offset: 0, color: '#10b981' },    // emerald-500
              { offset: 0.5, color: '#059669' },  // emerald-600
              { offset: 1, color: '#047857' }     // emerald-700
            ]
          }
        },
        backgroundOptions: {
          color: '#ffffff'
        },
        cornersSquareOptions: {
          type: 'extra-rounded',
          gradient: {
            type: 'linear',
            rotation: 0.785398,
            colorStops: [
              { offset: 0, color: '#10b981' },
              { offset: 1, color: '#047857' }
            ]
          }
        },
        cornersDotOptions: {
          type: 'dot',
          gradient: {
            type: 'linear',
            rotation: 0.785398,
            colorStops: [
              { offset: 0, color: '#10b981' },
              { offset: 1, color: '#047857' }
            ]
          }
        }
      })
    }

    if (qrCodeRef.current) {
      qrCodeRef.current.innerHTML = ''
      qrCodeInstance.current.append(qrCodeRef.current)
    }
  }, [value, size])

  useEffect(() => {
    if (qrCodeInstance.current) {
      qrCodeInstance.current.update({
        data: value
      })
    }
  }, [value])

  return <div ref={qrCodeRef} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }} />
}

export default GradientQRCode

