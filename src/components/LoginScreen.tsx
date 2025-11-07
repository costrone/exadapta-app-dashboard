import { useState } from 'react'
import { login } from '../lib/firebase'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { ThemeToggle } from '../ui/ThemeToggle'
import { useToast } from '../ui/toast'

export function LoginScreen() {
  const { show } = useToast()
  const [isLoading, setIsLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    try {
      await login()
      show('Inicio de sesión exitoso', 'success')
    } catch (error: any) {
      show(`Error al iniciar sesión: ${error.message}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-modal">
        {/* Toggle del tema */}
        <div style={{ textAlign: 'right', marginBottom: 10 }}>
          <ThemeToggle />
        </div>
        
        <div className="auth-logo">
          <img 
            src="/images/Logoam.png" 
            alt="Logo AM" 
            style={{ width: 120, height: 120 }} 
            onError={(e) => {
              // Si no existe la imagen, ocultarla
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
          <img 
            src="/images/Logosvp.png" 
            alt="Logo SVP" 
            style={{ width: 120, height: 120 }} 
            onError={(e) => {
              // Si no existe la imagen, ocultarla
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        </div>
        
        <h1 className="auth-title">Sistema de Información Académica</h1>
        
        <div className="auth-form">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="auth-button google"
            disabled={isLoading}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '12px',
              width: '100%',
              marginTop: '20px'
            }}
          >
            <svg className="google-logo" viewBox="0 0 48 48" style={{ width: 24, height: 24 }}>
              <g>
                <path fill="#4285F4" d="M24 9.5c3.54 0 6.36 1.22 8.3 2.98l6.18-6.18C34.82 2.7 29.77 0 24 0 14.82 0 6.88 5.8 2.69 14.09l7.19 5.59C12.01 13.99 17.56 9.5 24 9.5z"/>
                <path fill="#34A853" d="M46.1 24.55c0-1.64-.15-3.21-.42-4.73H24v9.01h12.42c-.54 2.9-2.18 5.36-4.66 7.01l7.19 5.59C43.98 37.13 46.1 31.3 46.1 24.55z"/>
                <path fill="#FBBC05" d="M9.88 28.68A14.48 14.48 0 0 1 9.5 24c0-1.63.28-3.21.77-4.68l-7.19-5.59A23.93 23.93 0 0 0 0 24c0 3.93.94 7.65 2.61 10.93l7.27-6.25z"/>
                <path fill="#EA4335" d="M24 48c6.48 0 11.92-2.14 15.89-5.82l-7.27-6.25c-2.02 1.36-4.6 2.17-8.62 2.17-6.44 0-11.99-4.49-13.93-10.59l-7.19 5.59C6.88 42.2 14.82 48 24 48z"/>
              </g>
            </svg>
            {isLoading ? 'Cargando...' : 'Acceder con Google'}
          </button>
        </div>
      </div>
    </div>
  )
}

