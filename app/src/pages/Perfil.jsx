import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Perfil() {
  const { perfil, logout } = useAuth()
  const [cambiandoClave, setCambiandoClave] = useState(false)
  const [claveActual, setClaveActual] = useState('')
  const [claveNueva, setClaveNueva] = useState('')
  const [claveConfirm, setClaveConfirm] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState(null)

  async function cambiarClave(e) {
    e.preventDefault()
    if (claveNueva !== claveConfirm) {
      setMsg({ tipo: 'error', texto: 'Las contraseñas nuevas no coinciden' })
      return
    }
    if (claveNueva.length < 6) {
      setMsg({ tipo: 'error', texto: 'La contraseña debe tener al menos 6 caracteres' })
      return
    }
    setGuardando(true)
    setMsg(null)
    const { error } = await supabase.auth.updateUser({ password: claveNueva })
    setGuardando(false)
    if (error) {
      setMsg({ tipo: 'error', texto: error.message })
    } else {
      setMsg({ tipo: 'ok', texto: 'Contraseña actualizada correctamente' })
      setCambiandoClave(false)
      setClaveActual(''); setClaveNueva(''); setClaveConfirm('')
    }
  }

  const rolLabel = { propietario: 'Propietario', mayordomo: 'Mayordomo', trabajador: 'Trabajador' }

  return (
    <div className="space-y-5 pt-2">
      <h2 className="text-xl font-bold text-gray-800">Mi perfil</h2>

      {/* Info del usuario */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-verde-100 flex items-center justify-center text-2xl font-bold text-verde-700">
            {perfil?.nombre?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-gray-800 text-lg">{perfil?.nombre}</div>
            <div className="text-sm text-gray-500">{perfil?.email}</div>
            <span className="text-xs bg-verde-100 text-verde-700 px-2 py-0.5 rounded-full font-medium">
              {rolLabel[perfil?.rol] ?? perfil?.rol}
            </span>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-3 space-y-2">
          <InfoFila label="Nombre" valor={perfil?.nombre} />
          <InfoFila label="Correo" valor={perfil?.email} />
          <InfoFila label="Rol" valor={rolLabel[perfil?.rol] ?? perfil?.rol} />
          <InfoFila label="Teléfono" valor={perfil?.telefono ?? '—'} />
        </div>
      </div>

      {/* Cambiar contraseña */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Contraseña</h3>
          {!cambiandoClave && (
            <button onClick={() => { setCambiandoClave(true); setMsg(null) }}
              className="text-sm text-verde-600 font-medium hover:text-verde-700">
              Cambiar
            </button>
          )}
        </div>

        {msg && (
          <div className={`text-sm px-3 py-2 rounded-lg ${msg.tipo === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {msg.texto}
          </div>
        )}

        {cambiandoClave && (
          <form onSubmit={cambiarClave} className="space-y-3">
            <Campo label="Contraseña nueva" value={claveNueva} onChange={setClaveNueva} type="password" required />
            <Campo label="Confirmar contraseña nueva" value={claveConfirm} onChange={setClaveConfirm} type="password" required />
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => { setCambiandoClave(false); setMsg(null) }}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">
                Cancelar
              </button>
              <button type="submit" disabled={guardando}
                className="flex-1 bg-verde-600 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Cerrar sesión */}
      <button onClick={logout}
        className="w-full border border-red-200 text-red-500 font-semibold py-3 rounded-xl hover:bg-red-50 transition text-sm">
        Cerrar sesión
      </button>
    </div>
  )
}

function InfoFila({ label, valor }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-800 font-medium">{valor}</span>
    </div>
  )
}

function Campo({ label, value, onChange, type = 'text', required }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500" />
    </div>
  )
}
