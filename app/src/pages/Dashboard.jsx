import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

const META_DEFAULT = 10000

export default function Dashboard() {
  const { perfil } = useAuth()
  const [resumen, setResumen] = useState({ fincas: 0, animales: 0, enOrdeno: 0, litrosHoy: 0, litrosAyer: 0 })
  const [finanzas, setFinanzas] = useState({ ingresos: 0, gastos: 0 })
  const [alertas, setAlertas] = useState([])
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

      const nuevasAlertas = []
      retiros?.forEach(a => nuevasAlertas.push({ tipo: 'retiro', texto: `${a.identificacion}${a.nombre ? ` (${a.nombre})` : ''} — retiro de leche vencido`, color: 'red' }))
      tareasVencidas?.forEach(t => nuevasAlertas.push({ tipo: 'tarea', texto: `Tarea vencida: ${t.titulo}`, color: 'orange' }))
      partosProximos?.forEach(p => nuevasAlertas.push({ tipo: 'parto', texto: `Parto próximo: ${p.animales?.identificacion ?? '?'} el ${p.fecha_probable_parto}`, color: 'yellow' }))
      stockBajo?.forEach(i => nuevasAlertas.push({ tipo: 'stock', texto: `Stock bajo: ${i.nombre} (${i.stock_actual} unidades)`, color: 'orange' }))
      setAlertas(nuevasAlertas)
      setCargando(false)
    }
    cargar()
  }, [])

  const pct = Math.min((resumen.litrosHoy / meta) * 100, 100)
  const balance = finanzas.ingresos - finanzas.gastos
  const diffAyer = resumen.litrosHoy - resumen.litrosAyer
  const semaforoLabel = pct >= 90 ? 'En meta' : pct >= 70 ? 'Cerca de la meta' : 'Por debajo de meta'
  const heroBg = pct >= 90 ? 'from-green-600 to-green-700' : pct >= 70 ? 'from-yellow-500 to-yellow-600' : 'from-verde-700 to-verde-800'

  function guardarMeta(e) {
    e.preventDefault()
    const nueva = Number(metaInput)
    if (nueva > 0) { setMeta(nueva); localStorage.setItem('meta_litros', nueva) }
    setEditandoMeta(false)
  }

  const modulos = [
    { to: '/animales',     icon: '🐄', label: 'Animales',     desc: 'Hato y fichas' },
    { to: '/tareas',       icon: '✅', label: 'Tareas',       desc: 'Pendientes y asignadas' },
    { to: '/ordenos',      icon: '🥛', label: 'Ordeños',      desc: 'Registro de producción' },
    { to: '/sanidad',      icon: '💉', label: 'Sanidad',      desc: 'Tratamientos y vacunas' },
    { to: '/reproduccion', icon: '🔬', label: 'Reproducción', desc: 'Servicios y partos' },
    { to: '/movimientos',  icon: '🚛', label: 'Movimientos',  desc: 'Traslados y bajas' },
    { to: '/finanzas',     icon: '💰', label: 'Finanzas',     desc: 'Ingresos y gastos' },
    { to: '/reportes',     icon: '📊', label: 'Reportes',     desc: 'Estadísticas' },
  ]

  return (
    <div className="space-y-4 pt-1">

      {/* Hero — producción del día */}
      <div className={`bg-gradient-to-br ${heroBg} rounded-2xl p-5 text-white shadow-lg`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-green-100 text-sm font-medium">Hola {perfil?.nombre?.split(' ')[0]}</p>
            <p className="text-white/70 text-xs">Producción de hoy</p>
          </div>
          <span className="text-xs bg-white/20 px-2 py-1 rounded-full">{semaforoLabel}</span>
        </div>

        <div className="flex items-end gap-3 mb-4">
          <span className="text-5xl font-bold tracking-tight">{cargando ? '—' : resumen.litrosHoy.toFixed(0)}</span>
          <div className="mb-1">
            <span className="text-xl text-white/80">L</span>
            {!cargando && resumen.litrosAyer > 0 && (
              <div className={`text-xs mt-0.5 ${diffAyer >= 0 ? 'text-green-200' : 'text-red-200'}`}>
                {diffAyer >= 0 ? '▲' : '▼'} {Math.abs(diffAyer).toFixed(0)} L vs ayer
              </div>
            )}
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="w-full bg-white/20 rounded-full h-2 mb-2">
          <div className="bg-white h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>

        <div className="flex justify-between items-center text-xs text-white/60">
          <span>0 L</span>
          {editandoMeta ? (
            <form onSubmit={guardarMeta} className="flex items-center gap-1">
              <input autoFocus type="number" value={metaInput} onChange={e => setMetaInput(e.target.value)}
                className="bg-white/20 text-white placeholder-white/50 rounded px-2 py-0.5 w-24 text-xs focus:outline-none" />
              <button type="submit" className="text-white font-semibold">OK</button>
              <button type="button" onClick={() => setEditandoMeta(false)} className="text-white/60">×</button>
            </form>
          ) : (
            <button onClick={() => { setMetaInput(meta); setEditandoMeta(true) }}
              className="text-white/60 hover:text-white transition">
              Meta: {meta.toLocaleString()} L ✏️
            </button>
          )}
        </div>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a, i) => (
            <div key={i} className={`rounded-xl px-4 py-3 text-sm font-medium flex items-start gap-2 ${
              a.color === 'red'    ? 'bg-red-50 text-red-700 border border-red-200' :
              a.color === 'orange' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                                     'bg-yellow-50 text-yellow-700 border border-yellow-200'
            }`}>
              <span>{a.color === 'red' ? '🚨' : a.color === 'orange' ? '⚠️' : '📅'}</span>
              {a.texto}
            </div>
          ))}
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
              <div className="text-2xl mb-1">{icon}</div>
              <div className="text-2xl font-bold text-gray-800">{valor}</div>
              <div className="text-xs text-gray-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Balance del mes */}
      {!cargando && (finanzas.ingresos > 0 || finanzas.gastos > 0) && (
        <Link to="/finanzas" className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700">Finanzas este mes</span>
            <span className="text-xs text-gray-400">Ver detalle ›</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Ingresos</div>
              <div className="text-sm font-bold text-verde-700">${finanzas.ingresos.toLocaleString('es-CO')}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Gastos</div>
              <div className="text-sm font-bold text-red-500">${finanzas.gastos.toLocaleString('es-CO')}</div>
            </div>
            <div>
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
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Módulos</p>
        <div className="space-y-2">
          {modulos.map(({ to, icon, label, desc }) => (
            <Link key={to} to={to}
              className="bg-white rounded-2xl px-4 py-3 flex items-center gap-4 shadow-sm border border-gray-100 hover:shadow transition">
              <span className="text-2xl w-8 text-center">{icon}</span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-800">{label}</div>
                <div className="text-xs text-gray-400">{desc}</div>
              </div>
              <span className="text-gray-300 text-lg">›</span>
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}
