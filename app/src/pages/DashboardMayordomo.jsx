import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

export default function DashboardMayordomo() {
  const { perfil } = useAuth()
  const [datos, setDatos] = useState(null)
  const [pendientes, setPendientes] = useState([])
  const [alertas, setAlertas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [aprobando, setAprobando] = useState(null)

  useEffect(() => { cargar() }, [perfil?.id])

  async function cargar() {
    const hoy = new Date().toISOString().split('T')[0]

    // Fincas asignadas al mayordomo
    const { data: asignaciones } = await supabase
      .from('asignaciones_finca').select('finca_id,fincas(nombre)').eq('usuario_id', perfil.id)
    const fincaIds = asignaciones?.map(a => a.finca_id) ?? []

    if (fincaIds.length === 0) { setCargando(false); return }

    const [
      { data: ordenosHoy },
      { count: animales },
      { count: tareasVencidas },
      { data: ordPend },
      { data: sanPend },
      { data: repPend },
      { data: retiros },
    ] = await Promise.all([
      supabase.from('ordenos').select('litros').eq('fecha', hoy).in('finca_id', fincaIds).eq('estado', 'aprobado'),
      supabase.from('animales').select('*', { count: 'exact', head: true }).eq('activa', true).in('finca_id', fincaIds),
      supabase.from('tareas').select('*', { count: 'exact', head: true }).eq('completada', false).lt('fecha_vencimiento', hoy).in('finca_id', fincaIds),
      supabase.from('ordenos').select('id,fecha,litros,animales(identificacion),usuarios!ordenos_creado_por_fkey(nombre)').eq('estado', 'pendiente').in('finca_id', fincaIds).order('created_at', { ascending: false }),
      supabase.from('eventos_sanitarios').select('id,fecha,tipo,diagnostico,animales(identificacion),usuarios!eventos_sanitarios_creado_por_fkey(nombre)').eq('estado', 'pendiente').in('finca_id', fincaIds).order('created_at', { ascending: false }),
      supabase.from('eventos_reproductivos').select('id,fecha,tipo,animales(identificacion),usuarios!eventos_reproductivos_creado_por_fkey(nombre)').eq('estado', 'pendiente').in('finca_id', fincaIds).order('created_at', { ascending: false }),
      supabase.from('animales').select('identificacion,nombre').eq('activa', true).eq('en_retiro_leche', true).lte('fecha_fin_retiro', hoy).in('finca_id', fincaIds),
    ])

    const litrosHoy = ordenosHoy?.reduce((s, o) => s + Number(o.litros), 0) ?? 0
    setDatos({ litrosHoy, animales: animales ?? 0, fincas: asignaciones ?? [] })

    const items = [
      ...(ordPend ?? []).map(r => ({ ...r, _tabla: 'ordenos', _desc: `Ordeño ${Number(r.litros).toFixed(1)} L — ${r.animales?.identificacion ?? ''}` })),
      ...(sanPend ?? []).map(r => ({ ...r, _tabla: 'eventos_sanitarios', _desc: `Sanidad: ${r.tipo}${r.diagnostico ? ` — ${r.diagnostico}` : ''} · ${r.animales?.identificacion ?? ''}` })),
      ...(repPend ?? []).map(r => ({ ...r, _tabla: 'eventos_reproductivos', _desc: `Reproducción: ${r.tipo} · ${r.animales?.identificacion ?? ''}` })),
    ]
    setPendientes(items)

    const nuevasAlertas = []
    retiros?.forEach(a => nuevasAlertas.push({ texto: `${a.identificacion}${a.nombre ? ` (${a.nombre})` : ''} — retiro de leche vencido`, color: 'red' }))
    if (tareasVencidas > 0) nuevasAlertas.push({ texto: `${tareasVencidas} actividad(es) vencida(s) en tu finca`, color: 'orange' })
    setAlertas(nuevasAlertas)
    setCargando(false)
  }

  async function aprobar(item) {
    setAprobando(item.id)
    await supabase.from(item._tabla).update({ estado: 'aprobado', aprobado_por: perfil.id }).eq('id', item.id)
    setAprobando(null)
    cargar()
  }

  async function rechazar(item) {
    const comentario = prompt('Motivo del rechazo (opcional):') ?? ''
    setAprobando(item.id)
    await supabase.from(item._tabla).update({ estado: 'rechazado', comentario_rechazo: comentario || null }).eq('id', item.id)
    setAprobando(null)
    cargar()
  }

  const modulos = [
    { to: '/animales',     icon: '🐄', label: 'Animales',     desc: 'Hato y fichas' },
    { to: '/tareas',       icon: '✅', label: 'Actividades',       desc: 'Gestionar actividades' },
    { to: '/ordenos',      icon: '🥛', label: 'Ordeños',      desc: 'Registro de producción' },
    { to: '/sanidad',      icon: '💉', label: 'Sanidad',      desc: 'Tratamientos y vacunas' },
    { to: '/reproduccion', icon: '🔬', label: 'Reproducción', desc: 'Servicios y partos' },
    { to: '/movimientos',  icon: '🚛', label: 'Movimientos',  desc: 'Traslados y bajas' },
    { to: '/inventario',   icon: '📦', label: 'Inventario',   desc: 'Insumos y stock' },
    { to: '/fincas',       icon: '🏡', label: 'Fincas',       desc: 'Fincas y lotes' },
  ]

  return (
    <div className="space-y-4 pt-1 pb-2">

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-verde-700 p-6 shadow-xl">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -left-8 w-40 h-40 rounded-full bg-white/5" />
        <p className="text-verde-200 text-sm mb-1">Hola {perfil?.nombre?.split(' ')[0]} 👋</p>
        <p className="text-verde-300 text-xs uppercase tracking-widest mb-1">Producción hoy — tu finca</p>
        <div className="flex items-end gap-2 mb-1">
          <span className="text-7xl font-black text-white leading-none">
            {cargando ? '—' : datos?.litrosHoy.toFixed(0) ?? '0'}
          </span>
          <span className="text-2xl text-verde-300 mb-2">L</span>
        </div>
        {datos?.fincas?.length > 0 && (
          <p className="text-verde-300 text-xs mt-2">
            {datos.fincas.map(f => f.fincas?.nombre).join(' · ')}
          </p>
        )}
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a, i) => (
            <div key={i} className={`rounded-2xl px-4 py-3 text-sm font-medium flex items-start gap-2 ${
              a.color === 'red' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-orange-50 text-orange-700 border border-orange-100'
            }`}>
              <span>{a.color === 'red' ? '🚨' : '⚠️'}</span>
              {a.texto}
            </div>
          ))}
        </div>
      )}

      {/* Bandeja de aprobación */}
      {pendientes.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">
            Por aprobar ({pendientes.length})
          </p>
          <div className="space-y-2">
            {pendientes.map(item => (
              <div key={item.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-yellow-200">
                <div className="flex items-start gap-2 mb-3">
                  <span className="text-lg">⏳</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{item._desc}</p>
                    <p className="text-xs text-gray-400">
                      {item.fecha} · Registrado por {item.usuarios?.nombre ?? 'trabajador'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={aprobando === item.id}
                    onClick={() => aprobar(item)}
                    className="flex-1 bg-verde-600 text-white text-sm font-semibold py-2 rounded-xl disabled:opacity-50">
                    ✓ Aprobar
                  </button>
                  <button
                    disabled={aprobando === item.id}
                    onClick={() => rechazar(item)}
                    className="flex-1 border border-red-200 text-red-500 text-sm font-semibold py-2 rounded-xl disabled:opacity-50">
                    ✕ Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {!cargando && datos && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
            <div className="text-3xl mb-1">🐄</div>
            <div className="text-2xl font-black text-gray-800">{datos.animales}</div>
            <div className="text-xs text-gray-400 mt-0.5">Animales</div>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100">
            <div className="text-3xl mb-1">⏳</div>
            <div className="text-2xl font-black text-gray-800">{pendientes.length}</div>
            <div className="text-xs text-gray-400 mt-0.5">Por aprobar</div>
          </div>
        </div>
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
