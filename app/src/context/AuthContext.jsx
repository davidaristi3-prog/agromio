import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { inicializarOneSignal } from '../lib/onesignal'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = cargando
  const [perfil, setPerfil] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) { setPerfil(null); return }
    supabase
      .from('usuarios')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        setPerfil(data)
        // Inicializar notificaciones push para este usuario
        inicializarOneSignal(session.user.id).catch(() => {})
      })
  }, [session])

  const logout = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ session, perfil, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
