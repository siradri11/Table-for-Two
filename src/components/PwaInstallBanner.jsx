import { useEffect, useState } from 'react'
import './PwaInstallBanner.css'

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('pwa-dismissed') === '1')
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setDismissed(true)
    localStorage.setItem('pwa-dismissed', '1')
  }

  const dismiss = () => {
    setDismissed(true)
    localStorage.setItem('pwa-dismissed', '1')
  }

  if (dismissed) return null

  if (isIos && !window.matchMedia('(display-mode: standalone)').matches) {
    return (
      <div className="pwa-banner">
        <p>Install: tap Share → Add to Home Screen</p>
        <button type="button" onClick={dismiss}>Got it</button>
      </div>
    )
  }

  if (!deferredPrompt) return null

  return (
    <div className="pwa-banner">
      <p>Install Table for Two on your home screen</p>
      <button type="button" onClick={install}>Install</button>
      <button type="button" className="pwa-banner__dismiss" onClick={dismiss}>×</button>
    </div>
  )
}
