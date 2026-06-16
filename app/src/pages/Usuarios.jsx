import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const ROLES = ['mayordomo', 'trabajador', 'veterinario']
const ROL_COLOR = {
  propietario: 'bg-purple-100 text-purple-700',
  mayordomo:   'bg-blue-100 text-blue-700',
  trabajador:  'bg-green-100 text-green-700',
  veterinario: 'bg-orange-100 text-orange-700',
}
const ROL_LABEL = {
  propietario: 'Propietario',
  mayordomo:   'Mayordomo',
  trabajador:  'Trabajador',
  veterinario: 'Veterinario',
}

export default function Usuarios() {
  const { perfil } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [fincas, setFincas] = useState([])
  const [asignaciones, setAsignaciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modalUsuario, setModalUsuario] = useState(false)
  const [modalAsignacion, setModalAsignacion] = useState(null)
  const [modalEliminar, setModalEliminar] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [fincaAsignar, setFincaAsignar] = useState('')
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'trabajador' })

  const puedeGestionar = ['propietario', 'mayordomo'].includes(perfil?.rol)

  async function cargar() {
    setCargando(true)
    const [{ data: u }, { data: f }, { data: a }] = await Promise.all([
      supabase.from('usuarios').select('*').order('nombre'),
      supabase.from('fincas').select('id,nombre').eq('activa', true).order('nombre'),
      supabase.from('asignaciones_finca').select('*'),
    ])
    setUsuarios(u ?? [])
    setFincas(f ?? [])
    setAsignaciones(a ?? [])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  async function invocarFuncion(body) {
    const { data, error: fnErr } = await supabase.functions.invoke('gestionar-usuario', { body })
    if (data?.error) throw new Error(data.error)
    if (fnErr) {
      // Intentar extraer el mensaje real del cuerpo de la respuesta
      try {
        const json = await fnErr.context?.json?.()
        if (json?.error) throw new Error(json.error)
      } catch (e) {
        if (e instanceof Error && e.message !== fnErr.message) throw e
      }
      throw new Error(fnErr.message)
    }
    return data
  }

  async function guardarUsuario(e) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    try {
      await invocarFuncion({ accion: 'crear', ...form })
      setModalUsuario(false)
      setForm({ nombre: '', email: '', password: '', rol: 'trabajador' })
      cargar()
    } catch (e) {
      setError(e.message)
    }
    setGuardando(false)
  }

  async function eliminarUsuario(usuario) {
    setGuardando(true)
    try {
      await invocarFuncion({ accion: 'eliminar', user_id: usuario.id })
      setModalEliminar(null)
      cargar()
    } catch (e) {
      alert(e.message)
    }
    setGuardando(false)
  }

  async function asignarFinca(usuario) {
    if (!fincaAsignar) return
    setGuardando(true)
    await supabase.from('asignaciones_finca').upsert(
      { usuario_id: usuario.id, finca_id: fincaAsignar, es_principal: false },
      { onConflict: 'usuario_id,finca_id' }
    )
    setGuardando(false)
    setFincaAsignar('')
    cargar()
  }

  async function quitarAsignacion(usuarioId, fincaId) {
    await supabase.from('asignaciones_finca').delete().eq('usuario_id', usuarioId).eq('finca_id', fincaId)
    cargar()
  }

  function fincasDeUsuario(usuarioId) {
    const ids = asignaciones.filter(a => a.usuario_id === usuarioId).map(a => a.finca_id)
    return fincas.filter(f => ids.includes(f.id))
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Equipo</h2>
        {puedeGestionar && (
          <button onClick={() => { setError(''); setModalUsuario(true) }}
            className="bg-verde-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-verde-700 transition">
            + Agregar
          </button>
        )}
      </div>

      {cargando ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : (
        <div className="space-y-2">
          {usuarios.map(u => (
            <div key={u.id} className="bg-white border border-gray-200 rounded-2xl px-4 py-3 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-verde-100 flex items-center justify-center text-verde-700 font-bold text-sm flex-shrink-0">
                  {u.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800 text-sm">{u.nombre}</div>
                  <div className="text-xs text-gray-500">{u.email}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ROL_COLOR[u.rol] ?? 'bg-gray-100 text-gray-600'}`}>
                  {ROL_LABEL[u.rol] ?? u.rol}
                </span>
              </div>

              {/* Fincas asignadas */}
              <div className="flex flex-wrap gap-1 pl-13">
                {fincasDeUsuario(u.id).map(f => (
                  <span key={f.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {f.nombre}
                    {puedeGestionar && u.rol !== 'propietario' && (
                      <button onClick={() => quitarAsignacion(u.id, f.id)} className="text-gray-400 hover:text-red-500 ml-0.5 leading-none">×</button>
                    )}
                  </span>
                ))}
                {puedeGestionar && u.rol !== 'propietario' && (
                  <button onClick={() => setModalAsignacion(u)}
                    className="text-xs text-verde-600 hover:underline">+ Finca</button>
                )}
              </div>

              {/* Acciones */}
              {puedeGestionar && u.id !== perfil.id && u.rol !== 'propietario' && (
                <div className="pl-13 pt-1">
                  <button onClick={() => setModalEliminar(u)}
                    className="text-xs text-red-400 hover:text-red-600 transition">
                    Eliminar usuario
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal nuevo usuario */}
      {modalUsuario && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={() => setModalUsuario(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800">Nuevo miembro del equipo</h3>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={guardarUsuario} className="space-y-3">
              <Campo label="Nombre completo *" value={form.nombre}
                onChange={v => setForm(f => ({...f, nombre: v}))} required />
              <Campo label="Email *" type="email" value={form.email}
                onChange={v => setForm(f => ({...f, email: v}))} required />
              <Campo label="Contraseña *" type="password" value={form.password}
                onChange={v => setForm(f => ({...f, password: v}))} required
                placeholder="Mínimo 6 caracteres" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol *</label>
                <select value={form.rol} onChange={e => setForm(f => ({...f, rol: e.target.value}))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
                  {ROLES.map(r => <option key={r} value={r}>{ROL_LABEL[r] ?? r}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModalUsuario(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl text-sm">Cancelar</button>
                <button type="submit" disabled={guardando}
                  className="flex-1 bg-verde-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50">
                  {guardando ? 'Creando...' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar */}
      {modalEliminar && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={() => setModalEliminar(null)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800">Eliminar usuario</h3>
            <p className="text-sm text-gray-600">
              ¿Seguro que quieres eliminar a <span className="font-semibold">{modalEliminar.nombre}</span>?
              Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setModalEliminar(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl text-sm">Cancelar</button>
              <button onClick={() => eliminarUsuario(modalEliminar)} disabled={guardando}
                className="flex-1 bg-red-500 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50">
                {guardando ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal asignar finca */}
      {modalAsignacion && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={() => setModalAsignacion(null)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800">Asignar finca a {modalAsignacion.nombre}</h3>
            <div className="flex gap-2">
              <select value={fincaAsignar} onChange={e => setFincaAsignar(e.target.value)}
                className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
                <option value="">Selecciona una finca...</option>
                {fincas.filter(f => !fincasDeUsuario(modalAsignacion.id).find(x => x.id === f.id)).map(f => (
                  <option key={f.id} value={f.id}>{f.nombre}</option>
                ))}
              </select>
              <button onClick={() => asignarFinca(modalAsignacion)} disabled={!fincaAsignar || guardando}
                className="bg-verde-600 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50">
                Asignar
              </button>
            </div>
            <button onClick={() => setModalAsignacion(null)}
              className="w-full border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Campo({ label, value, onChange, required, type = 'text', placeholder }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        required={required} placeholder={placeholder}
        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500" />
    </div>
  )
}
