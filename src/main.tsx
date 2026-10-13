import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LivePage } from './LivePage.tsx'
import { LiveControlPage } from './LiveControlPage.tsx'
import { isControlPage, isLivePage } from './lib/live.ts'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isLivePage() ? <LivePage /> : isControlPage() ? <LiveControlPage /> : <App />}
  </StrictMode>,
)
