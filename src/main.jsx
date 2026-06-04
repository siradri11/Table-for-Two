import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BootErrorBoundary } from './components/BootErrorBoundary.jsx'
import { ConfigErrorScreen } from './components/ConfigErrorScreen.jsx'
import { isSupabaseConfigured } from './supabaseClient'

const rootEl = document.getElementById('root')

function boot() {
  if (!rootEl) return

  if (!isSupabaseConfigured) {
    createRoot(rootEl).render(
      <ConfigErrorScreen details="VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY are missing. Vercel must have these set before build." />,
    )
    return
  }

  try {
    createRoot(rootEl).render(
      <StrictMode>
        <BootErrorBoundary>
          <App />
        </BootErrorBoundary>
      </StrictMode>,
    )
  } catch (err) {
    createRoot(rootEl).render(
      <ConfigErrorScreen details={err?.message || 'Unknown boot error'} />,
    )
  }
}

boot()
