import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const TIPOS = ['tratamiento','vacuna','diagnostico','desparasitacion','otro']

export default function Sanidad() {
  const { perfil } = useAuth()
  const [eventos, setEventos] = useState([])
  const [fincas, setFincas] = useState([])
  const [animalesFinca, setAnimalesFinca] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    finca_id: '', animal_id: '', fecha: new Date().toISOString().split('T')[0],
    tipo: 'tratamiento', diagnostico: '', medicamento: '', requiere_retiro: false,
    fecha_fin_retiro: '', descripcion: ''
  })

  useEffect(() => {
    supabase.from('fincas').select('id,nombre').eq('activa', true).then(({ data }) => setFincas(data ?? []))
  }, [])

  useEffect(() => {
    if (!form.finca_id) { setAnimalesFinca([]); return }
    supabase.from('animales').select('id,identificacion,nombre').eq('finca_id', form.finca_id).eq('activa', true)
      .order('identificacion').then(({ data }) => setAnimalesFinca(data ?? []))
  }, [form.finca_id])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase.from('eventos_sanitarios')
      .select('id,fecha,tipo,diagnostico,medicamento,requiere_retiro,fecha_fin_retiro,fincas(nombre),animales(identificacion,nombre)')
      .order('fecha', { ascending: false }).limit(40)
    setEventos(data ?? [])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    await supabase.from('eventos_sanitarios').insert({
      ...form,
      animal_id: form.animal_id || null,
      fecha_fin_retiro: form.fecha_fin_retiro || null,
      registrado_por: perfil.id,
    })
    // Si requiere retiro, actualizar el animal
    if (form.requiere_retiro && form.animal_id) {
      await supabase.from('animales').update({
        en_retiro_leche: true,
        fecha_fin_retiro: form.fecha_fin_retiro || null,
      }).eq('id', form.animal_id)
    }
    setGuardando(false)
    setModalAbierto(false)
    setForm({ finca_id: '', animal_id: '', fecha: new Date().toISOString().split('T')[0], tipo: 'tratamiento', diagnostico: '', medicamento: '', requiere_retiro: false, fecha_fin_retiro: '', descripcion: '' })
    cargar()
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Sanidad</h2>
        <button onClick={() => setModalAbierto(true)}
          className="bg-verde-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-verde-700 transition">
          + Registrar
        </button>
      </div>

      {cargando ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : eventos.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No hay eventos sanitarios</p>
      ) : (
        <div className="space-y-2">
          {eventos.map(ev => (
            <div key={ev.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-start gap-3">
              <span className="text-xl mt-0.5">💉</span>
              <div className="flex-1">
                <div className="font-semibold text-sm text-gray-800">
                  {ev.animales ? `${ev.animales.identificacion}${ev.animales.nombre ? ` · ${ev.animales.nombre}` : ''}` : ev.fincas?.nombre}
                </div>
                <div className="text-xs text-gray-500">{ev.fecha} · {ev.tipo}</div>
                {ev.diagnostico && <div className="text-xs text-gray-600 mt-0.5">{ev.diagnostico}</div>}
                {ev.medicamento && <div className="text-xs text-gray-600">{ev.medicamento}</div>}
                {ev.requiere_retiro && (
                  <span className="inline-block mt-1 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                    Retiro hasta {ev.fecha_fin_retiro ?? '?'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={() => setModalAbierto(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800">Evento sanitario</h3>
            <form onSubmit={guardar} className="space-y-3">
              <Sel label="Finca *" value={form.finca_id} onChange={v => setForm(f => ({...f, finca_id: v, animal_id: ''}))} required
                opciones={fincas.map(f => ({value: f.id, label: f.nombre}))} />
              {animalesFinca.length > 0 && (
                <Sel label="Animal" value={form.animal_id} onChange={v => setForm(f => ({...f, animal_id: v}))}
                  opciones={animalesFinca.map(a => ({value: a.id, label: `${a.identificacion}${a.nombre ? ` · ${a.nombre}` : ''}`}))} />
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input type="date" value={form.fecha} onChange={e => setForm(f => ({...f, fecha: e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500" />
                </div>
                <Sel label="Tipo" value={form.tipo} onChange={v => setForm(f => ({...f, tipo: v}))}
                  opciones={TIPOS.map(t => ({value: t, label: t}))} />
              </div>
              <Campo label="Diagnóstico" value={form.diagnostico} onChange={v => setForm(f => ({...f, diagnostico: v}))} />
              <Campo label="Medicamento" value={form.medicamento} onChange={v => setForm(f => ({...f, medicamento: v}))} />
              <Campo label="Descripción" value={form.descripcion} onChange={v => setForm(f => ({...f, descripcion: v}))} />
              <div className="flex items-center gap-2">
                <input type="checkbox" id="retiro" checked={form.requiere_retiro}
                  onChange={e => setForm(f => ({...f, requiere_retiro: e.target.checked}))}
                  className="w-4 h-4 accent-verde-600" />
                <label htmlFor="retiro" className="text-sm text-gray-700">Requiere retiro de leche</label>
              </div>
              {form.requiere_retiro && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin retiro</label>
                  <input type="date" value={form.fecha_fin_retiro} onChange={e => setForm(f => ({...f, fecha_fin_retiro: e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500" />
                </div>
              )}
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
