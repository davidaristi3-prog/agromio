import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { fmtFecha } from '../lib/fecha'

const META_DEFAULT = 10000

export default function Dashboard() {
  const { perfil } = useAuth()
  const [resumen, setResumen] = useState({ fincas: 0, animales: 0, enOrdeno: 0, litrosHoy: 0, litrosAyer: 0 })
  const [finanzas, setFinanzas] = useState({ ingresos: 0, gastos: 0 })
  const [alertas, setAlertas] = useState([])
  const [pendientes, setPendientes] = useState([])
  const [aprobando, setAprobando] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [meta, setMeta] = useState(() => Number(localStorage.getItem('meta_litros') || META_DEFAULT))
  const [editandoMeta, setEditandoMeta] = useState(false)
  const [metaInput, setMetaInput] = useState('')

  useEffect(() => {
    async function cargar() {
      const hoy  = new Date().toISOString().split('T')[0]
      const ayer = new Date(Date.now() - 86400000).toISOString().split('T')[0]
      const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

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
        { data: txMes },
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
        supabase.from('transacciones').select('tipo,valor').gte('fecha', inicioMes),
      ])

      const stockBajo = insumosBajos?.filter(i => Number(i.stock_actual) <= Number(i.stock_minimo)) ?? []
      const litrosHoy  = ordenosHoy?.reduce((s, o) => s + Number(o.litros), 0) ?? 0
      const litrosAyer = ordenosAyer?.reduce((s, o) => s + Number(o.litros), 0) ?? 0
      const ingMes = txMes?.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + Number(t.valor), 0) ?? 0
      const gasMes = txMes?.filter(t => t.tipo === 'gasto').reduce((s, t) => s + Number(t.valor), 0) ?? 0

      setResumen({ fincas: fincas ?? 0, animales: animales ?? 0, enOrdeno: enOrdeno ?? 0, litrosHoy, litrosAyer })
      setFinanzas({ ingresos: ingMes, gastos: gasMes })

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
        ...(repTrabPend ?? []).map(r => ({ id: r.id, fecha: r.fecha, _tabla: 'reportes_trabajador', _desc: `⚡ Reporte: ${r.titulo}` })),
      ])

      const nuevasAlertas = []
      retiros?.forEach(a => nuevasAlertas.push({ tipo: 'retiro', texto: `${a.identificacion}${a.nombre ? ` (${a.nombre})` : ''} — retiro de leche vencido`, color: 'red' }))
      tareasVencidas?.forEach(t => nuevasAlertas.push({ tipo: 'tarea', texto: `Actividad vencida: ${t.titulo}`, color: 'orange' }))
      partosProximos?.forEach(p => nuevasAlertas.push({ tipo: 'parto', texto: `Parto próximo: ${p.animales?.identificacion ?? '?'} el ${fmtFecha(p.fecha_probable_parto)}`, color: 'yellow' }))
      stockBajo?.forEach(i => nuevasAlertas.push({ tipo: 'stock', texto: `Stock bajo: ${i.nombre} (${i.stock_actual} unidades)`, color: 'orange' }))
      setAlertas(nuevasAlertas)
      setCargando(false)
    }
    cargar()
  }, [])

  const pct = Math.min((resumen.litrosHoy / meta) * 100, 100)
  const balance = finanzas.ingresos - finanzas.gastos
  const diffAyer = resumen.litrosHoy - resumen.litrosAyer

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

  function guardarMeta(e) {
    e.preventDefault()
    const nueva = Number(metaInput)
    if (nueva > 0) { setMeta(nueva); localStorage.setItem('meta_litros', nueva) }
    setEditandoMeta(false)
  }

  const modulos = [
    { to: '/animales',     icon: '🐄', label: 'Animales',     desc: 'Hato y fichas' },
    { to: '/tareas',       icon: '✅', label: 'Actividades',       desc: 'Pendientes y asignadas' },
    { to: '/ordenos',      icon: '🥛', label: 'Ordeños',      desc: 'Registro de producción' },
    { to: '/sanidad',      icon: '💉', label: 'Sanidad',      desc: 'Tratamientos y vacunas' },
    { to: '/reproduccion', icon: '🔬', label: 'Reproducción', desc: 'Servicios y partos' },
    { to: '/movimientos',  icon: '🚛', label: 'Movimientos',  desc: 'Traslados y bajas' },
    { to: '/finanzas',     icon: '💰', label: 'Finanzas',     desc: 'Ingresos y gastos' },
    { to: '/reportes',     icon: '📊', label: 'Reportes',     desc: 'Estadísticas' },
  ]

  return (
    <div className="space-y-4 pt-1 pb-2">

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-verde-700 p-6 shadow-xl">
        {/* Círculo decorativo de fondo */}
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -left-8 w-40 h-40 rounded-full bg-white/5" />

        <p className="text-verde-200 text-sm mb-4">Hola {perfil?.nombre?.split(' ')[0]} 👋</p>

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
              <p className={`text-sm mt-1 font-medium ${diffAyer >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {diffAyer >= 0 ? '▲' : '▼'} {Math.abs(diffAyer).toFixed(0)} L vs ayer
              </p>
            )}
          </div>

          <div className="text-right">
            <div className={`text-xs font-bold px-3 py-1.5 rounded-full mb-2 ${
              pct >= 90 ? 'bg-green-400/30 text-green-200' :
              pct >= 70 ? 'bg-yellow-400/30 text-yellow-200' :
                          'bg-red-400/30 text-red-200'
            }`}>
              {pct >= 90 ? '🟢 En meta' : pct >= 70 ? '🟡 Cerca' : '🔴 Bajo'}
            </div>
            <p className="text-verde-400 text-xs">{Math.round(pct)}% de la meta</p>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="w-full bg-white/20 rounded-full h-3 mb-2">
          <div
            className={`h-3 rounded-full transition-all duration-700 ${
              pct >= 90 ? 'bg-green-400' : pct >= 70 ? 'bg-yellow-400' : 'bg-red-400'
            }`}
            style={{ width: `${Math.max(pct, 2)}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-xs text-verde-400">
          <span>0 L</span>
          {editandoMeta ? (
            <form onSubmit={guardarMeta} className="flex items-center gap-2">
              <input autoFocus type="number" value={metaInput} onChange={e => setMetaInput(e.target.value)}
                className="bg-white/20 text-white rounded-lg px-2 py-1 w-24 text-xs focus:outline-none focus:ring-1 focus:ring-white/40" />
              <button type="submit" className="text-white font-bold text-xs bg-white/20 px-2 py-1 rounded-lg">OK</button>
              <button type="button" onClick={() => setEditandoMeta(false)} className="text-verde-400">×</button>
            </form>
          ) : (
            <button onClick={() => { setMetaInput(meta); setEditandoMeta(true) }}
              className="text-verde-400 hover:text-white transition flex items-center gap-1">
              Meta: {meta.toLocaleString()} L <span className="text-[10px]">✏️</span>
            </button>
          )}
        </div>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a, i) => (
            <div key={i} className={`rounded-2xl px-4 py-3 text-sm font-medium flex items-start gap-2 ${
              a.color === 'red'    ? 'bg-red-50 text-red-700 border border-red-100' :
              a.color === 'orange' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                                     'bg-yellow-50 text-yellow-700 border border-yellow-100'
            }`}>
              <span>{a.color === 'red' ? '🚨' : a.color === 'orange' ? '⚠️' : '📅'}</span>
              {a.texto}
            </div>
          ))}
        </div>
      )}

      {/* Bandeja de aprobación */}
      {pendientes.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
            <span className="text-amber-500 text-lg">⏳</span>
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
            { icon: '🏡', label: 'Fincas',    valor: resumen.fincas   },
            { icon: '🐄', label: 'Animales',  valor: resumen.animales  },
            { icon: '🥛', label: 'En ordeño', valor: resumen.enOrdeno },
          ].map(({ icon, label, valor }) => (
            <div key={label} className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
              <div className="text-3xl mb-1">{icon}</div>
              <div className="text-2xl font-black text-gray-800">{valor}</div>
              <div className="text-xs text-gray-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Balance del mes */}
      {!cargando && (finanzas.ingresos > 0 || finanzas.gastos > 0) && (
        <Link to="/finanzas" className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-gray-700">💰 Finanzas este mes</span>
            <span className="text-xs text-gray-400">Ver detalle ›</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-green-50 rounded-xl py-2">
              <div className="text-xs text-gray-400 mb-0.5">Ingresos</div>
              <div className="text-sm font-bold text-verde-700">${finanzas.ingresos.toLocaleString('es-CO')}</div>
            </div>
            <div className="bg-red-50 rounded-xl py-2">
              <div className="text-xs text-gray-400 mb-0.5">Gastos</div>
              <div className="text-sm font-bold text-red-500">${finanzas.gastos.toLocaleString('es-CO')}</div>
            </div>
            <div className={`rounded-xl py-2 ${balance >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="text-xs text-gray-400 mb-0.5">Balance</div>
              <div className={`text-sm font-bold ${balance >= 0 ? 'text-verde-700' : 'text-red-500'}`}>
                {balance >= 0 ? '+' : ''}${balance.toLocaleString('es-CO')}
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Módulos */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Módulos</p>
        <div className="space-y-2">
          {modulos.map(({ to, icon, label, desc }) => (
            <Link key={to} to={to}
              className="bg-white rounded-2xl px-4 py-3.5 flex items-center gap-4 shadow-sm border border-gray-100 active:bg-gray-50 transition">
              <span className="text-2xl w-9 text-center">{icon}</span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-800">{label}</div>
                <div className="text-xs text-gray-400">{desc}</div>
              </div>
              <span className="text-gray-300 text-xl">›</span>
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}
