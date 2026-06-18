import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { fmtFecha } from '../lib/fecha'
import { PawPrint, Milk, Warehouse, Siren, AlertTriangle, Calendar, Clock, ChevronRight, TrendingUp, TrendingDown, X, BarChart3 } from '../components/icons'

function fechaISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// Prioridad de orden de alertas: rojas primero, amarillas al final.
const ORDEN_ALERTA = { red: 0, orange: 1, yellow: 2 }

export default function Dashboard() {
  const { perfil } = useAuth()
  const [resumen, setResumen] = useState({ fincas: 0, animales: 0, enOrdeno: 0, litrosHoy: 0, litrosAyer: 0 })
  const [metaLitros, setMetaLitros] = useState(null)   // meta diaria de litros (viene del panel de Metas)
  const [alertas, setAlertas] = useState([])
  const [pendientes, setPendientes] = useState([])
  const [aprobando, setAprobando] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [ocultas, setOcultas] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('alertas_ocultas') || '[]')) }
    catch { return new Set() }
  })

  useEffect(() => {
    async function cargar() {
      const hoy  = new Date().toISOString().split('T')[0]
      const ayer = new Date(Date.now() - 86400000).toISOString().split('T')[0]

      const [
        { count: fincas },
        { count: animales },
        { count: enOrdeno },
        { data: ordenosHoy },
        { data: ordenosAyer },
        { data: retiros },
        { data: tareasVencidas },
        { data: partosProximos },
        { data: insumosBajos },
        { data: metasLitros },
      ] = await Promise.all([
        supabase.from('fincas').select('*', { count: 'exact', head: true }).eq('activa', true),
        supabase.from('animales').select('*', { count: 'exact', head: true }).eq('activa', true),
        supabase.from('animales').select('*', { count: 'exact', head: true }).eq('activa', true).eq('estado_productivo', 'en_ordeno'),
        supabase.from('ordenos').select('litros').eq('fecha', hoy),
        supabase.from('ordenos').select('litros').eq('fecha', ayer),
        supabase.from('animales').select('identificacion,nombre').eq('activa', true).eq('en_retiro_leche', true).lte('fecha_fin_retiro', hoy),
        supabase.from('tareas').select('id,titulo').eq('completada', false).lt('fecha_vencimiento', hoy).limit(5),
        supabase.from('eventos_reproductivos').select('animales(identificacion,nombre),fecha_probable_parto')
          .not('fecha_probable_parto', 'is', null)
          .gte('fecha_probable_parto', hoy)
          .lte('fecha_probable_parto', new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0])
          .limit(5),
        supabase.from('inventario_insumos').select('nombre,stock_actual,stock_minimo'),
        supabase.from('metas').select('valor_objetivo,finca_id').eq('indicador', 'litros_dia').eq('activa', true),
      ])

      const stockBajo = insumosBajos?.filter(i => Number(i.stock_actual) <= Number(i.stock_minimo)) ?? []
      const litrosHoy  = ordenosHoy?.reduce((s, o) => s + Number(o.litros), 0) ?? 0
      const litrosAyer = ordenosAyer?.reduce((s, o) => s + Number(o.litros), 0) ?? 0

      // Meta diaria de litros tomada del panel de Metas:
      // si hay meta global (todas las fincas) se usa esa; si no, se suman las de cada finca.
      const ml = metasLitros ?? []
      const global = ml.find(m => m.finca_id == null)
      const metaDia = global ? Number(global.valor_objetivo)
        : ml.length ? ml.reduce((s, m) => s + Number(m.valor_objetivo), 0)
        : null
      setMetaLitros(metaDia)

      setResumen({ fincas: fincas ?? 0, animales: animales ?? 0, enOrdeno: enOrdeno ?? 0, litrosHoy, litrosAyer })

      // Pendientes — query directa (RLS permite propietario ver todo)
      const [
        { data: ordPend },
        { data: sanPend },
        { data: repPend },
        { data: repTrabPend },
      ] = await Promise.all([
        supabase.from('ordenos').select('id,fecha,litros').eq('estado', 'pendiente').order('created_at', { ascending: false }),
        supabase.from('eventos_sanitarios').select('id,fecha,tipo,diagnostico').eq('estado', 'pendiente').order('created_at', { ascending: false }),
        supabase.from('eventos_reproductivos').select('id,fecha,tipo').eq('estado', 'pendiente').order('created_at', { ascending: false }),
        supabase.from('reportes_trabajador').select('id,fecha,titulo').eq('estado', 'pendiente').order('created_at', { ascending: false }),
      ])
      setPendientes([
        ...(ordPend ?? []).map(r => ({ id: r.id, fecha: r.fecha, _tabla: 'ordenos', _desc: `Ordeño — ${Number(r.litros).toFixed(1)} L` })),
        ...(sanPend ?? []).map(r => ({ id: r.id, fecha: r.fecha, _tabla: 'eventos_sanitarios', _desc: `Sanidad: ${r.tipo}${r.diagnostico ? ` — ${r.diagnostico}` : ''}` })),
        ...(repPend ?? []).map(r => ({ id: r.id, fecha: r.fecha, _tabla: 'eventos_reproductivos', _desc: `Reproducción: ${r.tipo}` })),
        ...(repTrabPend ?? []).map(r => ({ id: r.id, fecha: r.fecha, _tabla: 'reportes_trabajador', _desc: `Reporte: ${r.titulo}` })),
      ])

      const nuevasAlertas = []
      retiros?.forEach(a => nuevasAlertas.push({ key: `retiro:${a.identificacion}`, tipo: 'retiro', texto: `${a.identificacion}${a.nombre ? ` (${a.nombre})` : ''} — retiro de leche vencido`, color: 'red' }))
      tareasVencidas?.forEach(t => nuevasAlertas.push({ key: `tarea:${t.id}`, tipo: 'tarea', texto: `Actividad vencida: ${t.titulo}`, color: 'orange' }))
      partosProximos?.forEach(p => nuevasAlertas.push({ key: `parto:${p.animales?.identificacion ?? '?'}:${p.fecha_probable_parto}`, tipo: 'parto', texto: `Parto próximo: ${p.animales?.identificacion ?? '?'} el ${fmtFecha(p.fecha_probable_parto)}`, color: 'yellow' }))
      stockBajo?.forEach(i => nuevasAlertas.push({ key: `stock:${i.nombre}`, tipo: 'stock', texto: `Stock bajo: ${i.nombre} (${i.stock_actual} unidades)`, color: 'orange' }))
      setAlertas(nuevasAlertas)
      setCargando(false)
    }
    cargar()
  }, [])

  const pct = metaLitros ? Math.min((resumen.litrosHoy / metaLitros) * 100, 100) : 0
  const diffAyer = resumen.litrosHoy - resumen.litrosAyer

  const alertasVisibles = alertas
    .filter(a => !ocultas.has(a.key))
    .sort((x, y) => (ORDEN_ALERTA[x.color] ?? 9) - (ORDEN_ALERTA[y.color] ?? 9))
  // Rojas/naranjas (urgentes) van arriba; las amarillas se muestran al final,
  // justo antes del módulo financiero.
  const alertasTop = alertasVisibles.filter(a => a.color !== 'yellow')
  const alertasAmarillas = alertasVisibles.filter(a => a.color === 'yellow')

  function ocultarAlerta(key) {
    setOcultas(prev => {
      const next = new Set(prev)
      next.add(key)
      localStorage.setItem('alertas_ocultas', JSON.stringify([...next]))
      return next
    })
  }

  async function aprobarTodo() {
    setAprobando('all')
    const porTabla = {}
    pendientes.forEach(p => {
      if (!porTabla[p._tabla]) porTabla[p._tabla] = []
      porTabla[p._tabla].push(p.id)
    })
    await Promise.all(
      Object.entries(porTabla).map(([tabla, ids]) =>
        supabase.from(tabla).update({ estado: 'aprobado', aprobado_por: perfil.id }).in('id', ids)
      )
    )
    setAprobando(null)
    setPendientes([])
  }

  async function aprobar(item) {
    setAprobando(item.id)
    await supabase.from(item._tabla).update({ estado: 'aprobado', aprobado_por: perfil.id }).eq('id', item.id)
    setAprobando(null)
    setPendientes(p => p.filter(x => x.id !== item.id))
  }

  async function rechazar(item) {
    const comentario = prompt('Motivo del rechazo (opcional):') ?? ''
    setAprobando(item.id)
    await supabase.from(item._tabla).update({ estado: 'rechazado', comentario_rechazo: comentario || null }).eq('id', item.id)
    setAprobando(null)
    setPendientes(p => p.filter(x => x.id !== item.id))
  }

  return (
    <div className="space-y-4 pt-1 pb-2">

      {/* Hero — producción de hoy vs meta (la meta se define en el panel de Metas) */}
      <div className="relative overflow-hidden rounded-3xl bg-verde-700 p-6 shadow-xl">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -left-8 w-40 h-40 rounded-full bg-white/5" />

        <div className="flex items-end justify-between mb-5">
          <div>
            <p className="text-verde-300 text-xs uppercase tracking-widest mb-1">Producción hoy</p>
            <div className="flex items-end gap-2">
              <span className="text-7xl font-black text-white leading-none">
                {cargando ? '—' : resumen.litrosHoy.toFixed(0)}
              </span>
              <span className="text-2xl text-verde-300 mb-2">L</span>
            </div>
            {!cargando && resumen.litrosAyer > 0 && (
              <p className={`text-sm mt-1 font-medium flex items-center gap-1 ${diffAyer >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {diffAyer >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />} {Math.abs(diffAyer).toFixed(0)} L vs ayer
              </p>
            )}
          </div>

          {metaLitros != null && (
            <div className="text-right">
              <div className={`text-xs font-bold px-3 py-1.5 rounded-full mb-2 inline-flex items-center gap-1.5 ${
                pct >= 90 ? 'bg-green-400/30 text-green-200' :
                pct >= 70 ? 'bg-yellow-400/30 text-yellow-200' :
                            'bg-red-400/30 text-red-200'
              }`}>
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${pct >= 90 ? 'bg-verde-600' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500'}`} />
                {pct >= 90 ? 'En meta' : pct >= 70 ? 'Cerca' : 'Bajo'}
              </div>
              <p className="text-verde-400 text-xs">{Math.round(pct)}% de la meta</p>
            </div>
          )}
        </div>

        {metaLitros != null && (
          <div className="w-full bg-white/20 rounded-full h-3 mb-2">
            <div
              className={`h-3 rounded-full transition-all duration-700 ${
                pct >= 90 ? 'bg-green-400' : pct >= 70 ? 'bg-yellow-400' : 'bg-red-400'
              }`}
              style={{ width: `${Math.max(pct, 2)}%` }}
            />
          </div>
        )}

        <div className="flex justify-between items-center text-xs text-verde-400">
          <span>0 L</span>
          <Link to="/metas" className="text-verde-400 hover:text-white transition flex items-center gap-1">
            {metaLitros != null ? `Meta: ${metaLitros.toLocaleString()} L` : 'Definir meta en Metas'} <ChevronRight size={12} />
          </Link>
        </div>
      </div>

      {/* Histórico de producción de leche */}
      <PanelHistoricoLeche />

      {/* Alertas urgentes (rojas/naranjas) — cada una se puede ocultar del tablero */}
      {alertasTop.length > 0 && (
        <div className="space-y-2">
          {alertasTop.map(a => (
            <FilaAlerta key={a.key} a={a} onOcultar={ocultarAlerta} />
          ))}
        </div>
      )}

      {/* Bandeja de aprobación */}
      {pendientes.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
            <Clock size={20} className="text-amber-500" />
            <span className="text-sm font-bold text-amber-800">Pendientes de aprobación</span>
            <span className="bg-amber-200 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">{pendientes.length}</span>
            <button onClick={aprobarTodo} disabled={aprobando === 'all'}
              className="ml-auto text-xs bg-verde-600 text-white px-3 py-1 rounded-lg font-semibold disabled:opacity-50">
              {aprobando === 'all' ? '...' : 'Aprobar todo'}
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {pendientes.map(item => (
              <div key={item.id} className="px-4 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item._desc}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{fmtFecha(item.fecha)}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => rechazar(item)}
                    disabled={aprobando === item.id}
                    className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 transition">
                    Rechazar
                  </button>
                  <button
                    onClick={() => aprobar(item)}
                    disabled={aprobando === item.id}
                    className="text-xs px-3 py-1.5 rounded-lg bg-verde-600 text-white hover:bg-verde-700 disabled:opacity-40 transition">
                    {aprobando === item.id ? '...' : 'Aprobar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {!cargando && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Warehouse, label: 'Fincas',    valor: resumen.fincas   },
            { icon: PawPrint,  label: 'Animales',  valor: resumen.animales  },
            { icon: Milk,      label: 'En ordeño', valor: resumen.enOrdeno },
          ].map(({ icon: Icon, label, valor }) => (
            <div key={label} className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
              <div className="flex justify-center mb-1"><Icon size={28} className="text-verde-700" /></div>
              <div className="text-2xl font-black text-gray-800">{valor}</div>
              <div className="text-xs text-gray-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Alertas amarillas (menos urgentes) — al final del tablero */}
      {alertasAmarillas.length > 0 && (
        <div className="space-y-2">
          {alertasAmarillas.map(a => (
            <FilaAlerta key={a.key} a={a} onOcultar={ocultarAlerta} />
          ))}
        </div>
      )}

    </div>
  )
}

// ─── Fila de alerta (reutilizable, con botón para ocultar del tablero) ───────
function FilaAlerta({ a, onOcultar }) {
  return (
    <div className={`rounded-2xl px-4 py-3 text-sm font-medium flex items-start gap-2 ${
      a.color === 'red'    ? 'bg-red-50 text-red-700 border border-red-100' :
      a.color === 'orange' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                             'bg-yellow-50 text-yellow-700 border border-yellow-100'
    }`}>
      <span className="flex-shrink-0 mt-0.5">{a.color === 'red' ? <Siren size={16} className="text-red-600" /> : a.color === 'orange' ? <AlertTriangle size={16} className="text-amber-600" /> : <Calendar size={16} />}</span>
      <span className="flex-1">{a.texto}</span>
      <button onClick={() => onOcultar(a.key)} aria-label="Ocultar del tablero"
        className="flex-shrink-0 opacity-40 hover:opacity-100 transition">
        <X size={16} />
      </button>
    </div>
  )
}

// ─── Panel histórico de producción de leche ─────────────────────────────────
const RANGOS = [
  { key: '7',   label: '7 días',  dias: 7  },
  { key: '30',  label: '30 días', dias: 30 },
  { key: 'mes', label: 'Este mes' },
]

function PanelHistoricoLeche() {
  const [rango, setRango] = useState('7')
  const [serie, setSerie] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      setCargando(true)
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
      let desde
      if (rango === 'mes') {
        desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      } else {
        const dias = RANGOS.find(r => r.key === rango)?.dias ?? 7
        desde = new Date(hoy.getTime() - (dias - 1) * 86400000)
      }

      const { data } = await supabase.from('ordenos')
        .select('fecha,litros')
        .gte('fecha', fechaISO(desde))
        .lte('fecha', fechaISO(hoy))

      const porFecha = {}
      ;(data ?? []).forEach(o => { porFecha[o.fecha] = (porFecha[o.fecha] || 0) + Number(o.litros) })

      const out = []
      for (let d = new Date(desde); d <= hoy; d = new Date(d.getTime() + 86400000)) {
        const k = fechaISO(d)
        out.push({ fecha: k, litros: porFecha[k] || 0 })
      }
      setSerie(out)
      setCargando(false)
    }
    cargar()
  }, [rango])

  const total = serie.reduce((s, d) => s + d.litros, 0)
  const prom = serie.length ? total / serie.length : 0
  const max = Math.max(1, ...serie.map(d => d.litros))
  const mejor = serie.reduce((m, d) => (d.litros > (m?.litros ?? -1) ? d : m), null)

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
          <BarChart3 size={18} className="text-verde-700" /> Histórico de producción
        </span>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {RANGOS.map(r => (
            <button key={r.key} onClick={() => setRango(r.key)}
              className={`text-xs px-2.5 py-1 rounded-md font-medium transition ${
                rango === r.key ? 'bg-white text-verde-700 shadow-sm' : 'text-gray-400'
              }`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {cargando ? (
        <p className="text-gray-400 text-sm py-6 text-center">Cargando...</p>
      ) : total === 0 ? (
        <p className="text-gray-400 text-sm py-6 text-center">Sin ordeños registrados en este periodo</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3 text-center">
            <div className="bg-gray-50 rounded-xl py-2">
              <div className="text-xs text-gray-400 mb-0.5">Total</div>
              <div className="text-sm font-bold text-gray-800">{Math.round(total).toLocaleString('es-CO')} L</div>
            </div>
            <div className="bg-gray-50 rounded-xl py-2">
              <div className="text-xs text-gray-400 mb-0.5">Promedio/día</div>
              <div className="text-sm font-bold text-gray-800">{Math.round(prom).toLocaleString('es-CO')} L</div>
            </div>
            <div className="bg-gray-50 rounded-xl py-2">
              <div className="text-xs text-gray-400 mb-0.5">Mejor día</div>
              <div className="text-sm font-bold text-gray-800">{Math.round(mejor?.litros ?? 0).toLocaleString('es-CO')} L</div>
            </div>
          </div>

          {/* Mini gráfico de barras */}
          <div className="flex items-end gap-px h-24">
            {serie.map(d => (
              <div key={d.fecha} className="flex-1 flex items-end h-full" title={`${fmtFecha(d.fecha)}: ${Math.round(d.litros)} L`}>
                <div className="w-full bg-verde-500 rounded-t transition-all"
                  style={{ height: `${Math.max((d.litros / max) * 100, d.litros > 0 ? 4 : 0)}%` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1.5">
            <span>{fmtFecha(serie[0]?.fecha)}</span>
            <span>{fmtFecha(serie[serie.length - 1]?.fecha)}</span>
          </div>
        </>
      )}
    </div>
  )
}
