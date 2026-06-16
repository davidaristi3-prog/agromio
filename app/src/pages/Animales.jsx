import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const TIPOS = ['vaca','novilla','ternera','ternero','toro']
const ESTADOS = ['en_ordeno','seca','pre_parto','no_aplica']

export default function Animales() {
  const [animales, setAnimales] = useState([])
  const [fincas, setFincas] = useState([])
  const [filtroFinca, setFiltroFinca] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [form, setForm] = useState({ identificacion: '', nombre: '', tipo: 'vaca', raza: '', finca_id: '' })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase.from('fincas').select('id,nombre').eq('activa', true).then(({ data, error }) => {
      console.log('FINCAS data:', data, 'error:', error)
      setFincas(data ?? [])
    })
  }, [])

  useEffect(() => {
    setCargando(true)
    let q = supabase.from('animales').select('id,identificacion,nombre,tipo,raza,estado_productivo,en_retiro_leche,finca_id,fincas(nombre)').eq('activa', true).order('identificacion')
    if (filtroFinca) q = q.eq('finca_id', filtroFinca)
    q.then(({ data }) => { setAnimales(data ?? []); setCargando(false) })
  }, [filtroFinca])

  const visibles = animales.filter(a =>
    !busqueda || a.identificacion.toLowerCase().includes(busqueda.toLowerCase()) || (a.nombre ?? '').toLowerCase().includes(busqueda.toLowerCase())
  )

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    await supabase.from('animales').insert({ ...form, activa: true })
    setGuardando(false)
    setModalAbierto(false)
    setForm({ identificacion: '', nombre: '', tipo: 'vaca', raza: '', finca_id: '' })
    // recargar
    setFiltroFinca(f => f)
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Animales</h2>
        <button onClick={() => setModalAbierto(true)}
          className="bg-verde-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-verde-700 transition">
          + Agregar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por ID o nombre..."
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500" />
        <select value={filtroFinca} onChange={e => setFiltroFinca(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
          <option value="">Todas las fincas</option>
          {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
        </select>
      </div>

      {/* Lista */}
      {cargando ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : visibles.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No hay animales registrados</p>
      ) : (
        <div className="space-y-2">
          {visibles.map(a => (
            <div key={a.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-2xl">{a.tipo === 'toro' ? '🐂' : '🐄'}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-800 text-sm">{a.identificacion} {a.nombre ? `· ${a.nombre}` : ''}</div>
                <div className="text-xs text-gray-500">{a.fincas?.nombre} · {a.tipo} {a.raza ? `· ${a.raza}` : ''}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {a.estado_productivo && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    a.estado_productivo === 'en_ordeno' ? 'bg-green-100 text-green-700' :
                    a.estado_productivo === 'seca' ? 'bg-gray-100 text-gray-600' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>{a.estado_productivo.replace('_',' ')}</span>
                )}
                {a.en_retiro_leche && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Retiro</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal nuevo animal */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={() => setModalAbierto(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800">Nuevo animal</h3>
            <form onSubmit={guardar} className="space-y-3">
              <Campo label="Identificación *" value={form.identificacion} onChange={v => setForm(f => ({...f, identificacion: v}))} required />
              <Campo label="Nombre (opcional)" value={form.nombre} onChange={v => setForm(f => ({...f, nombre: v}))} />
              <Campo label="Raza" value={form.raza} onChange={v => setForm(f => ({...f, raza: v}))} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select value={form.tipo} onChange={e => setForm(f => ({...f, tipo: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Finca *</label>
                <select required value={form.finca_id} onChange={e => setForm(f => ({...f, finca_id: e.target.value}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
                  <option value="">Selecciona...</option>
                  {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                </select>
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

function Campo({ label, value, onChange, required }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500" />
    </div>
  )
}
