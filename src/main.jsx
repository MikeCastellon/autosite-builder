import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './lib/AuthContext.jsx'
import AlertProvider from './components/ui/AlertProvider.jsx'
import ImpersonationBanner from './components/admin/ImpersonationBanner.jsx'

// ImpersonationBanner sits at the very top so it's never visually covered by
// AppHeader or sticky nav. It also drives the session claim on first mount in
// an impersonation tab — by living above AuthProvider's children but inside
// it, the auth listener picks up the SIGNED_IN event setSession dispatches
// and the rest of the app sees the impersonated user immediately.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <AlertProvider>
        <ImpersonationBanner />
        <App />
      </AlertProvider>
    </AuthProvider>
  </StrictMode>,
)
