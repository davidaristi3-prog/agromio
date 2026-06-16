import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Ordenos() {
  const { perfil } = useAuth()
  const [registros, setRegistros] = useState([])
  const [fincas, setFincas] = useState([])
  const [animales, setAnimales] = useState([])
  const [filtroFinca, setFiltroFinca] = useState('')
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    finca_id: '', animal_id: '', fecha: new Date().toISOString().split('T')[0],
    numero_ordeno: '1', litros: ''
  })

  const hoy = new Date().toISOString().split('T')[0]

  useEffect(() => {
    supabase.from('fincas').select('id,nombre').eq('activa', true).then(({ data }) => setFincas(data ?? []))
  }, [])

  useEffect(() => {
    if (!form.finca_id) { setAnimales([]); return }
    supabase.from('animales').select('id,identificacion,nombre')
      .eq('finca_id', form.finca_id).eq('activa', true).eq('estado_productivo', 'en_ordeno')
      .order('identificacion')
      .then(({ data }) => setAnimales(data ?? []))
  }, [form.finca_id])

  async function cargar() {
    setCargando(true)
    let q = supabase.from('ordenos')
      .select('id,fecha,litros,numero_ordeno,finca_id,fincas(nombre),animales(identificacion,nombre)')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50)
    if (filtroFinca) q = q.eq('finca_id', filtroFinca)
    const { data } = await q
    setRegistros(data ?? [])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [filtroFinca])

  // Totales de hoy por finca
  const litrosHoy = registros.filter(r => r.fecha === hoy).reduce((s, r) => s + Number(r.litros), 0)

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    const { error } = await supabase.from('ordenos').insert({
      ...form,
      animal_id: form.animal_id || null,
      lote_id: form.lote_id || null,
      litros: Number(form.litros),
      numero_ordeno: Number(form.numero_ordeno),
      registrado_por: perfil.id,
      creado_por: perfil.id,
      estado: perfil.rol === 'trabajador' ? 'pendiente' : 'aprobado',
    })
    if (error) { console.error('Error ordeño:', error); setGuardando(false); return }
    setGuardando(false)
    setModalAbierto(false)
    setForm(f => ({ ...f, animal_id: '', litros: '' }))
    cargar()
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Ordeños</h2>
        <button onClick={() => setModalAbierto(true)}
          className="bg-verde-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-verde-700 transition">
          + Registrar
        </button>
      </div>

      {/* Resumen del día */}
      <div className="bg-verde-50 border border-verde-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-3xl">🥛</span>
        <div>
          <div className="text-2xl font-bold text-verde-800">{litrosHoy.toFixed(1)} L</div>
          <div className="text-xs text-verde-600">Total registrado hoy</div>
        </div>
      </div>

      {/* Filtro finca */}
      <select value={filtroFinca} onChange={e => setFiltroFinca(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
        <option value="">Todas las fincas</option>
        {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
      </select>

      {/* Lista */}
      {cargando ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : registros.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No hay registros de ordeños</p>
      ) : (
        <div className="space-y-2">
          {registros.map(r => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-xl">🥛</span>
              <div className="flex-1">
                <div className="font-semibold text-sm text-gray-800">
                  {r.animales ? `${r.animales.identificacion}${r.animales.nombre ? ` · ${r.animales.nombre}` : ''}` : 'Finca (sin animal)'}
                </div>
                <div className="text-xs text-gray-500">{r.fincas?.nombre} · {r.fecha} · Ordeño #{r.numero_ordeno}</div>
              </div>
              <div className="text-lg font-bold text-verde-700">{Number(r.litros).toFixed(1)} L</div>
            </div>
          ))}
        </div>
      )}

      {/* Modal registrar */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={() => setModalAbierto(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800">Registrar ordeño</h3>
            <form onSubmit={guardar} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Finca *</label>
                <select required value={form.finca_id} onChange={e => setForm(f => ({...f, finca_id: e.target.value, animal_id: ''}))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
                  <option value="">Selecciona...</option>
                  {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                </select>
              </div>
              {animales.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Animal (opcional)</label>
                  <select value={form.animal_id} onChange={e => setForm(f => ({...f, animal_id: e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
                    <option value="">General (sin animal específico)</option>
                    {animales.map(a => <option key={a.id} value={a.id}>{a.identificacion}{a.nombre ? ` · ${a.nombre}` : ''}</option>)}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input type="date" value={form.fecha} onChange={e => setForm(f => ({...f, fecha: e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ordeño #</label>
                  <select value={form.numero_ordeno} onChange={e => setForm(f => ({...f, numero_ordeno: e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
                    <option value="1">1° ordeño</option>
                    <option value="2">2° ordeño</option>
                    <option value="3">3° ordeño</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Litros *</label>
                <input type="number" step="0.1" min="0" required value={form.litros}
                  onChange={e => setForm(f => ({...f, litros: e.target.value}))}
                  placeholder="0.0"
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
