import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Fincas() {
  const { perfil } = useAuth()
  const [fincas, setFincas] = useState([])
  const [fincaSeleccionada, setFincaSeleccionada] = useState(null)
  const [lotes, setLotes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modalFinca, setModalFinca] = useState(false)
  const [modalLote, setModalLote] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [formFinca, setFormFinca] = useState({ nombre: '', ubicacion: '', hectareas: '' })
  const [formLote, setFormLote] = useState({ nombre: '', tipo: '' })

  const esPropietario = perfil?.rol === 'propietario'

  async function cargarFincas() {
    setCargando(true)
    const { data } = await supabase.from('fincas').select('*').order('nombre')
    setFincas(data ?? [])
    setCargando(false)
  }

  async function cargarLotes(fincaId) {
    const { data } = await supabase.from('lotes').select('*').eq('finca_id', fincaId).order('nombre')
    setLotes(data ?? [])
  }

  useEffect(() => { cargarFincas() }, [])

  useEffect(() => {
    if (fincaSeleccionada) cargarLotes(fincaSeleccionada.id)
    else setLotes([])
  }, [fincaSeleccionada])

  async function guardarFinca(e) {
    e.preventDefault()
    setGuardando(true)
    await supabase.from('fincas').insert({ ...formFinca, hectareas: formFinca.hectareas || null, activa: true })
    setGuardando(false)
    setModalFinca(false)
    setFormFinca({ nombre: '', ubicacion: '', hectareas: '' })
    cargarFincas()
  }

  async function guardarLote(e) {
    e.preventDefault()
    setGuardando(true)
    await supabase.from('lotes').insert({ ...formLote, finca_id: fincaSeleccionada.id })
    setGuardando(false)
    setModalLote(false)
    setFormLote({ nombre: '', tipo: '' })
    cargarLotes(fincaSeleccionada.id)
  }

  async function toggleActiva(finca) {
    await supabase.from('fincas').update({ activa: !finca.activa }).eq('id', finca.id)
    cargarFincas()
  }

  async function eliminarLote(loteId) {
    await supabase.from('lotes').delete().eq('id', loteId)
    cargarLotes(fincaSeleccionada.id)
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Fincas</h2>
        {esPropietario && (
          <button onClick={() => setModalFinca(true)}
            className="bg-verde-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-verde-700 transition">
            + Nueva finca
          </button>
        )}
      </div>

      {cargando ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : (
        <div className="space-y-2">
          {fincas.map(f => (
            <div key={f.id}>
              <div
                onClick={() => setFincaSeleccionada(fincaSeleccionada?.id === f.id ? null : f)}
                className={`bg-white border rounded-xl px-4 py-3 cursor-pointer transition ${
                  fincaSeleccionada?.id === f.id ? 'border-verde-400 shadow-sm' : 'border-gray-200'
                }`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏡</span>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">{f.nombre}</div>
                    <div className="text-xs text-gray-500">
                      {f.ubicacion} {f.hectareas ? `· ${f.hectareas} ha` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${f.activa ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {f.activa ? 'Activa' : 'Inactiva'}
                    </span>
                    <span className="text-gray-400 text-lg">{fincaSeleccionada?.id === f.id ? '▲' : '▼'}</span>
                  </div>
                </div>
              </div>

              {/* Panel expandido de lotes */}
              {fincaSeleccionada?.id === f.id && (
                <div className="ml-4 mt-1 bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Lotes / Potreros</span>
                    <div className="flex gap-2">
                      {esPropietario && (
                        <button onClick={() => setModalLote(true)}
                          className="text-xs bg-verde-600 text-white px-3 py-1 rounded-lg hover:bg-verde-700 transition">
                          + Lote
                        </button>
                      )}
                      {esPropietario && (
                        <button onClick={() => toggleActiva(f)}
                          className="text-xs border border-gray-300 text-gray-600 px-3 py-1 rounded-lg hover:bg-gray-100 transition">
                          {f.activa ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
                    </div>
                  </div>

                  {lotes.length === 0 ? (
                    <p className="text-xs text-gray-400">Sin lotes registrados</p>
                  ) : (
                    <div className="space-y-1">
                      {lotes.map(l => (
                        <div key={l.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-3 py-2">
                          <div>
                            <span className="text-sm font-medium text-gray-700">{l.nombre}</span>
                            {l.tipo && <span className="text-xs text-gray-400 ml-2">· {l.tipo}</span>}
                          </div>
                          {esPropietario && (
                            <button onClick={() => eliminarLote(l.id)}
                              className="text-xs text-red-400 hover:text-red-600 transition">
                              Eliminar
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal nueva finca */}
      {modalFinca && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={() => setModalFinca(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800">Nueva finca</h3>
            <form onSubmit={guardarFinca} className="space-y-3">
              <Campo label="Nombre *" value={formFinca.nombre} onChange={v => setFormFinca(f => ({...f, nombre: v}))} required />
              <Campo label="Ubicación" value={formFinca.ubicacion} onChange={v => setFormFinca(f => ({...f, ubicacion: v}))} />
              <Campo label="Hectáreas" value={formFinca.hectareas} onChange={v => setFormFinca(f => ({...f, hectareas: v}))} />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModalFinca(false)}
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

      {/* Modal nuevo lote */}
      {modalLote && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={() => setModalLote(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800">Nuevo lote en {fincaSeleccionada?.nombre}</h3>
            <form onSubmit={guardarLote} className="space-y-3">
              <Campo label="Nombre *" value={formLote.nombre} onChange={v => setFormLote(f => ({...f, nombre: v}))} required />
              <Campo label="Tipo (ej: pastoreo, maternidad)" value={formLote.tipo} onChange={v => setFormLote(f => ({...f, tipo: v}))} />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModalLote(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm">Cancelar</button>
                <button type="submit" disabled={guardando}
                  className="flex-1 bg-verde-600 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                  {guardando ? 'Guardar' : 'Guardar'}
                </button>
              </div>
            </form>
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
