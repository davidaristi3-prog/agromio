import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ── Catálogo de indicadores con cálculo automático ───────────────────────────
// estado:true  → solo cuenta registros aprobados (ordeños/eventos)
// agg: 'sum' (suma un campo) | 'count' (cuenta filas)
const INDICADORES = {
  litros_dia:      { nombre: 'Litros por día',                categoria: 'produccion',   unidad: 'L',           periodo: 'diario',  direccion: 'mayor', tabla: 'ordenos', agg: 'sum', campo: 'litros', estado: true },
  litros_mes:      { nombre: 'Litros por mes',                categoria: 'produccion',   unidad: 'L',           periodo: 'mensual', direccion: 'mayor', tabla: 'ordenos', agg: 'sum', campo: 'litros', estado: true },
  nacimientos_mes: { nombre: 'Nacimientos por mes',           categoria: 'reproduccion', unidad: 'nacimientos', periodo: 'mensual', direccion: 'mayor', tabla: 'eventos_reproductivos', agg: 'count', tipo: 'parto', estado: true },
  nacimientos_ano: { nombre: 'Nacimientos por año',           categoria: 'reproduccion', unidad: 'nacimientos', periodo: 'anual',   direccion: 'mayor', tabla: 'eventos_reproductivos', agg: 'count', tipo: 'parto', estado: true },
  prenez_mes:      { nombre: 'Preñeces confirmadas por mes',  categoria: 'reproduccion', unidad: 'preñeces',    periodo: 'mensual', direccion: 'mayor', tabla: 'eventos_reproductivos', agg: 'count', tipo: 'diagnostico_prenez', resultadoPositivo: true, estado: true },
  servicios_mes:   { nombre: 'Servicios / inseminaciones por mes', categoria: 'reproduccion', unidad: 'servicios', periodo: 'mensual', direccion: 'mayor', tabla: 'eventos_reproductivos', agg: 'count', tipo: 'servicio', estado: true },
  muertes_mes:     { nombre: 'Muertes (mortandad) por mes',   categoria: 'sanidad',      unidad: 'animales',    periodo: 'mensual', direccion: 'menor', tabla: 'movimientos_hato', agg: 'count', tipo: 'muerte' },
  personalizada:   { nombre: '', categoria: 'otro', unidad: '', periodo: 'mensual', direccion: 'mayor', manual: true },
}

const CAT_LABEL = { produccion: '🥛 Producción', reproduccion: '🔬 Reproducción', sanidad: '💉 Sanidad', otro: '📌 Otros' }
const PERIODO_LABEL = { diario: 'por día', mensual: 'este mes', anual: 'este año' }

function fechaLocal(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function rangoPeriodo(periodo) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  if (periodo === 'diario') { const s = fechaLocal(hoy); return { desde: s, hasta: s } }
  if (periodo === 'anual') return { desde: `${hoy.getFullYear()}-01-01`, hasta: `${hoy.getFullYear()}-12-31` }
  const first = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const last = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
  return { desde: fechaLocal(first), hasta: fechaLocal(last) }
}

async function calcularReal(meta) {
  const cfg = INDICADORES[meta.indicador]
  if (!cfg || cfg.manual) return null
  const { desde, hasta } = rangoPeriodo(cfg.periodo)

  if (cfg.agg === 'sum') {
    let q = supabase.from(cfg.tabla).select(cfg.campo).gte('fecha', desde).lte('fecha', hasta)
    if (cfg.estado) q = q.eq('estado', 'aprobado')
    if (meta.finca_id) q = q.eq('finca_id', meta.finca_id)
    const { data } = await q
    return (data ?? []).reduce((s, r) => s + Number(r[cfg.campo] || 0), 0)
  }

  let q = supabase.from(cfg.tabla).select('*', { count: 'exact', head: true }).gte('fecha', desde).lte('fecha', hasta)
  if (cfg.estado) q = q.eq('estado', 'aprobado')
  if (meta.finca_id) q = q.eq('finca_id', meta.finca_id)
  if (cfg.tipo) q = q.eq('tipo', cfg.tipo)
  if (cfg.resultadoPositivo) q = q.or('resultado.ilike.%pre%,resultado.ilike.%posit%,resultado.ilike.%gest%')
  const { count } = await q
  return count ?? 0
}

function evaluar(meta, real) {
  const obj = Number(meta.valor_objetivo)
  if (real == null || !obj) return { color: 'gray', pct: 0 }
  if (meta.direccion === 'menor') {
    if (real <= obj) return { color: 'verde', pct: Math.min(real / obj, 1) * 100 }
    if (real <= obj * 1.2) return { color: 'amarillo', pct: 100 }
    return { color: 'rojo', pct: 100 }
  }
  const pct = (real / obj) * 100
  if (pct >= 100) return { color: 'verde', pct: 100 }
  if (pct >= 80) return { color: 'amarillo', pct }
  return { color: 'rojo', pct }
}

const COLOR = {
  verde:    { dot: 'bg-verde-500', bar: 'bg-verde-500', txt: 'text-verde-700', emoji: '🟢' },
  amarillo: { dot: 'bg-amber-400', bar: 'bg-amber-400', txt: 'text-amber-600', emoji: '🟡' },
  rojo:     { dot: 'bg-red-500',   bar: 'bg-red-500',   txt: 'text-red-600',   emoji: '🔴' },
  gray:     { dot: 'bg-gray-300',  bar: 'bg-gray-300',  txt: 'text-gray-400',  emoji: '⚪' },
}

const fmtNum = n => (Number.isInteger(n) ? n : Math.round(n)).toLocaleString('es-CO')

export default function Metas() {
  const { perfil } = useAuth()
  const [metas, setMetas] = useState([])
  const [reales, setReales] = useState({})
  const [fincas, setFincas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [modal, setModal] = useState(null) // null | 'nuevo' | metaObj

  const esPropietario = perfil?.rol === 'propietario'

  async function cargar() {
    setCargando(true)
    const [{ data: ms }, { data: fs }] = await Promise.all([
      supabase.from('metas').select('*').eq('activa', true).order('categoria').order('created_at'),
      supabase.from('fincas').select('id,nombre').eq('activa', true).order('nombre'),
    ])
    setMetas(ms ?? [])
    setFincas(fs ?? [])
    setCargando(false)
    // Calcular el real de cada meta (en paralelo)
    const pares = await Promise.all((ms ?? []).map(async m => [m.id, await calcularReal(m)]))
    setReales(Object.fromEntries(pares))
  }

  useEffect(() => { cargar() }, [])

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta meta?')) return
    await supabase.from('metas').update({ activa: false }).eq('id', id)
    cargar()
  }

  // Agrupar por categoría
  const porCategoria = {}
  metas.forEach(m => { (porCategoria[m.categoria] ??= []).push(m) })

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800">🎯 Metas</h2>
        {esPropietario && (
          <button onClick={() => setModal('nuevo')}
            className="bg-verde-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-verde-700 transition">
            + Nueva
          </button>
        )}
      </div>

      {cargando ? (
        <p className="text-gray-400 text-sm">Cargando...</p>
      ) : metas.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🎯</p>
          <p className="text-gray-400 text-sm">Aún no hay metas</p>
          {esPropietario && <p className="text-xs text-gray-300 mt-1">Toca "+ Nueva" para definir tu primera meta</p>}
        </div>
      ) : (
        Object.entries(porCategoria).map(([cat, items]) => (
          <div key={cat} className="space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1 pt-2">{CAT_LABEL[cat] ?? cat}</p>
            {items.map(m => (
              <TarjetaMeta key={m.id} meta={m} real={reales[m.id]} fincas={fincas}
                esPropietario={esPropietario}
                onEditar={() => setModal(m)} onEliminar={() => eliminar(m.id)} />
            ))}
          </div>
        ))
      )}

      {modal && (
        <ModalMeta
          meta={modal === 'nuevo' ? null : modal}
          fincas={fincas} perfil={perfil}
          onClose={() => setModal(null)}
          onGuardado={() => { setModal(null); cargar() }}
        />
      )}
    </div>
  )
}

function TarjetaMeta({ meta, real, fincas, esPropietario, onEditar, onEliminar }) {
  const cfg = INDICADORES[meta.indicador]
  const manual = !cfg || cfg.manual
  const { color, pct } = manual ? { color: 'gray', pct: 0 } : evaluar(meta, real)
  const c = COLOR[color]
  const finca = meta.finca_id ? (fincas.find(f => f.id === meta.finca_id)?.nombre ?? 'Finca') : 'Todas las fincas'

  return (
    <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
      <div className="flex items-start gap-3">
        <span className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${c.dot}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">{meta.nombre}</p>
          <p className="text-xs text-gray-400">{finca} · {PERIODO_LABEL[meta.periodo]}</p>
        </div>
        {esPropietario && (
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={onEditar} className="text-gray-300 hover:text-verde-600 text-sm transition">Editar</button>
            <button onClick={onEliminar} className="text-gray-300 hover:text-red-500 text-lg leading-none transition">×</button>
          </div>
        )}
      </div>

      {manual ? (
        <div className="mt-2 pl-6 flex items-center justify-between">
          <span className="text-sm text-gray-500">Objetivo: <strong className="text-gray-800">{fmtNum(meta.valor_objetivo)} {meta.unidad}</strong></span>
          <span className="text-[10px] text-gray-400">seguimiento manual</span>
        </div>
      ) : (
        <div className="mt-2 pl-6">
          <div className="flex items-end justify-between mb-1">
            <span className={`text-lg font-black ${c.txt}`}>
              {real == null ? '—' : fmtNum(real)}
              <span className="text-xs font-normal text-gray-400"> / {fmtNum(meta.valor_objetivo)} {meta.unidad}</span>
            </span>
            <span className="text-xs">{c.emoji}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className={`${c.bar} h-2 rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          {meta.direccion === 'menor' && (
            <p className="text-[10px] text-gray-400 mt-1">Meta: no superar {fmtNum(meta.valor_objetivo)} {meta.unidad}</p>
          )}
        </div>
      )}
    </div>
  )
}

function ModalMeta({ meta, fincas, perfil, onClose, onGuardado }) {
  const esEdicion = !!meta
  const [indicador, setIndicador] = useState(meta?.indicador ?? 'litros_dia')
  const [form, setForm] = useState({
    nombre: meta?.nombre ?? INDICADORES.litros_dia.nombre,
    categoria: meta?.categoria ?? INDICADORES.litros_dia.categoria,
    unidad: meta?.unidad ?? INDICADORES.litros_dia.unidad,
    periodo: meta?.periodo ?? INDICADORES.litros_dia.periodo,
    direccion: meta?.direccion ?? INDICADORES.litros_dia.direccion,
    valor_objetivo: meta?.valor_objetivo ?? '',
    finca_id: meta?.finca_id ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const cfg = INDICADORES[indicador]
  const manual = indicador === 'personalizada'

  function cambiarIndicador(key) {
    setIndicador(key)
    const c = INDICADORES[key]
    if (!c.manual) {
      setForm(f => ({ ...f, nombre: c.nombre, categoria: c.categoria, unidad: c.unidad, periodo: c.periodo, direccion: c.direccion }))
    } else {
      setForm(f => ({ ...f, nombre: '', categoria: 'otro', unidad: '', periodo: 'mensual', direccion: 'mayor' }))
    }
  }

  async function guardar(e) {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('Ponle un nombre a la meta'); return }
    if (!form.valor_objetivo || Number(form.valor_objetivo) <= 0) { setError('Define un valor objetivo mayor que 0'); return }
    setGuardando(true); setError('')

    const payload = {
      indicador,
      nombre: form.nombre.trim(),
      categoria: form.categoria,
      unidad: form.unidad || null,
      periodo: form.periodo,
      direccion: form.direccion,
      valor_objetivo: Number(form.valor_objetivo),
      finca_id: form.finca_id || null,
    }

    let err
    if (esEdicion) {
      ;({ error: err } = await supabase.from('metas').update(payload).eq('id', meta.id))
    } else {
      ;({ error: err } = await supabase.from('metas').insert({ ...payload, creado_por: perfil.id }))
    }
    setGuardando(false)
    if (err) { setError(err.message); return }
    onGuardado()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-gray-800">{esEdicion ? 'Editar meta' : 'Nueva meta'}</h3>
        {error && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-600">{error}</div>}

        <form onSubmit={guardar} className="space-y-3">
          {/* Indicador (solo al crear) */}
          {!esEdicion && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Indicador *</label>
              <select value={indicador} onChange={e => cambiarIndicador(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
                {Object.entries(INDICADORES).map(([k, v]) => (
                  <option key={k} value={k}>{k === 'personalizada' ? '➕ Personalizada (manual)' : v.nombre}</option>
                ))}
              </select>
              {!manual && <p className="text-[11px] text-gray-400 mt-1">El avance real se calcula solo desde los registros.</p>}
            </div>
          )}

          {/* Nombre (editable solo en personalizada) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              readOnly={!manual && !esEdicion}
              placeholder="ej: Promedio de litros por vaca"
              className={`w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500 ${(!manual && !esEdicion) ? 'bg-gray-50 text-gray-500' : ''}`} />
          </div>

          {/* Valor objetivo + unidad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor objetivo *</label>
              <input type="number" step="0.01" min="0" value={form.valor_objetivo}
                onChange={e => setForm(f => ({ ...f, valor_objetivo: e.target.value }))}
                placeholder="ej: 900"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
              <input value={form.unidad} onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))}
                readOnly={!manual} placeholder="L, animales..."
                className={`w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500 ${!manual ? 'bg-gray-50 text-gray-500' : ''}`} />
            </div>
          </div>

          {/* Periodo + dirección (editable solo en personalizada) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Periodo</label>
              <select value={form.periodo} onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))}
                disabled={!manual}
                className={`w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500 ${!manual ? 'bg-gray-50 text-gray-500' : ''}`}>
                <option value="diario">Por día</option>
                <option value="mensual">Por mes</option>
                <option value="anual">Por año</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cumplir es</label>
              <select value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
                disabled={!manual}
                className={`w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500 ${!manual ? 'bg-gray-50 text-gray-500' : ''}`}>
                <option value="mayor">Alcanzar o superar</option>
                <option value="menor">No pasarse (ej. mortandad)</option>
              </select>
            </div>
          </div>

          {/* Finca */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Finca</label>
            <select value={form.finca_id} onChange={e => setForm(f => ({ ...f, finca_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-verde-500">
              <option value="">Todas las fincas</option>
              {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
            </select>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl text-sm">Cancelar</button>
            <button type="submit" disabled={guardando}
              className="flex-1 bg-verde-600 text-white py-3 rounded-xl text-sm font-semibold disabled:opacity-50">
              {guardando ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Crear meta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
