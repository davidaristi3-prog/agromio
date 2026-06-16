import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const TIPOS = ['nacimiento','cambio_categoria','traslado','compra','venta','muerte','descarte']
const TIPO_ICON = {
  nacimiento: '🐣', cambio_categoria: '🔄', traslado: '🚛',
  compra: '💰', venta: '💵', muerte: '💀', descarte: '❌'
}

export default function Movimientos() {
  const { perfil } = useAuth()
  const [movimientos, setMovimientos] = useState([])
  const [fincas, setFincas] = useState([])
  const [animales, setAnimales] = useState([])
  const [lotes, setLotes] = useState([])
  const [filtroFinca, setFiltroFinca] = useState('')
  const [cargando, setCargando] = useState(true)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    animal_id: '', fecha: new Date().toISOString().split('T')[0],
    tipo: 'traslado',
    finca_origen_id: '', finca_destino_id: '',
    lote_origen_id: '', lote_destino_id: '',
    categoria_anterior: '', categoria_nueva: '',
    valor: '', descripcion: ''
  })

  useEffect(() => {
    supabase.from('fincas').select('id,nombre').eq('activa', true).then(({ data }) => setFincas(data ?? []))
  }, [])

  useEffect(() => {
    if (!form.finca_origen_id) { setAnimales([]); return }
    supabase.from('animales').select('id,identificacion,nombre,tipo,lote_id')
      .eq('finca_id', form.finca_origen_id).eq('activa', true).order('identificacion')
      .then(({ data }) => setAnimales(data ?? []))
    supabase.from('lotes').select('id,nombre').eq('finca_id', form.finca_origen_id)
      .then(({ data }) => setLotes(data ?? []))
  }, [form.finca_origen_id])

  async function cargar() {
    setCargando(true)
    let q = supabase.from('movimientos_hato')
      .select('id,fecha,tipo,valor,descripcion,categoria_anterior,categoria_nueva,animales(identificacion,nombre),fincas!movimientos_hato_finca_origen_id_fkey(nombre),finca_destino:fincas!movimientos_hato_finca_destino_id_fkey(nombre)')
      .order('fecha', { ascending: false }).limit(50)
    if (filtroFinca) q = q.or(`finca_origen_id.eq.${filtroFinca},finca_destino_id.eq.${filtroFinca}`)
    const { data } = await q
    setMovimientos(data ?? [])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [filtroFinca])

  async function guardar(e) {
    e.preventDefault()
    setGuardando(true)
    const payload = {
      animal_id: form.animal_id || null,
      fecha: form.fecha,
      tipo: form.tipo,
      finca_origen_id: form.finca_origen_id || null,
      finca_destino_id: form.finca_destino_id || null,
      lote_origen_id: form.lote_origen_id || null,
      lote_destino_id: form.lote_destino_id || null,
      categoria_anterior: form.categoria_anterior || null,
      categoria_nueva: form.categoria_nueva || null,
      valor: form.valor ? Number(form.valor) : null,
      descripcion: form.descripcion || null,
      registrado_por: perfil.id,
    }
    await supabase.from('movimientos_hato').insert(payload)

    // Si es traslado, actualizar finca del animal
    if (form.tipo === 'traslado' && form.animal_id && form.finca_destino_id) {
      await supabase.from('animales').update({
        finca_id: form.finca_destino_id,
        lote_id: form.lote_destino_id || null,
      }).eq('id', form.animal_id)
    }
    // Si es muerte o descarte, desactivar animal
    if ((form.tipo === 'muerte' || form.tipo === 'descarte') && form.animal_id) {
      await supabase.from('animales').update({ activa: false }).eq('id', form.animal_id)
    }
    // Si es venta, desactivar animal
    if (form.tipo === 'venta' && form.animal_id) {
      await supabase.from('animales').update({ activa: false }).eq('id', form.animal_id)
    }

    setGuardando(false)
    setModalAbierto(false)
    setForm({ animal_id: '', fecha: new Date().toISOString().split('T')[0], tipo: 'traslado', finca_origen_id: '', finca_destino_id: '', lote_origen_id: '', lote_destino_id: '', categoria_anterior: '', categoria_nueva: '', valor: '', descripcion: '' })
    cargar()
  }

  const necesitaDestino = ['traslado', 'venta', 'compra'].includes(form.tipo)
  const necesitaValor = ['compra', 'venta'].includes(form.tipo)

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">Movimientos</h2>
        <button onClick={() => setModalAbierto(true)}
          className="bg-verde-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-verde-700 transition">
          + Registrar
        </button>
      </div>

      <select value={filtroFinca} onChange={e => setFiltroFinca(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
        <option value="">Todas las fincas</option>
        {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
      </select>

      {cargando ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : movimientos.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No hay movimientos registrados</p>
      ) : (
        <div className="space-y-2">
          {movimientos.map(m => (
            <div key={m.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-start gap-3">
              <span className="text-xl mt-0.5">{TIPO_ICON[m.tipo] ?? '📋'}</span>
              <div className="flex-1">
                <div className="font-semibold text-sm text-gray-800">
                  {m.animales ? `${m.animales.identificacion}${m.animales.nombre ? ` · ${m.animales.nombre}` : ''}` : '—'}
                </div>
                <div className="text-xs text-gray-500">
                  {m.fecha} · {m.tipo}
                  {m.fincas?.nombre && ` · ${m.fincas.nombre}`}
                  {m.finca_destino?.nombre && ` → ${m.finca_destino.nombre}`}
                </div>
                {m.categoria_anterior && (
                  <div className="text-xs text-gray-500">{m.categoria_anterior} → {m.categoria_nueva}</div>
                )}
                {m.valor && <div className="text-xs text-verde-700 font-medium">${Number(m.valor).toLocaleString('es-CO')}</div>}
                {m.descripcion && <div className="text-xs text-gray-500 mt-0.5">{m.descripcion}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={() => setModalAbierto(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800">Registrar movimiento</h3>
            <form onSubmit={guardar} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input type="date" value={form.fecha} onChange={e => setForm(f => ({...f, fecha: e.target.value}))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500" />
                </div>
                <Sel label="Tipo *" value={form.tipo} onChange={v => setForm(f => ({...f, tipo: v}))} required
                  opciones={TIPOS.map(t => ({value: t, label: t.replace('_',' ')}))} />
              </div>

              <Sel label="Finca origen" value={form.finca_origen_id} onChange={v => setForm(f => ({...f, finca_origen_id: v, animal_id: '', lote_origen_id: ''}))}
                opciones={fincas.map(f => ({value: f.id, label: f.nombre}))} />

              {animales.length > 0 && (
                <Sel label="Animal" value={form.animal_id} onChange={v => setForm(f => ({...f, animal_id: v}))}
                  opciones={animales.map(a => ({value: a.id, label: `${a.identificacion}${a.nombre ? ` · ${a.nombre}` : ''}`}))} />
              )}

              {lotes.length > 0 && (
                <Sel label="Lote origen" value={form.lote_origen_id} onChange={v => setForm(f => ({...f, lote_origen_id: v}))}
                  opciones={lotes.map(l => ({value: l.id, label: l.nombre}))} />
              )}

              {necesitaDestino && (
                <>
                  <Sel label="Finca destino" value={form.finca_destino_id} onChange={v => setForm(f => ({...f, finca_destino_id: v}))}
                    opciones={fincas.map(f => ({value: f.id, label: f.nombre}))} />
                  {lotes.length > 0 && (
                    <Sel label="Lote destino" value={form.lote_destino_id} onChange={v => setForm(f => ({...f, lote_destino_id: v}))}
                      opciones={lotes.map(l => ({value: l.id, label: l.nombre}))} />
                  )}
                </>
              )}

              {form.tipo === 'cambio_categoria' && (
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Categoría anterior" value={form.categoria_anterior} onChange={v => setForm(f => ({...f, categoria_anterior: v}))} />
                  <Campo label="Categoría nueva" value={form.categoria_nueva} onChange={v => setForm(f => ({...f, categoria_nueva: v}))} />
                </div>
              )}

              {necesitaValor && (
                <Campo label="Valor ($)" value={form.valor} onChange={v => setForm(f => ({...f, valor: v}))} />
              )}

              <Campo label="Descripción" value={form.descripcion} onChange={v => setForm(f => ({...f, descripcion: v}))} />

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
