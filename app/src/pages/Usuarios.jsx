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

export default function Usuarios() {
  const { perfil } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [fincas, setFincas] = useState([])
  const [asignaciones, setAsignaciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modalUsuario, setModalUsuario] = useState(false)
  const [modalAsignacion, setModalAsignacion] = useState(null) // usuario seleccionado
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({ nombre: '', email: '', rol: 'trabajador' })
  const [fincaAsignar, setFincaAsignar] = useState('')

  const esPropietario = perfil?.rol === 'propietario'

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

  async function guardarUsuario(e) {
    e.preventDefault()
    setGuardando(true)
    // Solo inserta el perfil — el acceso de Auth lo crea el propietario manualmente
    // o se puede usar Supabase Admin API. Por ahora creamos el perfil vacío.
    await supabase.from('usuarios').insert({ ...form, activo: true })
    setGuardando(false)
    setModalUsuario(false)
    setForm({ nombre: '', email: '', rol: 'trabajador' })
    cargar()
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
    await supabase.from('asignaciones_finca')
      .delete().eq('usuario_id', usuarioId).eq('finca_id', fincaId)
    cargar()
  }

  async function toggleActivo(usuario) {
    await supabase.from('usuarios').update({ activo: !usuario.activo }).eq('id', usuario.id)
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
        {esPropietario && (
          <button onClick={() => setModalUsuario(true)}
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
            <div key={u.id} className={`bg-white border rounded-xl px-4 py-3 space-y-2 ${!u.activo ? 'opacity-50' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-verde-100 flex items-center justify-center text-verde-700 font-bold text-sm">
                  {u.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800 text-sm">{u.nombre}</div>
                  <div className="text-xs text-gray-500">{u.email}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROL_COLOR[u.rol] ?? 'bg-gray-100 text-gray-600'}`}>
                  {u.rol}
                </span>
              </div>

              {/* Fincas asignadas */}
              <div className="flex flex-wrap gap-1 pl-12">
                {fincasDeUsuario(u.id).map(f => (
                  <span key={f.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {f.nombre}
                    {esPropietario && u.rol !== 'propietario' && (
                      <button onClick={() => quitarAsignacion(u.id, f.id)} className="text-gray-400 hover:text-red-500 ml-0.5">×</button>
                    )}
                  </span>
                ))}
                {esPropietario && u.rol !== 'propietario' && (
                  <button onClick={() => setModalAsignacion(u)}
                    className="text-xs text-verde-600 hover:underline">+ Finca</button>
                )}
              </div>

              {esPropietario && u.id !== perfil.id && (
                <div className="pl-12">
                  <button onClick={() => toggleActivo(u)}
                    className="text-xs text-gray-400 hover:text-gray-600 transition">
                    {u.activo ? 'Desactivar usuario' : 'Activar usuario'}
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
            <p className="text-xs text-gray-500">
              Después de guardar, ve a Supabase → Authentication → Add user para crear su acceso con ese mismo email.
            </p>
            <form onSubmit={guardarUsuario} className="space-y-3">
              <Campo label="Nombre completo *" value={form.nombre} onChange={v => setForm(f => ({...f, nombre: v}))} required />
              <Campo label="Email *" value={form.email} onChange={v => setForm(f => ({...f, email: v}))} required />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol *</label>
                <select value={form.rol} onChange={e => setForm(f => ({...f, rol: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModalUsuario(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">Cancelar</button>
                <button type="submit" disabled={guardando}
                  className="flex-1 bg-verde-600 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
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
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
                <option value="">Selecciona una finca...</option>
                {fincas.filter(f => !fincasDeUsuario(modalAsignacion.id).find(x => x.id === f.id)).map(f => (
                  <option key={f.id} value={f.id}>{f.nombre}</option>
                ))}
              </select>
              <button onClick={() => asignarFinca(modalAsignacion)} disabled={!fincaAsignar || guardando}
                className="bg-verde-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                Asignar
              </button>
            </div>
            <button onClick={() => setModalAsignacion(null)}
              className="w-full border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Campo({ label, value, onChange, required }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500" />
    </div>
  )
}
