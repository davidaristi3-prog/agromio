import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { inicializarOneSignal } from '../lib/onesignal'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = cargando
  const [perfil, setPerfil] = useState(null)

  useEffect(() => {
    // Carga inicial de sesión
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // TOKEN_REFRESHED: actualizar silenciosamente sin cerrar sesión
      // SIGNED_OUT: solo cerrar si fue explícito (no por fallo de red)
      if (event === 'SIGNED_OUT') {
        // Verificar si realmente no hay sesión guardada antes de desloguear
        supabase.auth.getSession().then(({ data }) => {
          if (!data.session) setSession(null)
        })
        return
      }
      setSession(session)
    })

    // Refrescar token cuando la app vuelve a primer plano (PWA en teléfono)
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().then(({ data: { session } }) => {
          setSession(s => {
            // Solo actualizar si hay cambio real para no re-renderizar innecesariamente
            if (!session && s) return null
            if (session && !s) return session
            return s
          })
        })
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  useEffect(() => {
    if (!session?.user) { setPerfil(null); return }
    supabase
      .from('usuarios')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setPerfil(data)
          inicializarOneSignal(session.user.id).catch(() => {})
        }
      })
  }, [session?.user?.id])

  const logout = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ session, perfil, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
