import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Tareas() {
  const { perfil } = useAuth()
  const [tareas, setTareas] = useState([])
  const [fincas, setFincas] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [detalleId, setDetalleId] = useState(null)
  const [form, setForm] = useState({ titulo: '', descripcion: '', finca_id: '', asignado_a: '', fecha_vencimiento: '', prioridad: 'media' })
  const [guardando, setGuardando] = useState(false)
  const fotoRef = useRef()
  const vozRef = useRef()

  const esPropietarioOMayordomo = perfil?.rol === 'propietario' || perfil?.rol === 'mayordomo'

  useEffect(() => {
    Promise.all([
      supabase.from('fincas').select('id,nombre').eq('activa', true),
      supabase.from('usuarios').select('id,nombre,rol').eq('activo', true),
    ]).then(([{ data: f }, { data: u }]) => {
      setFincas(f ?? [])
      setUsuarios(u ?? [])
    })
  }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('tareas')
      .select('id,titulo,descripcion,completada,prioridad,fecha_vencimiento,foto_evidencia_url,nota_voz_url,finca_id,fincas(nombre),usuarios!tareas_asignado_a_fkey(nombre)')
      .order('completada')
      .order('fecha_vencimiento', { ascending: true })
    setTareas(data ?? [])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    await supabase.from('tareas').insert({ ...form, creado_por: perfil.id, tipo: 'puntual' })
    setGuardando(false)
    setModalAbierto(false)
    setForm({ titulo: '', descripcion: '', finca_id: '', asignado_a: '', fecha_vencimiento: '', prioridad: 'media' })
    cargar()
  }

  async function completar(tarea) {
    await supabase.from('tareas').update({ completada: true, fecha_completada: new Date().toISOString() }).eq('id', tarea.id)
    cargar()
  }

  async function subirArchivo(tareaId, campo, bucket, archivo) {
    const ext = archivo.name.split('.').pop()
    const path = `${tareaId}/${campo}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from(bucket).upload(path, archivo)
    if (error) return
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path)
    await supabase.from('tareas').update({ [campo]: publicUrl }).eq('id', tareaId)
    cargar()
  }

  const detalle = tareas.find(t => t.id === detalleId)

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Tareas</h2>
        {esPropietarioOMayordomo && (
          <button onClick={() => setModalAbierto(true)}
            className="bg-verde-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-verde-700 transition">
            + Nueva
          </button>
        )}
      </div>

      {cargando ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : tareas.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No hay tareas asignadas</p>
      ) : (
        <div className="space-y-2">
          {tareas.map(t => (
            <div key={t.id}
              onClick={() => setDetalleId(t.id)}
              className={`bg-white border rounded-xl px-4 py-3 cursor-pointer hover:shadow transition ${t.completada ? 'border-gray-100 opacity-60' : 'border-gray-200'}`}>
              <div className="flex items-start gap-3">
                <span className="text-lg mt-0.5">{t.completada ? '✅' : prioridadIcon(t.prioridad)}</span>
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold text-sm ${t.completada ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.titulo}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {t.fincas?.nombre} {t.fecha_vencimiento ? `· Vence: ${t.fecha_vencimiento}` : ''}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${prioridadColor(t.prioridad)}`}>{t.prioridad}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal detalle / completar tarea */}
      {detalleId && detalle && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={() => setDetalleId(null)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h3 className="font-bold text-gray-800 text-lg">{detalle.titulo}</h3>
              <button onClick={() => setDetalleId(null)} className="text-gray-400 text-xl">×</button>
            </div>
            {detalle.descripcion && <p className="text-gray-600 text-sm">{detalle.descripcion}</p>}
            <div className="text-xs text-gray-400 space-y-1">
              <div>Finca: {detalle.fincas?.nombre}</div>
              {detalle.fecha_vencimiento && <div>Vence: {detalle.fecha_vencimiento}</div>}
            </div>

            {/* Foto evidencia */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">📷 Foto de evidencia</p>
              {detalle.foto_evidencia_url
                ? <img src={detalle.foto_evidencia_url} alt="evidencia" className="rounded-lg w-full max-h-48 object-cover" />
                : <label className="block border-2 border-dashed border-gray-300 rounded-lg p-4 text-center text-sm text-gray-400 cursor-pointer hover:border-verde-400 transition">
                    Toca para subir foto
                    <input ref={fotoRef} type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={e => e.target.files[0] && subirArchivo(detalle.id, 'foto_evidencia_url', 'evidencias', e.target.files[0])} />
                  </label>
              }
            </div>

            {/* Nota de voz */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">🎤 Nota de voz</p>
              {detalle.nota_voz_url
                ? <audio controls src={detalle.nota_voz_url} className="w-full" />
                : <label className="block border-2 border-dashed border-gray-300 rounded-lg p-4 text-center text-sm text-gray-400 cursor-pointer hover:border-verde-400 transition">
                    Toca para subir audio
                    <input type="file" accept="audio/*" capture="microphone" className="hidden"
                      onChange={e => e.target.files[0] && subirArchivo(detalle.id, 'nota_voz_url', 'notas-voz', e.target.files[0])} />
                  </label>
              }
            </div>

            {!detalle.completada && (
              <button onClick={() => { completar(detalle); setDetalleId(null) }}
                className="w-full bg-verde-600 text-white py-3 rounded-xl font-semibold hover:bg-verde-700 transition">
                Marcar como completada ✓
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal nueva tarea */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={() => setModalAbierto(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800">Nueva tarea</h3>
            <form onSubmit={guardar} className="space-y-3">
              <Campo label="Título *" value={form.titulo} onChange={v => setForm(f => ({...f, titulo: v}))} required />
              <Campo label="Descripción" value={form.descripcion} onChange={v => setForm(f => ({...f, descripcion: v}))} />
              <Sel label="Finca *" value={form.finca_id} onChange={v => setForm(f => ({...f, finca_id: v}))} required
                opciones={fincas.map(f => ({ value: f.id, label: f.nombre }))} />
              <Sel label="Asignar a" value={form.asignado_a} onChange={v => setForm(f => ({...f, asignado_a: v}))}
                opciones={usuarios.map(u => ({ value: u.id, label: `${u.nombre} (${u.rol})` }))} />
              <Sel label="Prioridad" value={form.prioridad} onChange={v => setForm(f => ({...f, prioridad: v}))}
                opciones={[{value:'alta',label:'Alta'},{value:'media',label:'Media'},{value:'baja',label:'Baja'}]} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha límite</label>
                <input type="date" value={form.fecha_vencimiento} onChange={e => setForm(f => ({...f, fecha_vencimiento: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModalAbierto(false)}
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
    </div>
  )
}

function prioridadIcon(p) { return p === 'alta' ? '🔴' : p === 'media' ? '🟡' : '🟢' }
function prioridadColor(p) {
  return p === 'alta' ? 'bg-red-100 text-red-600' : p === 'media' ? 'bg-yellow-100 text-yellow-600' : 'bg-green-100 text-green-600'
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
function Sel({ label, value, onChange, opciones, required }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
        <option value="">Selecciona...</option>
        {opciones.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
