import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

const META_LITROS_DIA = 10000 // ajustable por el propietario en el futuro

export default function Dashboard() {
  const { perfil } = useAuth()
  const [resumen, setResumen] = useState({ fincas: 0, animales: 0, enOrdeno: 0, litrosHoy: 0, litrosAyer: 0 })
  const [alertas, setAlertas] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      const hoy = new Date().toISOString().split('T')[0]
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
      ])

      const litrosHoy = ordenosHoy?.reduce((s, o) => s + Number(o.litros), 0) ?? 0
      const litrosAyer = ordenosAyer?.reduce((s, o) => s + Number(o.litros), 0) ?? 0

      setResumen({ fincas: fincas ?? 0, animales: animales ?? 0, enOrdeno: enOrdeno ?? 0, litrosHoy, litrosAyer })

      const nuevasAlertas = []
      retiros?.forEach(a => nuevasAlertas.push({ tipo: 'retiro', texto: `${a.identificacion}${a.nombre ? ` (${a.nombre})` : ''} — retiro de leche vencido`, color: 'red' }))
      tareasVencidas?.forEach(t => nuevasAlertas.push({ tipo: 'tarea', texto: `Tarea vencida: ${t.titulo}`, color: 'orange' }))
      partosProximos?.forEach(p => nuevasAlertas.push({ tipo: 'parto', texto: `Parto próximo: ${p.animales?.identificacion ?? '?'} el ${p.fecha_probable_parto}`, color: 'yellow' }))
      setAlertas(nuevasAlertas)

      setCargando(false)
    }
    cargar()
  }, [])

  const pct = Math.min((resumen.litrosHoy / META_LITROS_DIA) * 100, 100)
  const semaforoColor = pct >= 90 ? 'bg-green-500' : pct >= 70 ? 'bg-yellow-400' : 'bg-red-400'
  const semaforoTexto = pct >= 90 ? 'En meta 🟢' : pct >= 70 ? 'Cerca de la meta 🟡' : 'Por debajo de meta 🔴'

  const modulos = [
    { to: '/animales',    icon: '🐄', label: 'Animales'      },
    { to: '/tareas',      icon: '✅', label: 'Tareas'        },
    { to: '/ordenos',     icon: '🥛', label: 'Ordeños'       },
    { to: '/sanidad',     icon: '💉', label: 'Sanidad'       },
    { to: '/reproduccion',icon: '🔬', label: 'Reproducción'  },
    { to: '/movimientos', icon: '🚛', label: 'Movimientos'   },
    { to: '/fincas',      icon: '🏡', label: 'Fincas'        },
    { to: '/equipo',      icon: '👥', label: 'Equipo'        },
  ]

  return (
    <div className="space-y-5 pt-2">
      <div>
        <h2 className="text-xl font-bold text-gray-800">Hola, {perfil?.nombre?.split(' ')[0]} 👋</h2>
        <p className="text-gray-500 text-sm capitalize">
          {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a, i) => (
            <div key={i} className={`rounded-xl px-4 py-3 text-sm font-medium flex items-start gap-2 ${
              a.color === 'red' ? 'bg-red-50 text-red-700 border border-red-200' :
              a.color === 'orange' ? 'bg-orange-50 text-orange-700 border border-orange-200' :
              'bg-yellow-50 text-yellow-700 border border-yellow-200'
            }`}>
              <span>{a.color === 'red' ? '🚨' : a.color === 'orange' ? '⚠️' : '📅'}</span>
              {a.texto}
            </div>
          ))}
        </div>
      )}

      {/* Semáforo de producción */}
      {!cargando && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Producción hoy</span>
            <span className="text-xs text-gray-500">{semaforoTexto}</span>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-gray-800">{resumen.litrosHoy.toFixed(0)} L</span>
            <span className="text-sm text-gray-400 mb-1">
              {resumen.litrosAyer > 0 && (
                resumen.litrosHoy >= resumen.litrosAyer
                  ? `▲ ${(resumen.litrosHoy - resumen.litrosAyer).toFixed(0)} vs ayer`
                  : `▼ ${(resumen.litrosAyer - resumen.litrosHoy).toFixed(0)} vs ayer`
              )}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div className={`h-3 rounded-full transition-all ${semaforoColor}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-400">
            <span>0</span>
            <span>Meta: {META_LITROS_DIA.toLocaleString()} L</span>
          </div>
        </div>
      )}

      {/* Stats */}
      {cargando ? (
        <p className="text-gray-400 text-sm">Cargando datos...</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <Stat icon="🏡" label="Fincas"   valor={resumen.fincas}   />
          <Stat icon="🐄" label="Animales" valor={resumen.animales}  />
          <Stat icon="🥛" label="En ordeño" valor={resumen.enOrdeno} />
        </div>
      )}

      {/* Módulos */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Módulos</h3>
        <div className="grid grid-cols-4 gap-2">
          {modulos.map(({ to, icon, label }) => (
            <Link key={to} to={to}
              className="border border-gray-200 rounded-xl py-3 flex flex-col items-center gap-1 bg-white hover:shadow transition">
              <span className="text-2xl">{icon}</span>
              <span className="text-xs text-gray-600 font-medium text-center leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function Stat({ icon, label, valor }) {
  return (
    <div className="rounded-xl border border-gray-200 p-3 bg-white text-center">
      <div className="text-xl mb-0.5">{icon}</div>
      <div className="text-xl font-bold text-gray-800">{valor}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  )
}
