import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

/**
 * Activa MSW solo en desarrollo y si VITE_USE_MOCKS no es "false".
 * Para usar el back real: VITE_USE_MOCKS=false en .env.local
 */
async function habilitarMocks() {
  if (!import.meta.env.DEV || import.meta.env.VITE_USE_MOCKS === 'false') {
    return
  }
  const { trabajadorMocks } = await import('./mocks/navegador')
  await trabajadorMocks.start({
    // Solo se rechazan las rutas /api/ sin manejador. Las navegaciones de React,
    // los recursos estáticos y el HMR continúan normalmente (passthrough).
    onUnhandledFrame({ frame, defaults }) {
      if (frame.protocol !== 'http') return
      const { request } = frame.data as { request: Request }
      const { pathname } = new URL(request.url)
      if (pathname.startsWith('/api/')) {
        defaults.error()
        throw new Error(`[MSW] Ruta /api sin manejador: ${request.method} ${pathname}`)
      }
    },
  })
}

habilitarMocks().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  )
})
