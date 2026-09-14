import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useRTSASStore } from './store/useRTSASStore'

if (import.meta.env.DEV) {
  (window as unknown as { __rtsas_store: typeof useRTSASStore }).__rtsas_store = useRTSASStore;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

