import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'
import { fmtFecha } from '../lib/fecha'

export default function DashboardTrabajador() {
  const { perfil } = useAuth()
  const [tareas, setTareas] = useState([])
  const [pendientes, setPendientes] = useState({ ordenos: 0, sanidad: 0, reproduccion: 0 })
  const [rechazados, setRechazados] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      const [
        { data: misTareas },
        { count: ordPend },
        { count: sanPend },
        { count: repPend },
        { data: ordRech },
        { data: sanRech },
        { data: repRech },
        { data: repTrabRech },
      ] = await Promise.all([
        supabase.from('tareas').select('id,titulo,prioridad,fecha_vencimiento,completada,fincas(nombre)')
          .eq('asignado_a', perfil.id).eq('completada', false)
          .order('fecha_vencimiento', { ascending: true }).limit(10),
        supabase.from('ordenos').select('*', { count: 'exact', head: true })
          .eq('estado', 'pendiente').eq('creado_por', perfil.id),
        supabase.from('eventos_sanitarios').select('*', { count: 'exact', head: true })
          .eq('estado', 'pendiente').eq('creado_por', perfil.id),
        supabase.from('eventos_reproductivos').select('*', { count: 'exact', head: true })
          .eq('estado', 'pendiente').eq('creado_por', perfil.id),
        supabase.from('ordenos').select('id,fecha,litros,comentario_rechazo')
          .eq('estado', 'rechazado').eq('creado_por', perfil.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('eventos_sanitarios').select('id,fecha,tipo,comentario_rechazo')
          .eq('estado', 'rechazado').eq('creado_por', perfil.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('eventos_reproductivos').select('id,fecha,tipo,comentario_rechazo')
          .eq('estado', 'rechazado').eq('creado_por', perfil.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('reportes_trabajador').select('id,fecha,titulo,comentario_rechazo')
          .eq('estado', 'rechazado').eq('creado_por', perfil.id).order('created_at', { ascending: false }).limit(5),
      ])

      setTareas(misTareas ?? [])
      setPendientes({ ordenos: ordPend ?? 0, sanidad: sanPend ?? 0, reproduccion: repPend ?? 0 })

      const items = [
        ...(ordRech ?? []).map(r => ({ ...r, _tipo: 'Ordeño', _desc: `${Number(r.litros).toFixed(1)} L`, _link: '/ordenos' })),
        ...(sanRech ?? []).map(r => ({ ...r, _tipo: 'Sanidad', _desc: r.tipo, _link: '/animales/sanidad' })),
        ...(repRech ?? []).map(r => ({ ...r, _tipo: 'Reproducción', _desc: r.tipo, _link: '/animales/reproduccion' })),
        ...(repTrabRech ?? []).map(r => ({ ...r, _tipo: 'Reporte', _desc: r.titulo, _link: '/actividades/recurrentes' })),
      ]
      setRechazados(items)
      setCargando(false)
    }
    cargar()
  }, [perfil?.id])

  const totalPendientes = pendientes.ordenos + pendientes.sanidad + pendientes.reproduccion
  const hoy = new Date().toISOString().split('T')[0]

  const modulos = [
    { to: '/actividades/recurrentes', icon: '🔄', label: 'Actividades del día', desc: 'Tus actividades diarias' },
    { to: '/animales',                icon: '🐄', label: 'Animales',            desc: 'Consultar hato y fichas' },
    { to: '/actividades',             icon: '✅', label: 'Actividades asignadas', desc: 'Ver y completar actividades' },
    { to: '/ordenos',                 icon: '🥛', label: 'Ordeños',             desc: 'Registrar producción' },
    { to: '/animales/sanidad',        icon: '💉', label: 'Sanidad',             desc: 'Registrar eventos' },
    { to: '/animales/reproduccion',   icon: '🔬', label: 'Reproducción',        desc: 'Registrar eventos' },
    { to: '/fincas',                  icon: '🏡', label: 'Fincas',              desc: 'Ver fincas y lotes' },
  ]

  return (
    <div className="space-y-4 pt-1 pb-2">

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-verde-700 p-6 shadow-xl">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -left-8 w-40 h-40 rounded-full bg-white/5" />
        <p className="text-verde-200 text-sm mb-1">Hola {perfil?.nombre?.split(' ')[0]} 👋</p>
        <p className="text-white font-bold text-xl mb-4">¿Qué vas a registrar hoy?</p>
        <div className="relative z-10 grid grid-cols-3 gap-2">
          <AccionRapida to="/ordenos" icon="🥛" label="Ordeño" />
          <AccionRapida to="/animales/sanidad" icon="💉" label="Sanidad" />
          <AccionRapida to="/animales/reproduccion" icon="🔬" label="Reproducción" />
        </div>
      </div>

      {/* Registros rechazados — requieren atención */}
      {rechazados.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <span className="text-red-500 text-lg">❌</span>
            <p className="text-sm font-bold text-red-700">Registros rechazados — requieren corrección</p>
          </div>
          {rechazados.map(r => {
            const [y, m, d] = r.fecha.split('-')
            return (
              <Link key={r.id} to={r._link}
                className="block bg-red-50 border border-red-200 rounded-2xl px-4 py-3 active:bg-red-100 transition">
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-0.5">❌</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-red-800">{r._tipo}: {r._desc}</p>
                    <p className="text-xs text-red-500">{d}/{m}/{y}</p>
                    {r.comentario_rechazo && (
                      <div className="mt-1.5 bg-white border border-red-200 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-500 font-medium mb-0.5">Motivo del rechazo:</p>
                        <p className="text-xs text-gray-700">"{r.comentario_rechazo}"</p>
                      </div>
                    )}
                    <p className="text-xs text-red-400 mt-1.5 font-medium">Toca para ir al módulo y corregir ›</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Registros pendientes de aprobación */}
      {totalPendientes > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">⏳</span>
          <div>
            <p className="text-sm font-semibold text-yellow-800">Registros esperando aprobación</p>
            <p className="text-xs text-yellow-600">
              {pendientes.ordenos > 0 && `${pendientes.ordenos} ordeño(s) `}
              {pendientes.sanidad > 0 && `${pendientes.sanidad} sanidad `}
              {pendientes.reproduccion > 0 && `${pendientes.reproduccion} reproducción`}
            </p>
          </div>
        </div>
      )}

      {/* Mis tareas pendientes */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Mis actividades pendientes</p>
        {cargando ? (
          <p className="text-gray-400 text-sm px-1">Cargando...</p>
        ) : tareas.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-gray-100">
            <p className="text-3xl mb-2">🎉</p>
            <p className="text-sm text-gray-500">Sin actividades pendientes</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tareas.map(t => {
              const vencida = t.fecha_vencimiento && t.fecha_vencimiento < hoy
              return (
                <Link key={t.id} to="/actividades"
                  className="bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-sm border border-gray-100">
                  <span className="text-xl">{t.prioridad === 'alta' ? '🔴' : t.prioridad === 'media' ? '🟡' : '🟢'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{t.titulo}</p>
                    <p className="text-xs text-gray-400">{t.fincas?.nombre}{t.fecha_vencimiento ? ` · ${vencida ? '⚠️ Venció' : 'Vence'} ${fmtFecha(t.fecha_vencimiento)}` : ''}</p>
                  </div>
                  {vencida && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Vencida</span>}
                </Link>
              )
            })}
            <Link to="/actividades" className="block text-center text-sm text-verde-600 font-medium py-2">
              Ver todas las actividades ›
            </Link>
          </div>
        )}
      </div>

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

function AccionRapida({ to, icon, label }) {
  return (
    <Link to={to} className="bg-white/15 hover:bg-white/25 rounded-2xl py-3 flex flex-col items-center gap-1 transition">
      <span className="text-2xl">{icon}</span>
      <span className="text-xs text-white font-medium">{label}</span>
    </Link>
  )
}
